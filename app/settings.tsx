import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";

import { PERSONA_PRESETS } from "../lib/personas";
import { isBillingConfigured, isSharedProxyConfigured } from "../lib/config";
import { connectOpenRouterAccount } from "../lib/openrouterOAuth";
import {
  BillingCheckError,
  buildSubscribeUrl,
  checkLicenseStatus,
  generateLicenseCode,
  hasPaidAccess,
} from "../lib/billing";
import { clearHistory, loadSettings, saveSettings } from "../lib/storage";
import { AiConnectionMode, AppSettings, PersonaPresetId, TtsProviderId, VoiceOption } from "../lib/types";
import { listAvailableVoices, listVoicevoxSpeakers, speakText } from "../lib/voiceOutput";

// 共有プロキシ経由で選べるモデル(proxy-worker側のALLOWED_MODELSと合わせること)
const PROXY_MODEL_PRESETS = [
  {
    label: "高速重視",
    model: "llama-3.1-8b-instant",
    note: "最速クラスの応答(参考値: 500〜600トークン/秒)。日常会話にはこちらがおすすめです。",
  },
  {
    label: "精度重視",
    model: "llama-3.3-70b-versatile",
    note: "高速重視より少し時間がかかりますが、文脈理解や表現の自然さが向上します。",
  },
];

// 「自分のAPIキーを使う」モード用のプリセット
const CUSTOM_AI_PROVIDER_PRESETS = [
  {
    label: "Groq: 高速重視",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    note: "最速クラスの応答(参考値: 500〜600トークン/秒)。日常会話にはこちらがおすすめです。",
  },
  {
    label: "Groq: 精度重視",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    note: "高速重視より少し時間がかかりますが、文脈理解や表現の自然さが向上します。",
  },
  {
    label: "OpenRouter (無料モデル)",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.1-8b-instruct:free",
    note: "openrouter.ai で無料枠のAPIキーを発行できます(:free モデルのみ利用)。",
  },
];

