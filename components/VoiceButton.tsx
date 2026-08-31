import { Pressable, StyleSheet, Text } from "react-native";

interface Props {
  isListening: boolean;
  disabled?: boolean;
  onPress: () => void;
}

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
      <Text style={styles.icon}>{isListening ? "⏹" : "🎤"}</Text>
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
  icon: { fontSize: 22 },
});
