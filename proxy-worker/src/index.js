/**
 * こころトーク 共有プロキシ (Cloudflare Workers)
 *
 * 目的: アプリの利用者が各自でGroqのAPIキーを発行しなくても対話AIを使えるように、
 * 開発者(配布者)自身のAPIキーをこのWorkerの環境変数(シークレット)にだけ保持し、
 * アプリからのリクエストをGroqへ中継する。
 *
 * 【有料プラン(サブスクリプション)】
 * 「備え付けのAI」(この共有プロキシ経由の対話AI)を使うには、有料プラン加入
 * (Stripeでのサブスク契約)または管理者コードが必要。/v1/billing/status で
 * ライセンスコードの状態を確認し、/v1/chat/completions もそのコードで
 * ゲートする。/v1/billing/webhook はStripeからのWebhookを受け取り、
 * KV(SUBSCRIBERS)にサブスク状態を反映する。
 *
 * セキュリティ上の注意:
 * - X-App-Secret ヘッダーによる簡易ゲートを設けているが、これはアプリのビルドに
 *   埋め込まれる文字列なので「無関係な第三者による誤発見・スキャン対策」程度の
 *   ものであり、本当の意味での認証ではない。
 * - 呼び出せるモデルは ALLOWED_MODELS に列挙したものだけに制限している
 *   (任意のモデル名を指定されて高コストなモデルを叩かれることを防ぐため)。
 * - wrangler.toml の [[ratelimits]] で簡易レート制限もかけている。
 * - ADMIN_CODE はビルドに埋め込まれず、サーバー側のシークレットとしてのみ
 *   保持される(利用者が入力し、その都度サーバーに問い合わせて照合する)ため、
 *   X-App-Secretよりは強い保護になっている。
 *
 * これらはテスト・小規模公開向けの軽量な対策であり、悪意ある大規模アクセスを
 * 完全に防げるものではない。利用者が増えて心配な場合は、Cloudflare Access等での
 * 追加の保護や、そもそも利用者ごとに自分のAPIキーを使う運用への切り替えも検討すること。
 */

const UPSTREAM_BASE_URL = "https://api.groq.com/openai/v1";

// アプリ側の設定画面(PROXY_MODEL_PRESETS)と一致させること
const ALLOWED_MODELS = new Set(["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]);

const MAX_TOKENS_CAP = 800;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);

    if (url.pathname === "/v1/billing/status" && request.method === "GET") {
      return handleBillingStatus(request, env, url);
    }
    if (url.pathname === "/v1/billing/webhook" && request.method === "POST") {
      return handleStripeWebhook(request, env);
    }
    if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      return handleChatCompletions(request, env);
    }
    if (url.pathname === "/v1/chat/completions") {
      return jsonResponse({ error: { message: "method not allowed" } }, 405);
    }
    return jsonResponse({ error: { message: "not found" } }, 404);
  },
};

// ---------------------------------------------------------------------------
// 対話AI (既存機能 + 有料プランゲートを追加)
// ---------------------------------------------------------------------------

