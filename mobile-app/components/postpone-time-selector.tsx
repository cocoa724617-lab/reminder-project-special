import { Pressable, StyleSheet, Text, View } from "react-native";

// 既存 atodeyaru.html の .later-time-options / .later-time-button と同じ選択肢。
// 元実装にカスタム日時入力は無いため、ここでもプリセットのみを実装している。
const TIME_OPTIONS = ["10分後", "30分後", "1時間後", "今日の夜", "明日の朝"];

interface PostponeTimeSelectorProps {
  selectedValue: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

// 既存 react-app/src/components/PostponeTimeSelector.jsx のRN版。
export default function PostponeTimeSelector({ selectedValue, onSelect, disabled }: PostponeTimeSelectorProps) {
  return (
    <View style={styles.row}>
      {TIME_OPTIONS.map((value) => {
        const isSelected = selectedValue === value;
        return (
          <Pressable
            key={value}
            onPress={() => onSelect(value)}
            disabled={disabled}
            style={[styles.button, isSelected && styles.buttonSelected]}>
            <Text style={[styles.buttonText, isSelected && styles.buttonTextSelected]}>{value}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, paddingHorizontal: 16 },
  button: {
    minWidth: 128,
    maxWidth: 180,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f2f2f7",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonSelected: { backgroundColor: "#0a84ff" },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },
  buttonTextSelected: { color: "#fff" },
});
