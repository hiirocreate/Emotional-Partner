import { AiProviderSettings, BillingSettings, ChatMessage, PersonaSettings } from "./types";
import { buildSystemPrompt } from "./personas";
import { SHARED_PROXY_APP_SECRET, SHARED_PROXY_BASE_URL, isSharedProxyConfigured } from "./config";
import { hasPaidAccess } from "./billing";

export class AiConfigError extends Error {}
export class AiRequestError extends Error {}

/**
 * OpenAI互換の /chat/completions ストリーミングエンドポイントを叩く。
 * Groq/OpenRouterなどのOpenAI互換無料枠サービスはSSEストリーミングに対応しているため、
 * 生成され次第テキストを逐次表示することで体感速度を大きく改善する。
 *
 * 接続モードは2つ:
 * - "proxy": 開発者が用意した共有プロキシ(Cloudflare Workers)にアクセスする。
 *   APIキーは開発者側でのみ保持しており、利用者は何も入力しなくてよい。
 * - "custom": 利用者自身のAPIキー・接続先をそのまま使う。
 *
 * React Native(Android/iOS)では fetch の ReadableStream が使えない場合があるため、
 * Web/Native共通で動く XMLHttpRequest の progressive responseText を使って
 * SSEチャンクを手動パースする方式を採用している。
 */
/**
 * ストリーミング不要の、1回きりの単純な応答取得。
 * 会話本体の応答生成(streamAiReply)とは別に、AIの記憶の要約更新(lib/memory.ts)など
 * 「利用者向けの会話ではない、裏側の一回きりの依頼」に使う。
 * ペルソナのシステムプロンプトは使わず、呼び出し側が渡した内容をそのまま送る。
 */