async function handleChatCompletions(request, env) {
  if (!env.APP_SHARED_SECRET) {
    return jsonResponse(
      { error: { message: "サーバー側の設定が未完了です(APP_SHARED_SECRET未設定)" } },
      500
    );
  }
  const appSecret = request.headers.get("x-app-secret");
  if (appSecret !== env.APP_SHARED_SECRET) {
    return jsonResponse({ error: { message: "unauthorized" } }, 401);
  }

  const licenseCode = request.headers.get("x-license-code") || "";
  const license = await checkLicense(licenseCode, env);
  if (license.status !== "admin" && license.status !== "active") {
    return jsonResponse(
      {
        error: {
          message:
            "備え付けのAI(共有プロキシ)は有料プランの方のみご利用いただけます。設定画面の「利用プラン」から加入するか、管理者コードを入力してください。",
          code: "subscription_required",
        },
      },
      402
    );
  }

  if (!env.GROQ_API_KEY) {
    return jsonResponse(
      { error: { message: "サーバー側の設定が未完了です(GROQ_API_KEY未設定)" } },
      500
    );
  }

  // 簡易レート制限(wrangler.tomlでバインディングを定義している場合のみ動作)
  if (env.RATE_LIMITER) {
    try {
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return jsonResponse(
          { error: { message: "レート制限に達しました。しばらくしてから再度お試しください。" } },
          429
        );
      }
    } catch (e) {
      // バインディング未対応環境等でも致命的にしない
      console.warn("rate limiter error", e);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: { message: "invalid JSON body" } }, 400);
  }

  if (!body || typeof body.model !== "string" || !ALLOWED_MODELS.has(body.model)) {
    return jsonResponse(
      { error: { message: `model must be one of: ${[...ALLOWED_MODELS].join(", ")}` } },
      400
    );
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: { message: "messages is required" } }, 400);
  }

  const upstreamBody = JSON.stringify({
    model: body.model,
    messages: body.messages,
    temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
    max_tokens: Math.min(
      typeof body.max_tokens === "number" ? body.max_tokens : 700,
      MAX_TOKENS_CAP
    ),
    stream: body.stream !== false,
  });

  let upstreamRes;
  try {
    upstreamRes = await fetch(`${UPSTREAM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: upstreamBody,
    });
  } catch (e) {
    return jsonResponse({ error: { message: "上流AIサーバーへの接続に失敗しました" } }, 502);
  }

  // ストリーミングレスポンスをそのまま中継する
  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": upstreamRes.headers.get("Content-Type") ?? "text/event-stream",
      "Cache-Control": "no-cache",
      ...corsHeaders(),
    },
  });
}

// ---------------------------------------------------------------------------
// 有料プラン(サブスクリプション)
// ---------------------------------------------------------------------------

/**
 * ライセンスコードの状態を判定する。
 * - env.ADMIN_CODE と一致する場合は無条件で "admin"(課金不要・全機能開放)。
 * - それ以外は KV(env.SUBSCRIBERS) の `code:<code>` レコードを見て
 *   有効なサブスクリプションかどうかを判定する。
 */
async function checkLicense(code, env) {
  const trimmed = (code || "").trim();
  if (!trimmed) return { status: "none", expiresAt: null };

  if (env.ADMIN_CODE && trimmed === env.ADMIN_CODE) {
    return { status: "admin", expiresAt: null };
  }

  if (!env.SUBSCRIBERS) {
    // KVバインディング未設定(サブスク機能セットアップ前)。管理者コード以外は常に未加入扱い。
    return { status: "none", expiresAt: null };
  }

  const raw = await env.SUBSCRIBERS.get(`code:${trimmed}`);
  if (!raw) return { status: "none", expiresAt: null };

  let record;
  try {
    record = JSON.parse(raw);
  } catch {
    return { status: "none", expiresAt: null };
  }

  const expiresAt = typeof record.currentPeriodEnd === "number" ? record.currentPeriodEnd : null;
  const notExpired = expiresAt == null || expiresAt > Date.now();
  if (record.active && notExpired) {
    return { status: "active", expiresAt };
  }
  return { status: "none", expiresAt: null };
}

async function handleBillingStatus(request, env, url) {
  if (!env.APP_SHARED_SECRET || request.headers.get("x-app-secret") !== env.APP_SHARED_SECRET) {
    return jsonResponse({ error: { message: "unauthorized" } }, 401);
  }
  const code = url.searchParams.get("code") || "";
  const result = await checkLicense(code, env);
  return jsonResponse(result, 200);
}

/**
 * Stripeからのwebhookを受け取り、KVのサブスク状態を更新する。
 * 対応イベント:
 *  - checkout.session.completed: 初回決済完了。client_reference_id をコードとして紐付ける。
 *  - customer.subscription.updated: 更新・状態変化(有効/延滞/トライアル等)を反映。
 *  - customer.subscription.deleted: 解約時に無効化。
 */
async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: { message: "STRIPE_WEBHOOK_SECRET未設定" } }, 500);
  }
  if (!env.SUBSCRIBERS) {
    return jsonResponse({ error: { message: "SUBSCRIBERS(KV)未設定" } }, 500);
  }

  const signatureHeader = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  const verified = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) {
    return jsonResponse({ error: { message: "invalid signature" } }, 400);
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: { message: "invalid JSON" } }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data?.object ?? {};
        const code = (session.client_reference_id || "").trim();
        const subscriptionId = session.subscription;
        if (code && subscriptionId) {
          await env.SUBSCRIBERS.put(
            `code:${code}`,
            JSON.stringify({ active: true, subscriptionId, currentPeriodEnd: null })
          );
          await env.SUBSCRIBERS.put(`sub:${subscriptionId}`, code);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data?.object ?? {};
        await syncSubscriptionRecord(subscription, env);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data?.object ?? {};
        const code = await env.SUBSCRIBERS.get(`sub:${subscription.id}`);
        if (code) {
          await env.SUBSCRIBERS.put(
            `code:${code}`,
            JSON.stringify({ active: false, subscriptionId: subscription.id, currentPeriodEnd: null })
          );
        }
        break;
      }
      default:
        // その他のイベントは無視
        break;
    }
  } catch (e) {
    console.error("stripe webhook processing error", e);
    return jsonResponse({ error: { message: "webhook processing failed" } }, 500);
  }

  return jsonResponse({ received: true }, 200);
}

async function syncSubscriptionRecord(subscription, env) {
  const subscriptionId = subscription.id;
  if (!subscriptionId) return;
  const code = await env.SUBSCRIBERS.get(`sub:${subscriptionId}`);
  if (!code) return; // まだcheckout.session.completedを受け取っていない(順序が前後した場合はここでは何もしない)

  const active = subscription.status === "active" || subscription.status === "trialing";

  // Stripeの "Basil" 版API(2025-03-31以降)ではcurrent_period_endは
  // サブスクリプション直下ではなく各subscription itemに移動している。
  // 新旧どちらのAPIバージョンでも動くよう両方に対応する。
  let currentPeriodEndSec =
    subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end ?? null;

  const currentPeriodEnd = typeof currentPeriodEndSec === "number" ? currentPeriodEndSec * 1000 : null;

  await env.SUBSCRIBERS.put(
    `code:${code}`,
    JSON.stringify({ active, subscriptionId, currentPeriodEnd })
  );
}

/**
 * Stripe Webhookの署名検証(Web Crypto APIを使用、Node.js cryptoに依存しない実装)。
 * Stripe-Signature ヘッダーの形式: "t=<timestamp>,v1=<signature>[,v0=...]"
 * 署名対象: `${timestamp}.${rawBody}` のHMAC-SHA256をSTRIPE_WEBHOOK_SECRETで計算し、
 * 16進文字列としてv1と比較する。
 */
async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  const computedHex = bufferToHex(mac);

  return timingSafeEqualHex(computedHex, expectedSig);
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// 共通ヘルパー
// ---------------------------------------------------------------------------

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret, X-License-Code",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
