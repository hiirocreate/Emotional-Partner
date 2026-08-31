import { Pressable, StyleSheet, View } from "react-native";

interface Props {
  value: string;
  onChange: (hex: string) => void;
  swatches: string[];
}

/**
 * カラーコードを手入力する代わりに、あらかじめ用意した色見本をタップして選ぶための部品。
 * 選択中の色には太い枠を付けて分かりやすくしている。
 */
export function ColorSwatchPicker({ value, onChange, swatches }: Props) {
  return (
    <View style={styles.wrap}>
      {swatches.map((hex) => {
        const selected = value.toLowerCase() === hex.toLowerCase();
        return (
          <Pressable
            key={hex}
            onPress={() => onChange(hex)}
            hitSlop={4}
            style={[
              styles.swatch,
              { backgroundColor: hex },
              selected ? styles.selected : styles.unselected,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  unselected: { borderWidth: 1, borderColor: "rgba(0,0,0,0.12)" },
  selected: { borderWidth: 3, borderColor: "#26263A" },
});
