import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useTasks } from '@/hooks/use-tasks';

// Phase1確認用の暫定画面：ログイン後にFirestoreからタスクが取得できることを確かめるだけの一覧表示。
// 本来のホーム画面（次にやるタスク・ステータス表示など、react-app/src/pages/HomePage.jsx相当）は
// Phase2でTaskCard等のRNコンポーネントを作ってから作り直す。
export default function VerificationScreen() {
  const { currentUser, logout } = useAuth();
  const { tasks, isLoading, error } = useTasks();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Firestore接続確認（Phase1）</Text>
        <Text style={styles.subtitle}>{currentUser?.email}</Text>
        <Pressable onPress={() => logout()}>
          <Text style={styles.logout}>ログアウト</Text>
        </Pressable>
      </View>

      {isLoading && <ActivityIndicator style={styles.loading} />}
      {!!error && <Text style={styles.error}>タスクの取得に失敗しました：{error.message}</Text>}

      <FlatList
        data={tasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>タスクがありません（0件取得）</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowTitle}>{item.name || item.title || '(無題)'}</Text>
            <Text style={styles.rowMeta}>
              status: {item.status ?? '-'} / dueDate: {item.dueDate ?? '-'}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#d1d1d6' },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, color: '#6b6b70' },
  logout: { color: '#ff3b30', marginTop: 8 },
  loading: { marginTop: 24 },
  error: { color: '#ff3b30', padding: 16 },
  list: { padding: 16, gap: 8 },
  empty: { color: '#6b6b70', textAlign: 'center', marginTop: 24 },
  row: { padding: 12, borderRadius: 10, backgroundColor: '#f2f2f7', gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowMeta: { fontSize: 12, color: '#6b6b70' },
});
