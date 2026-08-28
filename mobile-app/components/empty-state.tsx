import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";

// 既存 react-app/src/components/EmptyState.jsx のRN版。
// 一覧が0件のときの共通表示（Web版の .task-list-empty に相当）。
export default function EmptyState({ children }: { children: ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: {
    textAlign: "center",
    color: "#6b6b70",
    fontSize: 15,
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
});
