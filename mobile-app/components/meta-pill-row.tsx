import { StyleSheet, Text, View } from "react-native";

import {
  getTaskLabel,
  normalizeImportance,
  IMPORTANCE_LABELS,
  normalizeUrgency,
  URGENCY_LABELS,
  REPEAT_LABELS,
  isRepeatingTask,
} from "@/utils/task-labels";
import type { LabelNames, Task } from "@/types/task";

// 既存 react-app/src/components/MetaPillRow.jsx のRN版。
// 重要度・優先度・色ラベル・繰り返し設定のピルをまとめて表示する（通常タスク用）。
// Web版の .meta-pill / .meta-pill-importance-high の配色（react-app/src/styles/global.css）を
// そのまま踏襲している（見た目の全面刷新はPhase2以降の見た目調整で行う）。
export default function MetaPillRow({ task, labelNames }: { task: Task; labelNames: LabelNames }) {
  const importance = normalizeImportance(task.priority || task.importance || task.priorityLevel);
  const urgency = normalizeUrgency(task.urgency);
  const labelMeta = getTaskLabel(task.color, labelNames);

  return (
    <View style={styles.row}>
      <View style={[styles.pill, importance === "high" && styles.pillImportanceHigh]}>
        <Text style={[styles.pillText, importance === "high" && styles.pillTextImportanceHigh]}>
          重要度：{IMPORTANCE_LABELS[importance]}
        </Text>
      </View>

      <View style={styles.pill}>
        <Text style={styles.pillText}>予定：{URGENCY_LABELS[urgency]}</Text>
      </View>

      {task.color && task.color !== "none" && (
        <View style={styles.pill}>
          <Text style={[styles.pillText, styles.pillTextLabel, { color: labelMeta.color }]}>{labelMeta.name}</Text>
        </View>
      )}

      {isRepeatingTask(task) && (
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            🔁 {REPEAT_LABELS[task.repeat as Exclude<Task["repeat"], "none" | undefined>] || task.repeat}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 6 },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#f1e8d9",
  },
  pillText: { fontSize: 11.5, fontWeight: "700", color: "#6b6b70" },
  pillImportanceHigh: { backgroundColor: "rgba(224, 100, 92, 0.12)" },
  pillTextImportanceHigh: { color: "#e0645c" },
  pillTextLabel: { fontWeight: "800" },
});
