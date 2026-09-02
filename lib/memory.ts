/**
 * AIによる「利用者についての記憶」の要約更新。
 *
 * 会話ログをそのまま毎回全部AIに読ませるのではなく、定期的に短い要約
 * (呼び方、最近の話題、大事にしていることなど)へ圧縮しておくことで、
 * 次回以降の会話の冒頭にこの要約だけを添えれば会話の文脈を引き継げるようにする
 * (無料枠のトークン消費を抑えつつ、長期的な「記憶」を実現するのが狙い)。
 *
 * 生成された要約は lib/types.ts の UserMemorySettings として端末内保存されるほか、
 * Googleアカウント連携が有効なら lib/googleDriveSync.ts 経由でドライブにも同期され、
 * 別端末でも引き継がれる。
 */

import { requestSimpleCompletion } from "./ai";
import { AiProviderSettings, BillingSettings, ChatMessage, UserMemorySettings } from "./types";

/** これくらいのメッセージが新しく積み重なったら要約を更新する目安 */
export const MEMORY_UPDATE_INTERVAL_MESSAGES = 8;

/** 要約テキストの目安上限(文字数)。長くなりすぎるとコンテキスト消費が増えるため軽く制限する */
const SUMMARY_SOFT_LIMIT = 500;

const SUMMARY_SYSTEM_PROMPT =
  "あなたは相談用対話アプリの裏側で動く、記憶の要約係です。相談内容そのものへの返答はせず、" +
  "次回以降の会話でAIが参照する「利用者についての短いメモ」を日本語で作成・更新するだけの役割です。\n" +
  "含めるとよい内容の例: 呼び方の希望、話し方の好み、最近繰り返し話題に出ること、大事にしている価値観、" +
  "継続している状況(仕事・体調・人間関係など、本人が繰り返し言及したもの)。\n" +
  "含めないこと: 一度きりの些細な発言、個人を特定できる情報(氏名・住所・連絡先など)、" +
  "自傷・希死念慮に関する具体的な方法や描写(そのような話題があったこと自体は" +
  "「継続して注意を向けるべき状況」として一般的な言葉で触れる程度に留める)。\n" +
  `日本語で、${SUMMARY_SOFT_LIMIT}文字以内の箇条書きではない短い文章でまとめてください。前回までの要約がある場合は、` +
  "書き直すのではなく必要な部分だけを更新・追記する形にしてください。";

export interface MemoryUpdateResult {
  memory: UserMemorySettings;
  /** 要約生成に失敗した場合。呼び出し側は前回の記憶をそのまま使い続けてよい */
  error?: string;
}

/**
 * 直近のやり取りから、記憶の要約を更新する。
 * 失敗しても例外は投げず、前回の要約を保ったまま error 付きで返す
 * (記憶の更新は「できればやる」機能であり、会話本体を止める理由にはしない)。
 */
export async function updateUserMemory(
  previousMemory: UserMemorySettings,
  recentMessages: ChatMessage[],
  aiSettings: AiProviderSettings,
  billing: BillingSettings
): Promise<MemoryUpdateResult> {
  if (recentMessages.length === 0) {
    return { memory: previousMemory };
  }
  const transcript = recentMessages
    .slice(-20)
    .map((m) => `${m.role === "assistant" ? "AI" : "利用者"}: ${m.text}`)
    .join("\n");
  const userPrompt =
    (previousMemory.summary ? `これまでの記憶:\n${previousMemory.summary}\n\n` : "") +
    `直近の会話:\n${transcript}\n\n` +
    "上記を踏まえて、記憶を更新してください。";

  try {
    const summary = await requestSimpleCompletion(
      SUMMARY_SYSTEM_PROMPT,
      userPrompt,
      aiSettings,
      billing
    );
    return {
      memory: {
        summary: summary.slice(0, SUMMARY_SOFT_LIMIT * 2),
        updatedAt: Date.now(),
      },
    };
  } catch (e) {
    return {
      memory: previousMemory,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
