import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChatMessage } from "../lib/types";

interface Props {
  message: ChatMessage;
  onSpeak?: (text: string) => void;
  /** テーマのアクセントカラー。指定時はユーザー側の吹き出し色をこれで上書きする */
  accentColor?: string;
}

export function ChatBubble({ message, onSpeak, accentColor }: Props) {
  const isUser = message.role === "user";
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
            <Pressable onPress={() => onSpeak(message.text)} hitSlop={8}>
              <Text style={styles.speakIcon}>🔊</Text>
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
});
