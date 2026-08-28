import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';

// 既存 react-app/src/pages/NotificationSettingsPage.jsx 相当。
// 通知時間帯・ラベル名変更などはPhase3/4で追加するため、Phase2時点ではログアウトのみのスタブ。
// app/index.tsx（Phase1の確認画面）を削除するにあたり、そこにしかなかったログアウト導線を
// ここへ引き継いでいる（設定タブに実機能が無い状態を作らないため）。
export default function SettingsScreen() {
  const { currentUser, logout } = useAuth();

  function handleLogout() {
    Alert.alert('ログアウトしますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.email}>{currentUser?.email}</Text>
      <Text style={styles.note}>通知設定・ラベル名の変更などはPhase3/4で追加予定です。</Text>
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16, backgroundColor: '#fff' },
  email: { fontSize: 15, color: '#1c1c1e', fontWeight: '600' },
  note: { fontSize: 13, color: '#6b6b70' },
  logoutButton: {
    marginTop: 'auto',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff3b30',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});
