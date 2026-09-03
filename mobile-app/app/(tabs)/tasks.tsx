import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import EmptyState from '@/components/empty-state';
import TaskCard from '@/components/task-card';
import { useLabelNames, useRecentCompletedTasks, useTasks } from '@/hooks/use-tasks';
import { celebrateCompletion } from '@/utils/celebrate';
import { getRepeatCycleStatus } from '@/utils/task-labels';
import type { CompletedTask, Task } from '@/types/task';

// 既存 react-app/src/pages/TaskListPage.jsx と同じ並び順：後でやる状態のタスクを後ろへ回す（安定ソート）。
// 「完了」状態のタスクは tasks コレクションに存在しないため、ここでは考慮不要。
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const laterA = String(a.status || '').trim() === '後でやる' ? 1 : 0;
    const laterB = String(b.status || '').trim() === '後でやる' ? 1 : 0;
    return laterA - laterB;
  });
}

// 既存 react-app/src/pages/TaskListPage.jsx のExpo版。
// Web版との違い：
// - useNow()は使わず、repeat-cycle判定用の now は毎回のレンダー時に new Date() で計算する
//   （Firestore取得はgetDocsで都度取得のため、リアルタイムに時計を刻んで再判定させる必要がない。
//   タブに戻ってきた時点のrefetchで十分）。
// - 削除は確認ダイアログなしで即実行（Web版の実際の挙動と同じ。コメント上は「確認済み」とあるが
//   実装にwindow.confirmが無く、コメントと実装が食い違っていたため実装の方に合わせている）。
export default function TaskListScreen() {
  const { tasks, isLoading, error, completeTask, removeTask, refetch } = useTasks();
  const { labelNames, refetch: refetchLabelNames } = useLabelNames();
  const router = useRouter();
  const {
    completedTasks: completedFromServer,
    isLoading: completedLoading,
    removeCompletedTask,
    refetch: refetchRecentCompleted,
  } = useRecentCompletedTasks(14);
  // 通常タスクを完了した直後、再取得を待たずその場で完了済みセクションへ反映するための楽観的な追加分
  // （繰り返しタスクはtasks一覧側がそのまま更新されるのでここには積まない）。
  const [optimisticCompletions, setOptimisticCompletions] = useState<CompletedTask[]>([]);
  const completedTasks = [...optimisticCompletions, ...completedFromServer];

  // タスク登録・編集画面（モーダル）や設定タブでのラベル名変更から戻ってきたときに一覧を最新化する。
  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchRecentCompleted();
      refetchLabelNames();
    }, [refetch, refetchRecentCompleted, refetchLabelNames]),
  );

  if (isLoading || completedLoading) {
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
      const { completedEntry } = await completeTask(task);
      celebrateCompletion();
      if (completedEntry) {
        setOptimisticCompletions((prev) => [completedEntry, ...prev]);
      }
    } catch (err) {
      console.error('タスクの完了に失敗しました:', err);
      Alert.alert('タスクの完了に失敗しました。時間をおいて再度お試しください。');
    }
  }

  async function handleDelete(task: Task | CompletedTask) {
    try {
      await removeTask(task.id);
    } catch (err) {
      console.error('タスクの削除に失敗しました:', err);
      Alert.alert('タスクの削除に失敗しました。時間をおいて再度お試しください。');
    }
  }

  async function handleDeleteCompleted(entry: Task | CompletedTask) {
    try {
      await removeCompletedTask(entry.id);
      setOptimisticCompletions((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      console.error('完了済みタスクの削除に失敗しました:', err);
      Alert.alert('削除に失敗しました。時間をおいて再度お試しください。');
    }
  }

  function handleEdit(task: Task) {
    router.push({ pathname: '/task/[id]', params: { id: task.id } });
  }

  function handlePostpone(task: Task) {
    router.push({ pathname: '/postpone/[id]', params: { id: task.id } });
  }

  const now = new Date();

  // 未完了：繰り返しタスクで「今回分」を完了済み（次のdueDateがまだ来ていない）のものは除く。
  const pendingTasks = sortTasks(tasks.filter((task) => !getRepeatCycleStatus(task, now)));

  // 完了済み①：繰り返しタスクで今回分を完了済みのもの（tasksコレクションに残ったまま、次回情報を表示）。
  const cycleCompletedTasks = tasks
    .map((task) => ({ task, cycleStatus: getRepeatCycleStatus(task, now) }))
    .filter((entry): entry is { task: Task; cycleStatus: NonNullable<ReturnType<typeof getRepeatCycleStatus>> } =>
      Boolean(entry.cycleStatus),
    );

  // 完了済み②：通常タスクの完了履歴（繰り返しタスクの分は①と二重表示になるため除く）。
  const cycleCompletedTaskIds = new Set(cycleCompletedTasks.map(({ task }) => task.id));
  const standaloneCompletedEntries = completedTasks.filter(
    (entry) => !entry.removedFromHistory && !cycleCompletedTaskIds.has(entry.originalTaskId),
  );

  const hasCompletedSection = cycleCompletedTasks.length > 0 || standaloneCompletedEntries.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>未完了</Text>
        {pendingTasks.length === 0 ? (
          <EmptyState>まだタスクがありません。＋ボタンから追加できます。</EmptyState>
        ) : (
          pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="active"
              labelNames={labelNames}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPostpone={handlePostpone}
            />
          ))
        )}

        {hasCompletedSection && (
          <>
            <Text style={[styles.sectionTitle, styles.completedSectionTitle]}>完了済み</Text>
            {cycleCompletedTasks.map(({ task, cycleStatus }) => (
              <TaskCard
                key={task.id}
                task={task}
                variant="active"
                labelNames={labelNames}
                cycleStatus={cycleStatus}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onPostpone={handlePostpone}
              />
            ))}
            {standaloneCompletedEntries.map((entry) => (
              <TaskCard key={entry.id} task={entry} variant="completed" labelNames={labelNames} onDelete={handleDeleteCompleted} />
            ))}
          </>
        )}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/task/new')}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  scrollContent: { padding: 16, paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  errorText: { color: '#ff3b30', textAlign: 'center', paddingHorizontal: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 10 },
  completedSectionTitle: { marginTop: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a84ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 30 },
});
