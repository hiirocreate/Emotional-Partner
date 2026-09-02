import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppSettings, ChatMessage, DEFAULT_SETTINGS } from "./types";

const SETTINGS_KEY = "kokorotalk.settings.v1";
const HISTORY_KEY = "kokorotalk.history.v1";

/**
 * 設定・会話履歴はすべて端末内(AsyncStorage)にのみ保存する。
 * サーバーを持たない無料構成のため、外部にデータが送られるのは
 * ユーザーが設定したAI APIへの問い合わせ時のみ。
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    // 将来的な項目追加に備えてデフォルト値とマージする
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      persona: { ...DEFAULT_SETTINGS.persona, ...parsed.persona },
      voice: {
        ...DEFAULT_SETTINGS.voice,
        ...parsed.voice,
        voicevox: {
          ...DEFAULT_SETTINGS.voice.voicevox,
          ...parsed.voice?.voicevox,
        },
        google: {
          ...DEFAULT_SETTINGS.voice.google,
          ...parsed.voice?.google,
        },
        localVoicevox: {
          ...DEFAULT_SETTINGS.voice.localVoicevox,
          ...parsed.voice?.localVoicevox,
        },
      },
      ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai },
      billing: { ...DEFAULT_SETTINGS.billing, ...parsed.billing },
      google: { ...DEFAULT_SETTINGS.google, ...parsed.google },
      userMemory: { ...DEFAULT_SETTINGS.userMemory, ...parsed.userMemory },
      theme: {
        ...DEFAULT_SETTINGS.theme,
        ...parsed.theme,
        customColors: parsed.theme?.customColors
          ? { ...parsed.theme.customColors }
          : null,
      },
    };
  } catch (e) {
    console.warn("設定の読み込みに失敗しました", e);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function loadHistory(): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.warn("会話履歴の読み込みに失敗しました", e);
    return [];
  }
}

export async function saveHistory(messages: ChatMessage[]): Promise<void> {
  // 端末容量を圧迫しないよう直近200件までに制限
  const trimmed = messages.slice(-200);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
