// googleIdToken.js の検証ロジックを、実際に自己署名JWTを作って確認するテストスクリプト。
// 本番のGoogleサーバーには一切通信せず、ローカルで生成した鍵ペアだけで完結する。
//
// 実行: node proxy-worker/test-jwt-verify.mjs
import { generateKeyPairSync, sign as nodeSign } from "node:crypto";
import { verifyGoogleIdToken } from "./src/googleIdToken.js";

const EXPECTED_AUDIENCE = "test-client-id.apps.googleusercontent.com";
const KID = "test-key-1";

function base64UrlEncode(bytesOrString) {
  const buf = typeof bytesOrString === "string" ? Buffer.from(bytesOrString) : Buffer.from(bytesOrString);
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(payload, privateKey, headerOverrides = {}) {
  const header = { alg: "RS256", typ: "JWT", kid: KID, ...headerOverrides };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = nodeSign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  const signatureB64 = base64UrlEncode(signature);
  return `${signingInput}.${signatureB64}`;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

async function main() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  jwk.kid = KID;
  jwk.use = "sig";
  jwk.alg = "RS256";

  const jwks = { keys: [jwk] };
  const fetchImpl = async (url) => {
    if (!url.includes("googleapis.com/oauth2/v3/certs")) {
      throw new Error(`unexpected fetch url in test: ${url}`);
    }
    return {
      ok: true,
      json: async () => jwks,
    };
  };

  const basePayload = {
    iss: "https://accounts.google.com",
    aud: EXPECTED_AUDIENCE,
    email: "User@Example.com",
    email_verified: true,
    exp: nowSeconds() + 3600,
    iat: nowSeconds(),
  };

  let passed = 0;
  let failed = 0;
  function check(name, condition) {
    if (condition) {
      passed++;
      console.log(`OK   ${name}`);
    } else {
      failed++;
      console.log(`FAIL ${name}`);
    }
  }

  // 1. 正常系: 有効な署名・すべてのクレームが正しい
  {
    const token = signJwt(basePayload, privateKey);
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check("valid token is accepted", result !== null);
    check("email is lowercased and trimmed", result && result.email === "user@example.com");
  }

  // 2. aud(クライアントID)が違う場合は拒否
  {
    const token = signJwt({ ...basePayload, aud: "someone-elses-client-id" }, privateKey);
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check("wrong audience is rejected", result === null);
  }

  // 3. 期限切れは拒否
  {
    const token = signJwt({ ...basePayload, exp: nowSeconds() - 10 }, privateKey);
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check("expired token is rejected", result === null);
  }

  // 4. email_verified が false の場合は拒否
  {
    const token = signJwt({ ...basePayload, email_verified: false }, privateKey);
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check("unverified email is rejected", result === null);
  }

  // 5. issuer が Google 以外の場合は拒否
  {
    const token = signJwt({ ...basePayload, iss: "https://evil.example.com" }, privateKey);
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check("wrong issuer is rejected", result === null);
  }

  // 6. 署名を改ざん(ペイロードだけ書き換えて署名はそのまま)した場合は拒否
  //    → なりすまし(他人のメールアドレスを自己申告)ができないことの直接的な確認
  {
    const validToken = signJwt(basePayload, privateKey);
    const [h, p, s] = validToken.split(".");
    const tamperedPayload = base64UrlEncode(
      JSON.stringify({ ...basePayload, email: "admin@example.com" })
    );
    const tamperedToken = `${h}.${tamperedPayload}.${s}`;
    const result = await verifyGoogleIdToken(tamperedToken, EXPECTED_AUDIENCE, fetchImpl);
    check("tampered payload (email spoofing attempt) is rejected", result === null);
  }

  // 7. 別の(正しい)鍵ペアで署名されたトークン(kidだけ同じに偽装)は拒否
  {
    const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const token = signJwt(basePayload, otherPrivateKey);
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check("token signed with a different private key is rejected", result === null);
  }

  // 8. algがRS256以外(none攻撃のバリエーション)の場合は拒否
  {
    const token = signJwt(basePayload, privateKey, { alg: "none" });
    const result = await verifyGoogleIdToken(token, EXPECTED_AUDIENCE, fetchImpl);
    check('alg "none" is rejected', result === null);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
