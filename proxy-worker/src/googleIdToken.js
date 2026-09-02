/**
 * Google IDトークン(OpenID Connect, RS256)の検証ロジック。
 *
 * 「利用者がGoogleでサインインした本人である」ことをこのプロキシ側で確かめるために使う。
 * クライアント(アプリ)が「自分はこのメールアドレスです」と自己申告するだけでは、
 * 誰でも他人(例えば管理者)のメールアドレスを名乗って有料機能や管理者権限を
 * 詐称できてしまう。そのため、Googleが署名したIDトークン(JWT)そのものを検証し、
 * 署名・有効期限・発行者(iss)・宛先(aud)・メール確認済みフラグを全てチェックした
 * 上で、トークンの中に書かれているメールアドレスだけを信頼する。
 *
 * 実装はNode.js(テスト用)とCloudflare Workers(本番)の両方で動くよう、
 * Web Crypto API (`crypto.subtle`) のみに依存し、Node固有のcryptoモジュールや
 * jsonwebtoken等のライブラリには依存しない。
 */

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

/** base64url文字列 → Uint8Array */
function base64UrlToBytes(base64url) {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToJson(base64url) {
  const bytes = base64UrlToBytes(base64url);
  const text = new TextDecoder("utf-8").decode(bytes);
  return JSON.parse(text);
}

/**
 * GoogleのJWKS(公開鍵一覧)を取得する。Workers環境では `cf.cacheTtl` により
 * Cloudflareのエッジキャッシュが効く(呼び出し側のfetchWithCacheで指定)。
 */
async function fetchGoogleJwks(fetchImpl) {
  const res = await fetchImpl("https://www.googleapis.com/oauth2/v3/certs");
  if (!res.ok) {
    throw new Error(`GoogleのJWKS取得に失敗しました(status ${res.status})`);
  }
  const data = await res.json();
  if (!data || !Array.isArray(data.keys)) {
    throw new Error("GoogleのJWKSの形式が不正です");
  }
  return data.keys;
}

/**
 * Google IDトークンを検証し、成功すれば `{ email }` を返す。
 * 検証に失敗した場合(署名不一致・期限切れ・宛先不一致・メール未確認等)は
 * 例外を投げず null を返す(呼び出し側は「未認証」として扱えばよい)。
 *
 * @param {string} idToken - クライアントから受け取ったIDトークン(JWT文字列)
 * @param {string} expectedAudience - このアプリのGoogle OAuthクライアントID(Web用)
 * @param {(url: string) => Promise<Response>} fetchImpl - JWKS取得に使うfetch実装
 */
export async function verifyGoogleIdToken(idToken, expectedAudience, fetchImpl) {
  if (!idToken || typeof idToken !== "string") return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header, payload;
  try {
    header = base64UrlToJson(headerB64);
    payload = base64UrlToJson(payloadB64);
  } catch {
    return null;
  }

  if (header.alg !== "RS256" || !header.kid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.iss !== "string" || !GOOGLE_ISSUERS.has(payload.iss)) return null;
  if (payload.aud !== expectedAudience) return null;
  if (payload.email_verified !== true && payload.email_verified !== "true") return null;
  if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;

  let keys;
  try {
    keys = await fetchGoogleJwks(fetchImpl);
  } catch {
    return null;
  }
  const jwk = keys.find((k) => k.kid === header.kid && k.kty === "RSA");
  if (!jwk) return null;

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch {
    return null;
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToBytes(signatureB64);

  let verified = false;
  try {
    verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBytes,
      signedData
    );
  } catch {
    return null;
  }
  if (!verified) return null;

  return { email: payload.email.trim().toLowerCase() };
}
