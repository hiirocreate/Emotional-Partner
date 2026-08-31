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
export type TtsProviderId = "system" | "voicevox" | "google";

export interface VoiceOption {
  id: string; // OS/ブラウザ、またはVOICEVOX/Google Cloud TTSが返すvoice/speaker identifier
  label: string; // UI表示名
  lang: string;
}

export interface VoicevoxSettings {
  /** VOICEVOX ENGINE のベースURL 例: http://192.168.1.10:50021 */
  baseUrl: string;
  /** 選択中の話者スタイルID */
  speakerId: number | null;
}

/**
 * Google Cloud Text-to-Speech の設定。
 * 常時稼働サーバーが不要な代替手段として、利用者自身のAPIキーで
 * 直接Google CloudのTTS APIを呼び出す(「自分のAPIキーを使う」AI接続と同じ考え方)。
 */
export interface GoogleTtsSettings {
  apiKey: string;
  /** 選択中の音声名 例: ja-JP-Neural2-B */
  voiceName: string | null;
}

export interface VoiceSettings {
  provider: TtsProviderId;
  /** provider="system" のときに使う、端末/ブラウザ内蔵ボイスのID */
  selectedVoiceId: string | null;
  voicevox: VoicevoxSettings;
  google: GoogleTtsSettings;
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

/**
 * 利用プラン(サブスクリプション)のステータス。
 * - "unknown": まだ一度も確認していない
 * - "checking": サーバーに問い合わせ中
 * - "none": 未加入(有料機能は利用不可)
 * - "active": 有料プラン加入中
 * - "admin": 管理者コードによる無償の全機能開放
 */
export type LicenseStatus = "unknown" | "checking" | "none" | "active" | "admin";

export interface BillingSettings {
  /** この端末用に生成された識別コード。購入時の紐付けや管理者コード入力に使う */
  licenseCode: string;
  status: LicenseStatus;
  /** サブスクの有効期限(UNIXミリ秒)。管理者/期限なしの場合はnull */
  expiresAt: number | null;
  /** 最後にサーバーへ状態確認した時刻(UNIXミリ秒) */
  lastCheckedAt: number | null;
}

/**
 * 配色テーマ。プラン状態によって編集できる範囲が変わる:
 * - 管理者: customColorsを自由に設定できる(最優先で適用される)
 * - サブスク(有料プラン): presetIdをプリセットの中から選べる
 * - 無料: 常にデフォルト配色(下記どちらの項目も無視される)
 */
export type ThemePresetId = "default" | "ocean" | "sunset" | "forest" | "lavender" | "mono";

export interface CustomThemeColors {
  baseColor: string;
  buttonColor: string;
  textColor: string;
}

export interface ThemeSettings {
  presetId: ThemePresetId;
  /** 管理者のみが設定できる自由な配色。nullでない場合、presetIdより優先される */
  customColors: CustomThemeColors | null;
}

export interface AppSettings {
  persona: PersonaSettings;
  voice: VoiceSettings;
  ai: AiProviderSettings;
  billing: BillingSettings;
  theme: ThemeSettings;
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
    google: {
      apiKey: "",
      voiceName: null,
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
    model: "openai/gpt-oss-20b",
  },
  billing: {
    licenseCode: "",
    status: "unknown",
    expiresAt: null,
    lastCheckedAt: null,
  },
  theme: {
    presetId: "default",
    customColors: null,
  },
  onboardingDone: false,
};
