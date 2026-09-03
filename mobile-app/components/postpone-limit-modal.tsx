import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

interface PostponeLimitModalProps {
  visible: boolean;
  laterCount: number;
  isSaving: boolean;
  onDoNow: () => void;
  onEditDue: () => void;
  onConfirmPostpone: () => void;
}

// 既存 react-app/src/pages/PostponePage.jsx の .mini-modal-card（後回し3回以上の確認）のRN版。
// Alert.alertでも3択自体は出せるが、実際の後回し回数を含む説明文と「今やる」を主要ボタンとして
// 視覚的に区別したかったため、RNコアのModalで自作している（新しい依存は増やさない）。
export default function PostponeLimitModal({
  visible,
  laterCount,
  isSaving,
  onDoNow,
  onEditDue,
  onConfirmPostpone,
}: PostponeLimitModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>ちょっと待って</Text>
          <Text style={styles.body}>このタスクはすでに{laterCount}回後回しにしています。どうしますか？</Text>

          <Pressable style={styles.primaryButton} onPress={onDoNow} disabled={isSaving}>
            <Text style={styles.primaryButtonText}>今やる</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onEditDue} disabled={isSaving}>
            <Text style={styles.secondaryButtonText}>期限を変更する</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onConfirmPostpone} disabled={isSaving}>
            <Text style={styles.secondaryButtonText}>本当に後でやる</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 400, backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: "700", color: "#1c1c1e", textAlign: "center" },
  body: { fontSize: 14, color: "#6b6b70", textAlign: "center", marginBottom: 6 },
  primaryButton: { backgroundColor: "#0a84ff", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  secondaryButton: { backgroundColor: "#f2f2f7", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  secondaryButtonText: { color: "#1c1c1e", fontSize: 15 },
});
