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
export type TtsProviderId = "system" | "voicevox" | "google" | "voicevox_local";

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

/**
 * 「VOICEVOXをアプリに内蔵する」機能(Android限定・実験的)の設定。
 * サーバー(voicevoxSettings)とは別に、端末にダウンロードした音声モデル(VVM)を
 * 使って直接合成する。ダウンロード済みファイルの一覧はディスク上の実体から
 * 判定するため、ここでは「今どのスタイルを使うか」だけを保持する。
 * 詳細は lib/localVoicevox.ts, modules/voicevox-local/ 参照。
 */
export interface LocalVoicevoxSettings {
  /** 選択中のスタイルID。未選択ならnull */
  selectedStyleId: number | null;
}

export interface VoiceSettings {
  provider: TtsProviderId;
  /** provider="system" のときに使う、端末/ブラウザ内蔵ボイスのID */
  selectedVoiceId: string | null;
  voicevox: VoicevoxSettings;
  google: GoogleTtsSettings;
  localVoicevox: LocalVoicevoxSettings;
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
 * - "admin": 管理者(のメールアドレス)による無償の全機能開放
 *
 * 課金・管理者判定は、この端末で連携しているGoogleアカウントの
 * メールアドレス単位で行う(以前あった「端末ごとのランダムなコード」方式は廃止)。
 * サブスクへの加入・状態確認には google.connected が true である必要がある。
 * 詳細は lib/billing.ts, lib/googleAuth.ts, README「7.」参照。
 */
export type LicenseStatus = "unknown" | "checking" | "none" | "active" | "admin";

export interface BillingSettings {
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

/**
 * Googleアカウント連携(履歴の引き継ぎ・AIの記憶の同期)の設定。
 *
 * サインイン自体のトークンはOSのアカウント管理(Android: Google Play services /
 * Web: 短時間のアクセストークンのみ)に任せ、ここには「今どのアカウントに
 * 繋がっているか」の表示用情報と同期状況だけを保持する。
 * 実際の会話ログ・記憶データは端末内保存に加えて、そのGoogleアカウント自身の
 * ドライブ(アプリ専用の非公開領域=appDataFolder)に保存する。
 * 開発者のサーバーには一切送信・保存されない(既存の設計方針と同じ)。
 * 詳細は lib/googleAuth.ts, lib/googleDriveSync.ts, README「7.」参照。
 */
export interface GoogleAccountSettings {
  connected: boolean;
  /** 表示用。実際の同一アカウント判定はOS側のサインイン状態そのものに任せる */
  email: string | null;
  /** 最後にGoogleドライブとの同期に成功した時刻(UNIXミリ秒) */
  lastSyncedAt: number | null;
}

/**
 * AIが会話から要約して覚えている、利用者についての短い記憶(ChatGPTの「メモリ」に近い)。
 * Googleドライブ経由で同期されるため、別端末で同じGoogleアカウントに
 * サインインすると引き継がれる。
 */
export interface UserMemorySettings {
  /** 要約テキスト本文。空文字なら「まだ記憶なし」 */
  summary: string;
  updatedAt: number | null;
}

export interface AppSettings {
  persona: PersonaSettings;
  voice: VoiceSettings;
  ai: AiProviderSettings;
  billing: BillingSettings;
  theme: ThemeSettings;
  google: GoogleAccountSettings;
  userMemory: UserMemorySettings;
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
    localVoicevox: {
      selectedStyleId: null,
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
    status: "unknown",
    expiresAt: null,
    lastCheckedAt: null,
  },
  theme: {
    presetId: "default",
    customColors: null,
  },
  google: {
    connected: false,
    email: null,
    lastSyncedAt: null,
  },
  userMemory: {
    summary: "",
    updatedAt: null,
  },
  onboardingDone: false,
};
