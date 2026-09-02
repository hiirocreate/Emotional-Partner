/**
 * Googleアカウント連携(サインイン)— Web版実装。
 *
 * lib/googleAuth.ts (Android/iOS)が使っている公式ネイティブSign-Inライブラリは
 * Webをサポートしていないため、Web版はOpenRouter連携(lib/openrouterOAuth.ts)と
 * 同じ「ブラウザでログイン→アプリの画面に戻る」PKCE方式を、Google自身のOAuth
 * エンドポイントに対して直接実装している。
 *
 * Googleの場合、OpenRouterと違って redirect_uri を事前にGoogle Cloud Console側で
 * 登録しておく必要がある(このアプリのWeb公開URL + "/oauth/google"、
 * app/oauth/google.tsx が受け皿ページ)。トークン交換にはクライアントシークレットが
 * 必要(lib/config.ts のコメント参照)。
 */

import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { bytesToBase64 } from "./base64";
import {
  GOOGLE_DRIVE_SCOPES,
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_WEB_CLIENT_SECRET,
  isGoogleSyncConfigured,
} from "./config";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export class GoogleAuthError extends Error {}

export interface GoogleAuthResult {
  email: string | null;
  accessToken: string;
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

/** このプラットフォームでGoogle連携が使える可能性があるか(設定未了は除く) */
export function isGoogleAuthSupported(): boolean {
  return true;
}

/**
 * Googleサインインを開始する。
 * 利用者がキャンセルした場合は null を返す(エラーにはしない)。
 *
 * Web版は簡略化のため、アクセストークン(有効期限は約1時間)のみを保持し
 * リフレッシュトークンは保存しない。期限が切れたら再ログインが必要になる
 * (端末内に長期間残る認証情報を増やさないための意図的な設計)。
 */
export async function connectGoogleAccount(): Promise<GoogleAuthResult | null> {
  if (!isGoogleSyncConfigured()) {
    throw new GoogleAuthError(
      "Googleアカウント連携が未設定です(アプリ配布者による設定待ちです)。"
    );
  }

  const redirectUri = Linking.createURL("oauth/google");
  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const scope = [...GOOGLE_DRIVE_SCOPES, "openid", "email"].join(" ");

  const authUrl =
    `${AUTHORIZE_URL}?client_id=${encodeURIComponent(GOOGLE_WEB_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scope)}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&access_type=online` +
    `&prompt=consent`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    return null;
  }
  if (result.type !== "success" || !result.url) {
    throw new GoogleAuthError(
      "Googleからの応答を受け取れませんでした。もう一度お試しください。"
    );
  }

  const code = extractCodeParam(result.url);
  if (!code) {
    throw new GoogleAuthError(
      "Googleからログインコードを受け取れませんでした。もう一度お試しください。"
    );
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_WEB_CLIENT_ID,
      client_secret: GOOGLE_WEB_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new GoogleAuthError(
      `Google側でエラーが発生しました(status ${tokenRes.status})。時間をおいて再度お試しください。`
    );
  }
  const tokenData: { access_token?: string } = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new GoogleAuthError("Googleからアクセストークンを受け取れませんでした。");
  }

  let email: string | null = null;
  try {
    const userRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userRes.ok) {
      const userData: { email?: string } = await userRes.json();
      email = userData.email ?? null;
    }
  } catch {
    // メールアドレスは表示用にすぎないので、取得失敗は無視する
  }

  return { email, accessToken: tokenData.access_token };
}

/**
 * Web版はリフレッシュトークンを保持しないため、サイレント再認証はできない。
 * 呼び出し側は「アクセストークンが無ければ再ログインを促す」形で対応する。
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  return null;
}

/** Web版は保存している認証情報が無いため、特にやることはない */
export async function disconnectGoogleAccount(): Promise<void> {
  // no-op
}
