import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '@/components/empty-state';
import MetaPillRow from '@/components/meta-pill-row';
import { useLabelNames, useTasks } from '@/hooks/use-tasks';
import { toDateKey } from '@/utils/date-utils';
import { getReminderLabel, getTaskDueDate, getTaskTitle, getRepeatCycleStatus, normalizeImportance } from '@/utils/task-labels';
import type { Task, TaskPriority } from '@/types/task';

function normalizeDateValue(value: string): string {
  return value ? value.slice(0, 10) : '';
}

// 既存 index.html の isTodayTask と同じ実装：urgency未設定の既存タスクを一律「今日やる」扱いにしない。
// このファイルでしか使わないロジックなので、utilsへは昇格させずローカルに置く（Web版もHomePage.jsx内ローカル）。
function isTodayTask(task: Task, todayStr: string): boolean {
  return normalizeDateValue(getTaskDueDate(task)) === todayStr || task.urgency === 'today';
}

function isActiveTask(task: Task): boolean {
  const status = String(task.status || '').trim();
  return status !== '完了' && status !== '後でやる';
}

const IMPORTANCE_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };

// 既存 index.html の pickNextTask と同じ実装：今日やるタスクの中から重要度→期限の順で1件選ぶ。
function pickNextTask(activeTasks: Task[], todayStr: string): Task | null {
  const todaysActive = activeTasks.filter((task) => isTodayTask(task, todayStr));
  const pool = todaysActive.length > 0 ? todaysActive : activeTasks;

  return (
    pool.slice().sort((a, b) => {
      const rankA = IMPORTANCE_RANK[normalizeImportance(a.priority || a.importance)];
      const rankB = IMPORTANCE_RANK[normalizeImportance(b.priority || b.importance)];
      if (rankA !== rankB) return rankA - rankB;

      const dueA = getTaskDueDate(a) || '9999-99-99';
      const dueB = getTaskDueDate(b) || '9999-99-99';
      return dueA.localeCompare(dueB);
    })[0] || null
  );
}

// 既存 react-app/src/pages/HomePage.jsx のExpo版。
// Phase2ではスコープを絞り、「次にやるタスク」「今日やるべきタスク」「＋追加FAB」のみ実装する。
// ステータス表示・週間進捗・統計タイル・ステータス発見度・連続記録バナーはPhase3で追加する
// （元のロードマップ通り、こうした「既存独自機能」はPhase3の担当）。
// 「あとでやる」ボタンもPhase3実装までは出さない（後述のTaskListPage同様、遷移先がまだ無いため）。
export default function HomeScreen() {
  const { tasks, isLoading, error, completeTask, refetch } = useTasks();
  const labelNames = useLabelNames();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
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
    } catch (err) {
      console.error('タスクの完了に失敗しました:', err);
      Alert.alert('タスクの完了に失敗しました。時間をおいて再度お試しください。');
    }
  }

  const now = new Date();
  const todayStr = toDateKey(now);

  // 繰り返しタスクは今回分を完了済み（次のdueDateが来ていない）なら、ホーム画面には出さない。
  const visibleTasks = tasks.filter((task) => !getRepeatCycleStatus(task, now));
  const activeTasks = visibleTasks.filter(isActiveTask);
  const nextTask = pickNextTask(activeTasks, todayStr);
  const todaysActive = activeTasks.filter((task) => isTodayTask(task, todayStr)).filter((task) => !nextTask || task.id !== nextTask.id);

  return (
    <View style={styles.container}>
      <FlatList
        data={todaysActive}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {nextTask && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>次にやるタスク</Text>
                <View style={styles.nextTaskCard}>
                  <Text style={styles.nextTaskTitle}>{getTaskTitle(nextTask, '無題のタスク')}</Text>
                  <Text style={styles.remindText}>📅 {getReminderLabel(nextTask)}</Text>
                  <MetaPillRow task={nextTask} labelNames={labelNames} />
                  <Pressable style={styles.completeButton} onPress={() => handleComplete(nextTask)}>
                    <Text style={styles.completeButtonText}>完了</Text>
                  </Pressable>
                </View>
              </View>
            )}
            <Text style={styles.sectionTitle}>今日やるべきタスク</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState>今日やるべきタスクはありません。のんびりいきましょう。</EmptyState>}
        renderItem={({ item }) => (
          <View style={styles.todayCard}>
            <Pressable
              style={styles.completeCircle}
              onPress={() => handleComplete(item)}
              accessibilityLabel="タスクを完了にする"
            />
            <View style={styles.todayCardInfo}>
              <Text style={styles.todayCardTitle}>{getTaskTitle(item, '無題のタスク')}</Text>
              <Text style={styles.remindText}>📅 {getReminderLabel(item)}</Text>
              <MetaPillRow task={item} labelNames={labelNames} />
            </View>
          </View>
        )}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/task/new')}>
        <Text style={styles.fabIcon}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  errorText: { color: '#ff3b30', textAlign: 'center', paddingHorizontal: 24 },
  listContent: { padding: 16, paddingBottom: 96 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 10 },
  nextTaskCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  nextTaskTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e' },
  remindText: { fontSize: 13, color: '#6b6b70' },
  completeButton: {
    marginTop: 8,
    backgroundColor: '#0a84ff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  todayCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  completeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#c7c7cc',
    marginTop: 2,
  },
  todayCardInfo: { flex: 1, gap: 4 },
  todayCardTitle: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
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
