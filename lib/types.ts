// アプリ全体で使う型定義

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  /** このメッセージがどちらの手段で入力/出力されたか */
  inputMode: "text" | "voice";
  createdAt: number;
}

/** ユーザーが選べるAIの「立場」プリセット */
export type PersonaPresetId =
  | "friend"
  | "sibling"
  | "counselor"
  | "mentor"
  | "listener"
  | "custom";

export interface PersonaSettings {
  presetId: PersonaPresetId;
  /** プリセットの追加カスタム説明、または custom 選択時の全文 */
  customDescription: string;
  /** 話し方のトーン */
  tone: "gentle" | "casual" | "polite";
  /** 相談者の呼び方 */
  callUserAs: string;
}

/** 音声合成(TTS)の音源プロバイダ */
export type TtsProviderId = "system" | "voicevox";

export interface VoiceOption {
  id: string; // OS/ブラウザ、またはVOICEVOXが返すvoice/speaker identifier
  label: string; // UI表示名
  lang: string;
}

export interface VoicevoxSettings {
  /** VOICEVOX ENGINE のベースURL 例: http://192.168.1.10:50021 */
  baseUrl: string;
  /** 選択中の話者スタイルID */
  speakerId: number | null;
}

export interface VoiceSettings {
  provider: TtsProviderId;
  /** provider="system" のときに使う、端末/ブラウザ内蔵ボイスのID */
  selectedVoiceId: string | null;
  voicevox: VoicevoxSettings;
  autoSpeak: boolean; // AIの返答を自動で読み上げるか
  rate: number;
  pitch: number;
}

/**
 * 対話生成AIへの接続モード。
 * - "proxy": 開発者が用意した共有プロキシ(Cloudflare Workers)を使う。
 *   利用者はAPIキーの発行・入力が不要で、すぐに使い始められる。
 * - "custom": 利用者自身のOpenAI互換API(Groq/OpenRouter等)のキーを使う。
 *   共有プロキシのレート制限に縛られたくない場合や、別プロバイダを試したい場合向け。
 */
export type AiConnectionMode = "proxy" | "custom";

/** LLM(対話生成)プロバイダ設定。OpenAI互換APIであれば切り替え可能な構成にしてある */
export interface AiProviderSettings {
  mode: AiConnectionMode;
  /** 表示用プリセット名。free入力のendpoint/modelをそのまま使う */
  providerLabel: string;
  baseUrl: string; // 例: https://api.groq.com/openai/v1 ("custom"モードのみ使用)
  apiKey: string; // "custom"モードのみ使用
  model: string;
}

export interface AppSettings {
  persona: PersonaSettings;
  voice: VoiceSettings;
  ai: AiProviderSettings;
  onboardingDone: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  persona: {
    presetId: "listener",
    customDescription: "",
    tone: "gentle",
    callUserAs: "あなた",
  },
  voice: {
    provider: "system",
    selectedVoiceId: null,
    voicevox: {
      baseUrl: "",
      speakerId: null,
    },
    autoSpeak: false,
    rate: 1.0,
    pitch: 1.0,
  },
  ai: {
    mode: "proxy",
    providerLabel: "共有プロキシ（設定不要）",
    baseUrl: "",
    apiKey: "",
    model: "llama-3.1-8b-instant",
  },
  onboardingDone: false,
};
