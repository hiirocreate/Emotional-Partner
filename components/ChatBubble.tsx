import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ChatMessage } from "../lib/types";

interface SpeakCallbacks {
  onDone?: () => void;
  onError?: (error?: unknown) => void;
}

interface Props {
  message: ChatMessage;
  onSpeak?: (text: string, callbacks?: SpeakCallbacks) => void;
  /** テーマのアクセントカラー。指定時はユーザー側の吹き出し色をこれで上書きする */
  accentColor?: string;
}

export function ChatBubble({ message, onSpeak, accentColor }: Props) {
  const isUser = message.role === "user";
  // 🔊ボタンを押してから実際に音が出るまで(合成・接続待ちなどで)数秒かかることがあり、
  // 何も表示しないと「押せているのかわからない」と感じられるため、押した瞬間から
  // 再生開始/失敗までの間はローディング表示に切り替える。
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeak = () => {
    if (!onSpeak || isSpeaking) return;
    setIsSpeaking(true);
    onSpeak(message.text, {
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  return (
    <View
      style={[
        styles.row,
        { justifyContent: isUser ? "flex-end" : "flex-start" },
      ]}
    >
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          isUser && accentColor ? { backgroundColor: accentColor } : null,
        ]}
      >
        <Text style={isUser ? styles.userText : styles.aiText}>
          {message.text}
        </Text>
        <View style={styles.metaRow}>
          <Text style={isUser ? styles.userMeta : styles.aiMeta}>
            {message.inputMode === "voice" ? "🎤 音声" : "⌨️ テキスト"}
          </Text>
          {!isUser && onSpeak ? (
            <Pressable
              onPress={handleSpeak}
              disabled={isSpeaking}
              hitSlop={8}
              style={({ pressed }) => [
                styles.speakButton,
                pressed && !isSpeaking && styles.speakButtonPressed,
              ]}
            >
              {isSpeaking ? (
                <View style={styles.speakSpinner}>
                  <ActivityIndicator size="small" color="#9A9AB0" />
                </View>
              ) : (
                <Text style={styles.speakIcon}>🔊</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  bubble: {
    maxWidth: "82%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: "#4A7DFF",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: "#F1F1F6",
    borderBottomLeftRadius: 4,
  },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  aiText: { color: "#26263A", fontSize: 15, lineHeight: 21 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    marginTop: 4,
  },
  userMeta: { color: "#E4EBFF", fontSize: 10 },
  aiMeta: { color: "#9A9AB0", fontSize: 10 },
  speakIcon: { fontSize: 12 },
  speakButton: { padding: 3, borderRadius: 8 },
  // 押した瞬間に押されたことがわかるよう、押下中は薄くする
  speakButtonPressed: { opacity: 0.5, backgroundColor: "#E4E4EE" },
  speakSpinner: { width: 12, height: 12, transform: [{ scale: 0.7 }] },
});