const GROQ_MODELS_DOC_URL = "https://console.groq.com/docs/models";
const GROQ_KEYS_URL = "https://console.groq.com/keys";
const OPENROUTER_PRESET = CUSTOM_AI_PROVIDER_PRESETS[2]; // "OpenRouter (無料モデル)"

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [systemVoices, setSystemVoices] = useState<VoiceOption[]>([]);
  const [voicevoxSpeakers, setVoicevoxSpeakers] = useState<VoiceOption[]>([]);
  const [voicevoxUrlDraft, setVoicevoxUrlDraft] = useState("");
  const [voicevoxLoading, setVoicevoxLoading] = useState(false);
  const [voicevoxError, setVoicevoxError] = useState<string | null>(null);
  const [customPersonaText, setCustomPersonaText] = useState("");
  const [openRouterConnecting, setOpenRouterConnecting] = useState(false);
  const [licenseCodeDraft, setLicenseCodeDraft] = useState("");
  const [billingChecking, setBillingChecking] = useState(false);

  useEffect(() => {
    (async () => {
      let s = await loadSettings();
      // この端末用のライセンスコードがまだ無ければ生成して保存しておく
      if (!s.billing.licenseCode) {
        s = { ...s, billing: { ...s.billing, licenseCode: generateLicenseCode() } };
        await saveSettings(s);
      }
      setSettings(s);
      setCustomPersonaText(s.persona.customDescription);
      setVoicevoxUrlDraft(s.voice.voicevox.baseUrl);
      setLicenseCodeDraft(s.billing.licenseCode);
      const v = await listAvailableVoices();
      setSystemVoices(v);
      if (s.voice.voicevox.baseUrl) {
        fetchVoicevoxSpeakers(s.voice.voicevox.baseUrl, false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!settings) return null;

  const update = (updater: (draft: AppSettings) => AppSettings) => {
    setSettings((prev) => (prev ? updater(prev) : prev));
  };

  const persist = async (next: AppSettings) => {
    setSettings(next);
    await saveSettings(next);
  };

  const onSelectPersona = (id: PersonaPresetId) => {
    persist({ ...settings, persona: { ...settings.persona, presetId: id } });
  };

  const onBlurCustomDescription = () => {
    persist({
      ...settings,
      persona: { ...settings.persona, customDescription: customPersonaText },
    });
  };

  const onSelectTtsProvider = (provider: TtsProviderId) => {
    if (provider === "voicevox" && !hasPaidAccess(settings.billing)) {
      Alert.alert(
        "有料プランが必要です",
        "VOICEVOX(端末にない読み上げボイス)のご利用には、有料プランへの加入または管理者コードの入力が必要です。下の「利用プラン」欄からご確認ください。"
      );
      return;
    }
    persist({ ...settings, voice: { ...settings.voice, provider } });
  };

  const onSelectSystemVoice = (id: string) => {
    persist({ ...settings, voice: { ...settings.voice, selectedVoiceId: id } });
  };

  const onSelectVoicevoxSpeaker = (id: string) => {
    persist({
      ...settings,
      voice: {
        ...settings.voice,
        voicevox: { ...settings.voice.voicevox, speakerId: Number(id) },
      },
    });
  };

  const fetchVoicevoxSpeakers = async (baseUrl: string, persistUrl: boolean) => {
    if (!baseUrl.trim()) return;
    setVoicevoxLoading(true);
    setVoicevoxError(null);
    try {
      const speakers = await listVoicevoxSpeakers(baseUrl);
      setVoicevoxSpeakers(speakers);
      if (persistUrl) {
        await persist({
          ...settings,
          voice: { ...settings.voice, voicevox: { ...settings.voice.voicevox, baseUrl } },
        });
      }
    } catch (e) {
      setVoicevoxError(
        e instanceof Error
          ? e.message
          : "VOICEVOXエンジンに接続できませんでした。URLを確認してください。"
      );
      setVoicevoxSpeakers([]);
    } finally {
      setVoicevoxLoading(false);
    }
  };

  const onToggleAutoSpeak = (value: boolean) => {
    persist({ ...settings, voice: { ...settings.voice, autoSpeak: value } });
  };

  const adjustRate = (delta: number) => {
    const rate = clamp(settings.voice.rate + delta, 0.5, 1.8);
    persist({ ...settings, voice: { ...settings.voice, rate } });
  };

  const adjustPitch = (delta: number) => {
    const pitch = clamp(settings.voice.pitch + delta, 0.5, 1.8);
    persist({ ...settings, voice: { ...settings.voice, pitch } });
  };

  const onSelectAiMode = (mode: AiConnectionMode) => {
    if (mode === "proxy" && settings.ai.mode !== "proxy" && !hasPaidAccess(settings.billing)) {
      Alert.alert(
        "有料プランが必要です",
        "備え付けのAI(共有プロキシ)のご利用には、有料プランへの加入または管理者コードの入力が必要です。上の「利用プラン」欄からご確認いただくか、「自分のAPIキーを使う」をお使いください。"
      );
      return;
    }
    if (mode === "proxy") {
      persist({
        ...settings,
        ai: {
          ...settings.ai,
          mode,
          providerLabel: "共有プロキシ（設定不要）",
          baseUrl: "",
          apiKey: "",
          model: PROXY_MODEL_PRESETS.some((p) => p.model === settings.ai.model)
            ? settings.ai.model
            : PROXY_MODEL_PRESETS[0].model,
        },
      });
    } else {
      const preset = CUSTOM_AI_PROVIDER_PRESETS[0];
      persist({
        ...settings,
        ai: {
          ...settings.ai,
          mode,
          providerLabel: preset.label,
          baseUrl: preset.baseUrl,
          model: preset.model,
        },
      });
    }
  };

  const applyProxyModelPreset = (preset: (typeof PROXY_MODEL_PRESETS)[number]) => {
    persist({ ...settings, ai: { ...settings.ai, providerLabel: preset.label, model: preset.model } });
  };

  const applyProviderPreset = (preset: (typeof CUSTOM_AI_PROVIDER_PRESETS)[number]) => {
    persist({
      ...settings,
      ai: {
        ...settings.ai,
        providerLabel: preset.label,
        baseUrl: preset.baseUrl,
        model: preset.model,
      },
    });
  };

  const onChangeApiKey = (key: string) => {
    update((d) => ({ ...d, ai: { ...d.ai, apiKey: key } }));
  };
  const onBlurApiKey = () => persist(settings);

  const handleOpenRouterConnect = async () => {
    if (openRouterConnecting) return;
    setOpenRouterConnecting(true);
    try {
      const apiKey = await connectOpenRouterAccount();
      if (apiKey) {
        await persist({
          ...settings,
          ai: {
            ...settings.ai,
            mode: "custom",
            providerLabel: OPENROUTER_PRESET.label,
            baseUrl: OPENROUTER_PRESET.baseUrl,
            model: OPENROUTER_PRESET.model,
            apiKey,
          },
        });
        Alert.alert("接続しました", "OpenRouterのAPIキーを自動で設定しました。このまま会話を始められます。");
      }
      // apiKeyがnull(利用者がキャンセル)の場合は何もしない
    } catch (e) {
      Alert.alert(
        "接続できませんでした",
        e instanceof Error ? e.message : "しばらくしてから再度お試しください。"
      );
    } finally {
      setOpenRouterConnecting(false);
    }
  };

  const handleOpenGroqKeysPage = () => {
    Linking.openURL(GROQ_KEYS_URL);
  };

  const handlePasteApiKey = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) {
      Alert.alert("クリップボードが空です", "先にAPIキーをコピーしてから、もう一度お試しください。");
      return;
    }
    await persist({ ...settings, ai: { ...settings.ai, apiKey: text.trim() } });
  };

  const onChangeModel = (model: string) => {
    update((d) => ({ ...d, ai: { ...d.ai, model } }));
  };
  const onBlurModel = () => persist(settings);

  const onChangeLicenseCode = (v: string) => setLicenseCodeDraft(v);
  const onBlurLicenseCode = () => {
    if (licenseCodeDraft.trim() === settings.billing.licenseCode) return;
    persist({
      ...settings,
      billing: { ...settings.billing, licenseCode: licenseCodeDraft.trim(), status: "unknown", expiresAt: null },
    });
  };

  const handleCheckBillingStatus = async () => {
    if (billingChecking) return;
    const code = licenseCodeDraft.trim();
    setBillingChecking(true);
    try {
      const result = await checkLicenseStatus(code);
      await persist({
        ...settings,
        billing: {
          licenseCode: code,
          status: result.status,
          expiresAt: result.expiresAt,
          lastCheckedAt: Date.now(),
        },
      });
      if (result.status === "admin") {
        Alert.alert("確認できました", "管理者として全機能をご利用いただけます。");
      } else if (result.status === "active") {
        Alert.alert("確認できました", "有料プランが有効です。備え付けのAI・VOICEVOXがご利用いただけます。");
      } else {
        Alert.alert(
          "未加入です",
          "このコードでは有料プランが確認できませんでした。加入直後の場合は、反映まで数分かかることがあります。"
        );
      }
    } catch (e) {
      Alert.alert(
        "確認できませんでした",
        e instanceof BillingCheckError ? e.message : "しばらくしてから再度お試しください。"
      );
    } finally {
      setBillingChecking(false);
    }
  };

  const handleOpenSubscribePage = () => {
    if (!isBillingConfigured()) {
      Alert.alert(
        "準備中です",
        "有料プランの決済ページがまだ設定されていません(アプリ配布者による設定待ちです)。"
      );
      return;
    }
    Linking.openURL(buildSubscribeUrl(settings.billing.licenseCode));
  };

  const handleRegenerateLicenseCode = () => {
    Alert.alert(
      "新しいコードを発行しますか？",
      "現在のコードで既に加入済みの場合、再度この操作を行うと状態確認ができなくなることがあります。通常は操作不要です。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "発行する",
          onPress: () => {
            const next = generateLicenseCode();
            setLicenseCodeDraft(next);
            persist({ ...settings, billing: { licenseCode: next, status: "unknown", expiresAt: null, lastCheckedAt: null } });
          },
        },
      ]
    );
  };

  const onChangeCallUserAs = (v: string) => {
    update((d) => ({ ...d, persona: { ...d.persona, callUserAs: v } }));
  };
  const onBlurCallUserAs = () => persist(settings);

  const testVoice = () => {
    const voiceToUse =
      settings.voice.provider === "voicevox" && !hasPaidAccess(settings.billing)
        ? { ...settings.voice, provider: "system" as const }
        : settings.voice;
    speakText("こんにちは。この声でお話しします。", voiceToUse, {
      onError: () =>
        Alert.alert(
          "再生できませんでした",
          settings.voice.provider === "voicevox"
            ? "VOICEVOXエンジンへの接続、または話者選択を確認してください。"
            : "この端末で利用できる音声が見つかりませんでした。"
        ),
    });
  };

  const handleClearHistory = () => {
    const doClear = async () => {
      await clearHistory();
      Alert.alert("削除しました", "会話履歴を削除しました。");
    };
    if (Platform.OS === "web") {
      doClear();
    } else {
      Alert.alert("会話履歴を削除しますか？", "この操作は取り消せません。", [
        { text: "キャンセル", style: "cancel" },
        { text: "削除する", style: "destructive", onPress: doClear },
      ]);
    }
  };

  const activeVoiceList = settings.voice.provider === "voicevox" ? voicevoxSpeakers : systemVoices;
  const activeSelectedId =
    settings.voice.provider === "voicevox"
      ? settings.voice.voicevox.speakerId != null
        ? String(settings.voice.voicevox.speakerId)
        : null
      : settings.voice.selectedVoiceId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
      <Section title="AIの立場（ペルソナ）">
        <Text style={styles.helper}>
          AIにどんな立場・距離感で話してほしいかを選べます。
        </Text>
        <View style={styles.chipWrap}>
          {PERSONA_PRESETS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onSelectPersona(p.id)}
              style={[styles.chip, settings.persona.presetId === p.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.persona.presetId === p.id && styles.chipTextActive,
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.presetDesc}>
          {PERSONA_PRESETS.find((p) => p.id === settings.persona.presetId)?.description}
        </Text>

        <Text style={styles.label}>
          {settings.persona.presetId === "custom"
            ? "AIの立場を自由に記述してください"
            : "追加の希望（任意）"}
        </Text>
        <TextInput
          style={styles.multiline}
          value={customPersonaText}
          onChangeText={setCustomPersonaText}
          onBlur={onBlurCustomDescription}
          multiline
          placeholder={
            settings.persona.presetId === "custom"
              ? "例: 昔からの幼なじみのように、たまに敬語が抜けるくらい気を許した感じで話してほしい"
              : "例: 敬語よりタメ口寄りにしてほしい、など"
          }
        />

        <Text style={styles.label}>AIに呼んでほしい呼び方</Text>
        <TextInput
          style={styles.input}
          value={settings.persona.callUserAs}
          onChangeText={onChangeCallUserAs}
          onBlur={onBlurCallUserAs}
          placeholder="例: あなた / ○○さん / ニックネーム"
        />

        <Text style={styles.label}>話し方のトーン</Text>
        <View style={styles.chipWrap}>
          {(
            [
              { id: "gentle", label: "やわらか" },
              { id: "casual", label: "カジュアル" },
              { id: "polite", label: "丁寧" },
            ] as const
          ).map((t) => (
            <Pressable
              key={t.id}
              onPress={() =>
                persist({ ...settings, persona: { ...settings.persona, tone: t.id } })
              }
              style={[styles.chip, settings.persona.tone === t.id && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  settings.persona.tone === t.id && styles.chipTextActive,
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Section>

      <Section title="音声（読み上げ）">
        <View style={styles.row}>
          <Text style={styles.helper}>AIの返答を自動で読み上げる</Text>
          <Switch value={settings.voice.autoSpeak} onValueChange={onToggleAutoSpeak} />
        </View>
        <Text style={styles.smallHelper}>
          オフの場合でも、音声で話しかけたときはその返答だけ自動で読み上げます。テキスト返答は吹き出しの🔊から個別に再生できます。
        </Text>

        <Text style={styles.label}>音源</Text>
        <View style={styles.chipWrap}>
          <Pressable
            onPress={() => onSelectTtsProvider("system")}
            style={[styles.chip, settings.voice.provider === "system" && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                settings.voice.provider === "system" && styles.chipTextActive,
              ]}
            >
              端末/ブラウザ内蔵ボイス
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSelectTtsProvider("voicevox")}
            style={[styles.chip, settings.voice.provider === "voicevox" && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                settings.voice.provider === "voicevox" && styles.chipTextActive,
              ]}
            >
              VOICEVOX（キャラクターボイス）
            </Text>
          </Pressable>
        </View>

        {settings.voice.provider === "voicevox" ? (
          <>
            {!hasPaidAccess(settings.billing) ? (
              <Text style={styles.errorHelper}>
                VOICEVOXは有料プランの方のみご利用いただけます。下の「利用プラン」から加入するか、管理者コードを入力してください(有効になるまでは端末内蔵ボイスで読み上げられます)。
              </Text>
            ) : null}
            <Text style={styles.smallHelper}>
              無料・オープンソースのVOICEVOX ENGINEを自分でホスティングし、そのURLを入力してください。スリープなしで場所を問わず使うための推奨構成(Oracle Cloud常時無料VM + HTTPS化)はREADMEを参照してください。
            </Text>
            <Text style={styles.label}>VOICEVOX ENGINE の URL</Text>
            <TextInput
              style={styles.input}
              value={voicevoxUrlDraft}
              onChangeText={setVoicevoxUrlDraft}
              autoCapitalize="none"
              placeholder="例: https://yourname.duckdns.org"
            />
            <Pressable
              style={styles.testButton}
              onPress={() => fetchVoicevoxSpeakers(voicevoxUrlDraft, true)}
              disabled={voicevoxLoading}
            >
              {voicevoxLoading ? (
                <ActivityIndicator size="small" color="#2F5BD9" />
              ) : (
                <Text style={styles.testButtonText}>接続して話者一覧を取得</Text>
              )}
            </Pressable>
            {voicevoxError ? <Text style={styles.errorHelper}>{voicevoxError}</Text> : null}
          </>
        ) : null}

        <Text style={styles.label}>
          {settings.voice.provider === "voicevox"
            ? `話者（${activeVoiceList.length}種類）`
            : `読み上げボイス（${activeVoiceList.length}種類から選択）`}
        </Text>
        {activeVoiceList.length === 0 ? (
          <Text style={styles.smallHelper}>
            {settings.voice.provider === "voicevox"
              ? "まだ話者を取得していません。上のURLを入力して「接続して話者一覧を取得」を押してください。"
              : "利用可能な音声を検出できませんでした。端末/ブラウザの音声合成設定をご確認ください。"}
          </Text>
        ) : (
          <View style={styles.chipWrap}>
            {activeVoiceList.map((v) => (
              <Pressable
                key={v.id}
                onPress={() =>
                  settings.voice.provider === "voicevox"
                    ? onSelectVoicevoxSpeaker(v.id)
                    : onSelectSystemVoice(v.id)
                }
                style={[styles.chip, activeSelectedId === v.id && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, activeSelectedId === v.id && styles.chipTextActive]}
                >
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.testButton} onPress={testVoice}>
          <Text style={styles.testButtonText}>▶ この声を試聴する</Text>
        </Pressable>

        <View style={styles.stepperRow}>
          <Text style={styles.label}>速さ: {settings.voice.rate.toFixed(2)}</Text>
          <View style={styles.stepperButtons}>
            <StepperBtn label="－" onPress={() => adjustRate(-0.1)} />
            <StepperBtn label="＋" onPress={() => adjustRate(0.1)} />
          </View>
        </View>
        <View style={styles.stepperRow}>
          <Text style={styles.label}>高さ: {settings.voice.pitch.toFixed(2)}</Text>
          <View style={styles.stepperButtons}>
            <StepperBtn label="－" onPress={() => adjustPitch(-0.1)} />
            <StepperBtn label="＋" onPress={() => adjustPitch(0.1)} />
          </View>
        </View>
      </Section>

      <Section title="利用プラン">
        <Text style={styles.helper}>
          「備え付けのAI」(共有プロキシ経由の対話AI)とVOICEVOX(端末にない読み上げボイス)は、有料プランへの加入、または管理者コードの入力が必要な機能です。「自分のAPIキーを使う」モードと端末/ブラウザ内蔵ボイスは、プラン状態に関わらず無料でお使いいただけます。
        </Text>

        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>
            現在のプラン:{" "}
            {settings.billing.status === "admin"
              ? "管理者(全機能開放)"
              : settings.billing.status === "active"
              ? "有料プラン加入中"
              : settings.billing.status === "checking"
              ? "確認中…"
              : "未加入"}
          </Text>
        </View>

        {!isBillingConfigured() ? (
          <Text style={styles.errorHelper}>
            決済ページが未設定です(アプリ配布者による設定待ちです)。設定が完了するまでは有料機能はご利用いただけません。
          </Text>
        ) : null}

        <Text style={styles.label}>あなたのコード</Text>
        <TextInput
          style={styles.input}
          value={licenseCodeDraft}
          onChangeText={onChangeLicenseCode}
          onBlur={onBlurLicenseCode}
          autoCapitalize="characters"
          placeholder="例: KTLK-AB12-CD34"
        />
        <Text style={styles.smallHelper}>
          購入時にこのコードで加入状況を識別します。管理者の方は、この欄に管理者コードを直接入力して「状態を確認」を押してください。
        </Text>

        <View style={styles.chipWrap}>
          <Pressable style={styles.primaryButton} onPress={handleOpenSubscribePage}>
            <Text style={styles.primaryButtonText}>💳 加入ページを開く</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.secondaryButton, billingChecking && styles.primaryButtonDisabled]}
          onPress={handleCheckBillingStatus}
          disabled={billingChecking}
        >
          {billingChecking ? (
            <ActivityIndicator size="small" color="#2F5BD9" />
          ) : (
            <Text style={styles.secondaryButtonText}>🔄 状態を確認</Text>
          )}
        </Pressable>

        <Pressable onPress={handleRegenerateLicenseCode}>
          <Text style={styles.linkText}>新しいコードを発行する</Text>
        </Pressable>
      </Section>

      <Section title="対話AIの接続設定">
        <Text style={styles.helper}>
          返答はストリーミング表示され、生成され次第すぐに読めます。
        </Text>
        <View style={styles.chipWrap}>
          <Pressable
            onPress={() => onSelectAiMode("proxy")}
            style={[styles.chip, settings.ai.mode === "proxy" && styles.chipActive]}
          >
            <Text style={[styles.chipText, settings.ai.mode === "proxy" && styles.chipTextActive]}>
              共有プロキシを使う（設定不要）
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onSelectAiMode("custom")}
            style={[styles.chip, settings.ai.mode === "custom" && styles.chipActive]}
          >
            <Text style={[styles.chipText, settings.ai.mode === "custom" && styles.chipTextActive]}>
              自分のAPIキーを使う
            </Text>
          </Pressable>
        </View>

        {settings.ai.mode === "proxy" ? (
          <>
            <Text style={styles.smallHelper}>
              アプリ配布者が用意した共有の中継サーバーを使うため、APIキーの発行・入力は不要です。多くの人が同時に使うと混み合う場合があるので、その際は「自分のAPIキーを使う」に切り替えてください。
            </Text>
            {!isSharedProxyConfigured() ? (
              <Text style={styles.errorHelper}>
                共有プロキシが未設定です(アプリ配布者による設定待ちです)。設定が完了するまでは「自分のAPIキーを使う」をご利用ください。
              </Text>
            ) : !hasPaidAccess(settings.billing) ? (
              <Text style={styles.errorHelper}>
                備え付けのAIは有料プランの方のみご利用いただけます。上の「利用プラン」から加入するか、管理者コードを入力してください。
              </Text>
            ) : null}

            <Text style={styles.label}>速度/精度</Text>
            <View style={styles.chipWrap}>
              {PROXY_MODEL_PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => applyProxyModelPreset(p)}
                  style={[styles.chip, settings.ai.model === p.model && styles.chipActive]}
                >
                  <Text
                    style={[styles.chipText, settings.ai.model === p.model && styles.chipTextActive]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.smallHelper}>
              {PROXY_MODEL_PRESETS.find((p) => p.model === settings.ai.model)?.note}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.smallHelper}>
              無料で使えるOpenAI互換APIのプロバイダを選び、発行したAPIキーを入力してください。APIキーはこの端末にのみ保存され、外部には送信されません。
            </Text>

            <View style={styles.quickSetupBox}>
              <Text style={styles.quickSetupTitle}>かんたん接続</Text>
              <Pressable
                style={[styles.primaryButton, openRouterConnecting && styles.primaryButtonDisabled]}
                onPress={handleOpenRouterConnect}
                disabled={openRouterConnecting}
              >
                {openRouterConnecting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>🔗 OpenRouterでログインして接続</Text>
                )}
              </Pressable>
              <Text style={styles.smallHelper}>
                ボタンを押すとブラウザでOpenRouterのログイン画面が開きます。ログイン(未登録の場合は新規登録)して許可するだけで、APIキーの発行・コピー・貼り付けなしにこの端末へ自動設定されます。
              </Text>

              <Pressable style={styles.secondaryButton} onPress={handleOpenGroqKeysPage}>
                <Text style={styles.secondaryButtonText}>🌐 Groqのキー作成ページを開く</Text>
              </Pressable>
              <Text style={styles.smallHelper}>
                Groqには自動接続の仕組みが無いため、開いたページでキーを発行してコピーし、下の「クリップボードから貼り付け」で設定してください。
              </Text>
            </View>

            <View style={styles.chipWrap}>
              {CUSTOM_AI_PROVIDER_PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  onPress={() => applyProviderPreset(p)}
                  style={[
                    styles.chip,
                    settings.ai.providerLabel === p.label && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      settings.ai.providerLabel === p.label && styles.chipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.smallHelper}>
              {CUSTOM_AI_PROVIDER_PRESETS.find((p) => p.label === settings.ai.providerLabel)?.note}
            </Text>
            <Pressable onPress={() => Linking.openURL(GROQ_MODELS_DOC_URL)}>
              <Text style={styles.linkText}>
                最新のモデル一覧はこちら({GROQ_MODELS_DOC_URL})
              </Text>
            </Pressable>

            <Text style={styles.label}>モデル名</Text>
            <TextInput
              style={styles.input}
              value={settings.ai.model}
              onChangeText={onChangeModel}
              onBlur={onBlurModel}
              autoCapitalize="none"
            />

            <View style={styles.row}>
              <Text style={styles.label}>APIキー</Text>
              <Pressable onPress={handlePasteApiKey}>
                <Text style={styles.linkText}>📋 クリップボードから貼り付け</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              value={settings.ai.apiKey}
              onChangeText={onChangeApiKey}
              onBlur={onBlurApiKey}
              secureTextEntry
              autoCapitalize="none"
              placeholder="gsk_... または sk-or-... など"
            />
            {settings.ai.apiKey ? (
              <Text style={styles.okHelper}>✓ APIキーが設定されています</Text>
            ) : null}
          </>
        )}
      </Section>

      <Section title="データ">
        <Pressable style={styles.dangerButton} onPress={handleClearHistory}>
          <Text style={styles.dangerButtonText}>会話履歴を削除する</Text>
        </Pressable>
      </Section>

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>チャットに戻る</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function StepperBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.stepperBtn} onPress={onPress}>
      <Text style={styles.stepperBtnText}>{label}</Text>
    </Pressable>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(v * 100) / 100));
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  section: {
    marginBottom: 24,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8F9FC",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10, color: "#26263A" },
  helper: { fontSize: 13, color: "#5A5A70", marginBottom: 8, flexShrink: 1 },
  smallHelper: { fontSize: 11, color: "#8A8AA0", marginBottom: 10, lineHeight: 15 },
  errorHelper: { fontSize: 11, color: "#B3261E", marginBottom: 10, lineHeight: 15 },
  okHelper: { fontSize: 11, color: "#2F8F5B", marginTop: -4, marginBottom: 10 },
  planBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EDEEF5",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  planBadgeText: { fontSize: 12, fontWeight: "700", color: "#26263A" },
  quickSetupBox: {
    borderWidth: 1,
    borderColor: "#DCE4FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#F3F6FF",
    gap: 4,
  },
  quickSetupTitle: { fontSize: 13, fontWeight: "700", color: "#26263A", marginBottom: 4 },
  primaryButton: {
    backgroundColor: "#4A7DFF",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  secondaryButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: { color: "#2F5BD9", fontWeight: "600", fontSize: 13 },
  presetDesc: { fontSize: 12, color: "#8A8AA0", marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "600", color: "#4A4A60", marginTop: 8, marginBottom: 6 },
  linkText: { fontSize: 11, color: "#2F5BD9", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#DADAE6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  multiline: {
    borderWidth: 1,
    borderColor: "#DADAE6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 60,
    backgroundColor: "#fff",
    textAlignVertical: "top",
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#EDEEF5",
  },
  chipActive: { backgroundColor: "#4A7DFF" },
  chipText: { fontSize: 12, color: "#4A4A60" },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  testButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#E4EBFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  testButtonText: { color: "#2F5BD9", fontWeight: "600", fontSize: 12 },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stepperButtons: { flexDirection: "row", gap: 8 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EDEEF5",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontSize: 16, fontWeight: "700", color: "#4A4A60" },
  dangerButton: {
    backgroundColor: "#FFE9E9",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  dangerButtonText: { color: "#B3261E", fontWeight: "600", fontSize: 13 },
  backButton: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  backButtonText: { color: "#4A7DFF", fontWeight: "600" },
});
