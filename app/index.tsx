import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatBubble } from "../components/ChatBubble";
import { VoiceButton } from "../components/VoiceButton";
import { streamAiReply, AiConfigError, AiRequestError } from "../lib/ai";
import { hasPaidAccess } from "../lib/billing";
import { loadHistory, loadSettings, saveHistory } from "../lib/storage";
import { AppSettings, ChatMessage } from "../lib/types";
import { useVoiceInput } from "../lib/voiceInput";
import { speakText, stopSpeaking } from "../lib/voiceOutput";

/** VOICEVOXの利用にはサブスク(または管理者コード)が必要なため、権利がない場合は端末内蔵ボイスへ自動フォールバックする */
function speakWithGate(text: string, settings: AppSettings, callbacks?: Parameters<typeof speakText>[2]) {
  if (settings.voice.provider === "voicevox" && !hasPaidAccess(settings.billing)) {
    speakText(text, { ...settings.voice, provider: "system" }, callbacks);
    return;
  }
  speakText(text, settings.voice, callbacks);
}

const APP_DISCLAIMER =
  "このアプリはテスト版のツールであり、医療行為・診断・治療の代わりにはなりません。";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const activeStreamRef = useRef<{ abort: () => void } | null>(null);

  useEffect(() => {
    (async () => {
      const [s, h] = await Promise.all([loadSettings(), loadHistory()]);
      setSettings(s);
      setMessages(h);
    })();
    return () => {
      activeStreamRef.current?.abort();
    };
  }, []);

  // チャット画面は最初の1回しかマウントされない(設定画面から戻ってきても
  // アンマウントされない)ため、通常のuseEffectだけでは設定画面での変更
  // (プラン状態の確認結果、AI/VOICEVOX設定など)がチャット画面に反映されない。
  // 画面にフォーカスが戻るたびに設定を読み直すことで同期させる。
  useFocusEffect(
    useCallback(() => {
      loadSettings().then(setSettings);
    }, [])
  );

  const persistMessages = useCallback((next: ChatMessage[]) => {
    setMessages(next);
    saveHistory(next);
  }, []);

  const sendMessage = useCallback(
    async (text: string, inputMode: "text" | "voice") => {
      if (!text.trim() || !settings) return;
      setErrorBanner(null);

      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        text: text.trim(),
        inputMode,
        createdAt: Date.now(),
      };

      const working = [...messages, userMsg];
      persistMessages(working);
      setInputText("");
      setIsSending(true);
      setStreamingText("");

      const { promise, abort } = streamAiReply(
        working,
        settings.persona,
        settings.ai,
        settings.billing,
        (partial) => setStreamingText(partial)
      );
      activeStreamRef.current = { abort };

      try {
        const reply = await promise;
        const aiMsg: ChatMessage = {
          id: makeId(),
          role: "assistant",
          text: reply,
          inputMode,
          createdAt: Date.now(),
        };
        persistMessages([...working, aiMsg]);

        const shouldSpeak = settings.voice.autoSpeak || inputMode === "voice";
        if (shouldSpeak) {
          speakWithGate(reply, settings);
        }
      } catch (e) {
        if (e instanceof AiConfigError || e instanceof AiRequestError) {
          setErrorBanner(e.message);
        } else {
          setErrorBanner("予期しないエラーが発生しました。");
        }
      } finally {
        setStreamingText(null);
        setIsSending(false);
        activeStreamRef.current = null;
      }
    },
    [messages, settings, persistMessages]
  );

  const voice = useVoiceInput((finalText) => {
    sendMessage(finalText, "voice");
  });

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, streamingText]);

  if (!settings) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const displayMessages: ChatMessage[] =
    streamingText != null
      ? [
          ...messages,
          {
            id: "__streaming__",
            role: "assistant",
            text: streamingText || "…",
            inputMode: "text",
            createdAt: 0,
          },
        ]
      : messages;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={styles.headerBar}>
        <Text style={styles.disclaimer} numberOfLines={2}>
          {APP_DISCLAIMER}
        </Text>
        <Pressable onPress={() => router.push("/settings")} hitSlop={10}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </Pressable>
      </View>

      {errorBanner ? (
        <Pressable style={styles.errorBanner} onPress={() => setErrorBanner(null)}>
          <Text style={styles.errorText}>{errorBanner}</Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={listRef}
        data={displayMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <ChatBubble
            message={item}
            onSpeak={
              item.role === "assistant" && item.id !== "__streaming__"
                ? (t) => speakWithGate(t, settings)
                : undefined
            }
          />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>こんにちは。</Text>
            <Text style={styles.emptyBody}>
              今日はどんなことを話しましょうか。テキストでも、マイクボタンから声でも相談できます。
            </Text>
          </View>
        }
      />

      {voice.interimText ? (
        <View style={styles.interimBar}>
          <Text style={styles.interimText}>{voice.interimText}</Text>
        </View>
      ) : null}
      {voice.error ? (
        <View style={styles.interimBar}>
          <Text style={styles.interimError}>{voice.error}</Text>
        </View>
      ) : null}

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <VoiceButton
          isListening={voice.isListening}
          disabled={isSending}
          onPress={() => {
            stopSpeaking();
            voice.isListening ? voice.stop() : voice.start();
          }}
        />
        <TextInput
          style={styles.textInput}
          placeholder="ここに入力…"
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!isSending}
        />
        <Pressable
          style={[styles.sendButton, (isSending || !inputText.trim()) && styles.sendDisabled]}
          disabled={isSending || !inputText.trim()}
          onPress={() => sendMessage(inputText, "text")}
        >
          {isSending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>送信</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFF7E0",
    borderBottomWidth: 1,
    borderBottomColor: "#F0E4B8",
  },
  disclaimer: { flex: 1, fontSize: 11, color: "#7A6A2E", lineHeight: 15 },
  settingsIcon: { fontSize: 20 },
  errorBanner: {
    backgroundColor: "#FFE9E9",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorText: { color: "#B3261E", fontSize: 13 },
  emptyState: { padding: 28, alignItems: "center", marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#26263A" },
  emptyBody: { fontSize: 14, color: "#6C6C80", textAlign: "center", lineHeight: 20 },
  interimBar: { paddingHorizontal: 16, paddingVertical: 4 },
  interimText: { color: "#8A8AA0", fontStyle: "italic" },
  interimError: { color: "#B3261E", fontSize: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEEEF3",
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DADAE6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: "#4A7DFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { color: "#fff", fontWeight: "600" },
});