export async function requestSimpleCompletion(
  systemPrompt: string,
  userPrompt: string,
  aiSettings: AiProviderSettings,
  billing: BillingSettings,
  googleIdToken: string | null
): Promise<string> {
  const useProxy = aiSettings.mode === "proxy";

  if (useProxy && !isSharedProxyConfigured()) {
    throw new AiConfigError("共有プロキシが未設定です。");
  }
  if (useProxy && !hasPaidAccess(billing)) {
    throw new AiConfigError("備え付けのAI(共有プロキシ)は有料プランの方のみご利用いただけます。");
  }
  if (useProxy && !googleIdToken) {
    throw new AiConfigError(
      "Google連携の認証が切れています。設定画面の「Googleアカウント連携」から再度サインインしてください。"
    );
  }
  if (!useProxy && !aiSettings.apiKey) {
    throw new AiConfigError("AIのAPIキーが設定されていません。");
  }
  if (!useProxy && (!aiSettings.baseUrl || !aiSettings.model)) {
    throw new AiConfigError("AIプロバイダの接続先/モデルが未設定です。");
  }

  const baseUrl = useProxy ? SHARED_PROXY_BASE_URL : aiSettings.baseUrl;
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (useProxy) {
    headers["X-App-Secret"] = SHARED_PROXY_APP_SECRET;
    headers["X-Google-Id-Token"] = googleIdToken || "";
  } else {
    headers["Authorization"] = `Bearer ${aiSettings.apiKey}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: aiSettings.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
        stream: false,
      }),
    });
  } catch {
    throw new AiRequestError("AIサーバーに接続できませんでした。");
  }
  if (!res.ok) {
    throw new AiRequestError(`AIからの応答取得に失敗しました(status ${res.status})。`);
  }
  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiRequestError("AIから応答を受け取れませんでした。");
  }
  return content.trim();
}

export function streamAiReply(
  history: ChatMessage[],
  persona: PersonaSettings,
  aiSettings: AiProviderSettings,
  billing: BillingSettings,
  onDelta: (fullTextSoFar: string) => void,
  memorySummary?: string,
  googleIdToken?: string | null
): { promise: Promise<string>; abort: () => void } {
  let xhr: XMLHttpRequest | undefined;

  const promise = new Promise<string>((resolve, reject) => {
    const useProxy = aiSettings.mode === "proxy";

    if (useProxy && !isSharedProxyConfigured()) {
      reject(
        new AiConfigError(
          "共有プロキシが未設定です(アプリ配布者による設定待ちです)。設定画面から「自分のAPIキーを使う」に切り替えてください。"
        )
      );
      return;
    }
    if (useProxy && !hasPaidAccess(billing)) {
      reject(
        new AiConfigError(
          "備え付けのAI(共有プロキシ)は有料プランの方のみご利用いただけます。設定画面の「利用プラン」から加入してください。"
        )
      );
      return;
    }
    if (useProxy && !googleIdToken) {
      reject(
        new AiConfigError(
          "Google連携の認証が切れています。設定画面の「Googleアカウント連携」から再度サインインしてください。"
        )
      );
      return;
    }
    if (!useProxy && !aiSettings.apiKey) {
      reject(
        new AiConfigError(
          "AIのAPIキーが設定されていません。設定画面から入力してください。"
        )
      );
      return;
    }
    if (!useProxy && (!aiSettings.baseUrl || !aiSettings.model)) {
      reject(new AiConfigError("AIプロバイダの接続先/モデルが未設定です。"));
      return;
    }

    const systemPrompt = buildSystemPrompt(persona, memorySummary);
    // 直近のやり取りのみをコンテキストとして送る(トークン節約・無料枠対策)
    const recent = history.slice(-16).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    }));

    const body = JSON.stringify({
      model: aiSettings.model,
      messages: [{ role: "system", content: systemPrompt }, ...recent],
      temperature: 0.7,
      max_tokens: 700,
      stream: true,
    });

    const baseUrl = useProxy ? SHARED_PROXY_BASE_URL : aiSettings.baseUrl;
    const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

    xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    if (useProxy) {
      xhr.setRequestHeader("X-App-Secret", SHARED_PROXY_APP_SECRET);
      xhr.setRequestHeader("X-Google-Id-Token", googleIdToken || "");
    } else {
      xhr.setRequestHeader("Authorization", `Bearer ${aiSettings.apiKey}`);
    }

    let processedLength = 0;
    let lineBuffer = "";
    let accumulated = "";

    const consumeNewText = () => {
      const full = xhr?.responseText ?? "";
      const newChunk = full.slice(processedLength);
      if (!newChunk) return;
      processedLength = full.length;
      lineBuffer += newChunk;
      const lines = lineBuffer.split("\n");
      // 最後の要素は不完全な行の可能性があるので次回に持ち越す
      lineBuffer = lines.pop() ?? "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          const delta: string | undefined = json.choices?.[0]?.delta?.content;
          if (delta) {
            accumulated += delta;
            onDelta(accumulated);
          }
        } catch {
          // ネットワークチャンクの境目でJSONが分断された場合はスキップ
          // (次のイベントで lineBuffer 経由で再結合される)
        }
      }
    };

    xhr.onreadystatechange = () => {
      if (!xhr) return;
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        consumeNewText();
      }
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(accumulated.trim() || "……うまく言葉にできませんでした。もう一度送ってもらえますか。");
        } else if (xhr.status === 429) {
          reject(
            new AiRequestError(
              "共有プロキシの利用が混み合っています。少し時間をおいて再度お試しください。"
            )
          );
        } else if (xhr.status === 402) {
          reject(
            new AiRequestError(
              "備え付けのAI(共有プロキシ)は有料プランの方のみご利用いただけます。設定画面の「利用プラン」から加入してください。"
            )
          );
        } else {
          let message = `HTTP ${xhr.status}`;
          try {
            const errJson = JSON.parse(xhr.responseText);
            message = errJson?.error?.message ?? message;
          } catch {
            // レスポンスがJSONでない場合はそのままHTTPステータスを表示
          }
          reject(new AiRequestError(`AIからの応答取得に失敗しました: ${message}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(
        new AiRequestError(
          "AIサーバーに接続できませんでした。ネットワーク状況を確認してください。"
        )
      );
    };

    xhr.send(body);
  });

  return {
    promise,
    abort: () => {
      try {
        xhr?.abort();
      } catch {
        // no-op
      }
    },
  };
}
