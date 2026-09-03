import { StyleSheet, Text, TextInput, View } from "react-native";

import { CUSTOMIZABLE_LABEL_KEYS, TASK_LABELS } from "@/utils/task-labels";
import type { LabelNames } from "@/types/task";

interface LabelNameSettingsProps {
  labelNames: LabelNames;
  onChange: (next: LabelNames) => void;
}

// 既存 react-app/src/components/LabelNameSettings.jsx のRN版。
export default function LabelNameSettings({ labelNames, onChange }: LabelNameSettingsProps) {
  function updateName(key: (typeof CUSTOMIZABLE_LABEL_KEYS)[number], value: string) {
    onChange({ ...labelNames, [key]: value });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>色ラベルの名前</Text>
      <Text style={styles.description}>色ごとに好きな名前を付けられます（例：緑→家事）。</Text>
      <View style={styles.list}>
        {CUSTOMIZABLE_LABEL_KEYS.map((key) => (
          <View style={styles.row} key={key}>
            <View style={[styles.dot, { backgroundColor: TASK_LABELS[key].color }]} />
            <TextInput
              style={styles.input}
              value={labelNames[key] ?? TASK_LABELS[key].name}
              onChangeText={(text) => updateName(key, text)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: "#1c1c1e" },
  description: { fontSize: 13, color: "#6b6b70", marginBottom: 4 },
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d1d6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
});
