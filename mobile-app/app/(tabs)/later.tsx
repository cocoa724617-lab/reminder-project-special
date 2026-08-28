import { StyleSheet, Text, View } from 'react-native';

// 既存 react-app/src/pages/PostponedTasksPage.jsx 相当。
// Phase3（後でやる機能の移植）で実装するまでのスタブ画面。
export default function LaterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>「あとで」機能はPhase3で実装予定です。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  text: { fontSize: 15, color: '#6b6b70', textAlign: 'center' },
});
