import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '@/components/empty-state';
import TaskCard from '@/components/task-card';
import { useLabelNames, useTasks } from '@/hooks/use-tasks';
import { celebrateCompletion } from '@/utils/celebrate';
import type { Task } from '@/types/task';

// 既存 react-app/src/pages/PostponedTasksPage.jsx のExpo版。
// useTasks() はログイン中ユーザー自身の tasks サブコレクションだけを取得するため、
// 他ユーザーのタスクが混ざることはない。並び順も既存同様、取得順のまま特別なソートは行わない。
// Web版と同じくFABは無い（「あとでやる」に入れる操作はタスク一覧・ホーム側から行う）。
export default function LaterScreen() {
  const { tasks, isLoading, error, completeTask, removeTask, refetch } = useTasks();
  const { labelNames, refetch: refetchLabelNames } = useLabelNames();
  const router = useRouter();

  // 後でやる時刻選択（postpone/[id]、モーダル）や設定タブでのラベル名変更から戻ってきたときに最新化する。
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchLabelNames();
    }, [refetch, refetchLabelNames]),
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>タスクの取得に失敗しました。時間をおいて再度お試しください。</Text>
      </View>
    );
  }

  async function handleComplete(task: Task) {
    try {
      await completeTask(task);
      celebrateCompletion();
    } catch (err) {
      console.error('タスクの完了に失敗しました:', err);
      Alert.alert('タスクの完了に失敗しました。時間をおいて再度お試しください。');
    }
  }

  async function handleDelete(task: Task) {
    try {
      await removeTask(task.id);
    } catch (err) {
      console.error('タスクの削除に失敗しました:', err);
      Alert.alert('タスクの削除に失敗しました。時間をおいて再度お試しください。');
    }
  }

  function handleEdit(task: Task) {
    router.push({ pathname: '/task/[id]', params: { id: task.id } });
  }

  function handlePostpone(task: Task) {
    router.push({ pathname: '/postpone/[id]', params: { id: task.id } });
  }

  // 不正な日付や欠損データがあってもcrashしないよう、statusの取り出し自体もString化してから比較する。
  const postponedTasks = tasks.filter((task) => String(task?.status || '').trim() === '後でやる');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {postponedTasks.length === 0 ? (
        <EmptyState>今「あとでやる」に入っているタスクはありません。</EmptyState>
      ) : (
        postponedTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            variant="postponed"
            labelNames={labelNames}
            onComplete={handleComplete}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onPostpone={handlePostpone}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  errorText: { color: '#ff3b30', textAlign: 'center', paddingHorizontal: 24 },
});
