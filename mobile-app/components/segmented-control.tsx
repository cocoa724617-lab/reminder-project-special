import { Pressable, StyleSheet, Text, View } from "react-native";

// 重要度・優先度・繰り返し頻度（task-form.tsx）、完了済みタスクの期間フィルタ（app/completed.tsx）など、
// 選択肢が少数（2〜4個程度）の場面で使う、iOSのセグメントコントロール相当のピル行。
// Web版では<select>だったが、常に全選択肢が見えているRN向けの方が自然なので、この形にした。
// 元はtask-form.tsxのローカル関数だったが、Phase3でcompleted.tsxの期間フィルタからも使うため独立させた。
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmentedRow}>
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, isSelected && styles.segmentSelected]}>
            <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedRow: { flexDirection: "row", backgroundColor: "#f2f2f7", borderRadius: 10, padding: 3, gap: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentSelected: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
  segmentText: { fontSize: 13, color: "#6b6b70" },
  segmentTextSelected: { color: "#1c1c1e", fontWeight: "700" },
});
