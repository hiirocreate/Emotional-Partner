/**
 * こころトーク 共有プロキシ (Cloudflare Workers)
 *
 * 目的: アプリの利用者が各自でGroqのAPIキーを発行しなくても対話AIを使えるように、
 * 開発者(配布者)自身のAPIキーをこのWorkerの環境変数(シークレット)にだけ保持し、
 * アプリからのリクエストをGroqへ中継する。
 *
 * セキュリティ上の注意:
 * - X-App-Secret ヘッダーによる簡易ゲートを設けているが、これはアプリのビルドに
 *   埋め込まれる文字列なので「無関係な第三者による誤発見・スキャン対策」程度の
 *   ものであり、本当の意味での認証ではない。
 * - 呼び出せるモデルは ALLOWED_MODELS に列挙したものだけに制限している
 *   (任意のモデル名を指定されて高コストなモデルを叩かれることを防ぐため)。
 * - wrangler.toml の [[ratelimits]] で簡易レート制限もかけている。
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
    if (url.pathname !== "/v1/chat/completions") {
      return jsonResponse({ error: { message: "not found" } }, 404);
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: { message: "method not allowed" } }, 405);
    }

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
  },
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
