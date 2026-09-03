import { StyleSheet, Text, View } from "react-native";

interface PostponeMessageProps {
  taskTitle?: string;
  message: string | null;
}

// 既存 react-app/src/components/PostponeMessage.jsx のRN版。
// メッセージ本文の抽選は呼び出し側（app/postpone/[id].tsx）が1回だけ行い、ここでは受け取った文字列を表示するだけにする。
export default function PostponeMessage({ taskTitle, message }: PostponeMessageProps) {
  return (
    <View style={styles.container}>
      {!!taskTitle && <Text style={styles.taskTitle}>{taskTitle}</Text>}
      <Text style={styles.message}>{message}</Text>
      <Text style={styles.question}>いつやるの？</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 8, paddingVertical: 24, paddingHorizontal: 16 },
  taskTitle: { fontSize: 14, color: "#6b6b70" },
  message: { fontSize: 24, fontWeight: "700", color: "#1c1c1e", textAlign: "center" },
  question: { fontSize: 15, color: "#8e8e93" },
});
