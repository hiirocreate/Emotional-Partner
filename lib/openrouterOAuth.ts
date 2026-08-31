/**
 * OpenRouterのOAuth (PKCE) 連携。
 *
 * 「個別のAPI連携を利用者ごとに簡単にできるように」するための仕組み。
 * OpenRouterはAPIキーをブラウザでのログイン一つで発行できるOAuth
 * (PKCE方式、クライアント事前登録不要)を公式に提供している
 * (https://openrouter.ai/docs/guides/overview/auth/oauth)。
 *
 * これを使うと、利用者は
 *   1. 「OpenRouterでログインして接続」ボタンを押す
 *   2. ブラウザでOpenRouterにログイン(未登録なら新規登録)して許可する
 *   3. アプリに自動で戻り、APIキーが設定される
 * という流れだけで、APIキーの発行・コピー・貼り付けを一切せずに
 * 自分専用のAPIキーを使い始められる。
 *
 * Groqには同種のOAuth機構が無いため(2026年8月時点、手動でのダッシュボード
 * キー発行のみ)、Groqについては settings.tsx 側でキー作成ページを直接開く
 * ボタンと、クリップボード貼り付けボタンで手間を減らす方針にしている。
 */

import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

const AUTHORIZE_URL = "https://openrouter.ai/auth";
const TOKEN_URL = "https://openrouter.ai/api/v1/auth/keys";

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Uint8Array → base64 (依存ライブラリなしの純粋なJS実装。RN/Web両対応) */
function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += BASE64_CHARS[(chunk >> 18) & 63];
    result += BASE64_CHARS[(chunk >> 12) & 63];
    result += BASE64_CHARS[(chunk >> 6) & 63];
    result += BASE64_CHARS[chunk & 63];
  }
  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    result += BASE64_CHARS[(chunk >> 18) & 63] + BASE64_CHARS[(chunk >> 12) & 63] + "==";
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result +=
      BASE64_CHARS[(chunk >> 18) & 63] +
      BASE64_CHARS[(chunk >> 12) & 63] +
      BASE64_CHARS[(chunk >> 6) & 63] +
      "=";
  }
  return result;
}

function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function generateCodeVerifier(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(64);
  return toBase64Url(bytesToBase64(randomBytes));
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const digestBase64 = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return toBase64Url(digestBase64);
}

export class OpenRouterOAuthError extends Error {}

/**
 * OpenRouterのOAuthログインを開始し、成功したら発行されたAPIキー文字列を返す。
 * 利用者がキャンセルした場合は null を返す(エラーにはしない)。
 */
export async function connectOpenRouterAccount(): Promise<string | null> {
  const redirectUri = Linking.createURL("oauth/openrouter");
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authUrl =
    `${AUTHORIZE_URL}?callback_url=${encodeURIComponent(redirectUri)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&key_label=${encodeURIComponent("EmPa")}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    return null;
  }
  if (result.type !== "success" || !result.url) {
    throw new OpenRouterOAuthError(
      "OpenRouterからの応答を受け取れませんでした。もう一度お試しください。"
    );
  }

  const code = extractCodeParam(result.url);
  if (!code) {
    throw new OpenRouterOAuthError(
      "OpenRouterからログインコードを受け取れませんでした。もう一度お試しください。"
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: codeVerifier,
      code_challenge_method: "S256",
    }),
  });

  if (!res.ok) {
    throw new OpenRouterOAuthError(
      `OpenRouter側でエラーが発生しました(status ${res.status})。時間をおいて再度お試しください。`
    );
  }

  const data: { key?: string } = await res.json();
  if (!data.key) {
    throw new OpenRouterOAuthError(
      "OpenRouterからAPIキーを受け取れませんでした。もう一度お試しください。"
    );
  }
  return data.key;
}

function extractCodeParam(url: string): string | null {
  try {
    const parsed = Linking.parse(url);
    const code = parsed.queryParams?.code;
    if (typeof code === "string") return code;
    if (Array.isArray(code) && typeof code[0] === "string") return code[0];
  } catch {
    // 下のフォールバックへ
  }
  const match = url.match(/[?&]code=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
