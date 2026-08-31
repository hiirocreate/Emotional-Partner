import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  isListening: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** 一般的なチャットアプリでよく見る丸型のマイクボタン(録音中は停止アイコンに切り替わる) */
export function VoiceButton({ isListening, disabled, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        isListening ? styles.listening : styles.idle,
        disabled ? styles.disabled : null,
      ]}
    >
      <Ionicons name={isListening ? "stop" : "mic"} size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  idle: { backgroundColor: "#4A7DFF" },
  listening: { backgroundColor: "#FF5A5F" },
  disabled: { opacity: 0.4 },
});
