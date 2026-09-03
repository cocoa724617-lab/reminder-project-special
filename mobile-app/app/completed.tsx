import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '@/components/empty-state';
import SegmentedControl from '@/components/segmented-control';
import TaskCard from '@/components/task-card';
import { useCompletedTasks, useLabelNames } from '@/hooks/use-tasks';
import { isSameDay, startOfWeek, toDate } from '@/utils/date-utils';
import { TASK_LABELS, getTaskLabel } from '@/utils/task-labels';
import type { CompletedTask, Task, TaskColor } from '@/types/task';

type PeriodFilter = 'all' | 'today' | 'week' | 'month';
type LabelFilter = 'all' | TaskColor;

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'today', label: '今日' },
  { value: 'week', label: '今週' },
  { value: 'month', label: '今月' },
];

// 既存 completed-tasks.html の matchesPeriod と同じ実装。
function matchesPeriod(task: CompletedTask, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  const completedAt = toDate(task.deletedAt);
  if (!completedAt) return false;

  const now = new Date();
  if (period === 'today') return isSameDay(completedAt, now);
  if (period === 'week') return completedAt >= startOfWeek(now);
  if (period === 'month') {
    return completedAt.getFullYear() === now.getFullYear() && completedAt.getMonth() === now.getMonth();
  }
  return true;
}

// 既存 react-app/src/pages/CompletedTasksPage.jsx のExpo版。
// このタブは(tabs)配下ではなくpushされた通常画面（ネイティブヘッダー＋戻るジェスチャー）なので、
// 開くたびに新しくマウントされる＝useCompletedTasks()は毎回フレッシュに取得し直され、refetchは不要。
export default function CompletedTasksScreen() {
  const { completedTasks, isLoading, error, removeCompletedTask } = useCompletedTasks();
  const { labelNames } = useLabelNames();
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');

  const filteredTasks = useMemo(() => {
    return completedTasks
      .filter((task) => !task.removedFromHistory)
      .filter((task) => labelFilter === 'all' || (task.color || 'none') === labelFilter)
      .filter((task) => matchesPeriod(task, periodFilter))
      .sort((a, b) => {
        const dateA = toDate(a.deletedAt);
        const dateB = toDate(b.deletedAt);
        if (!dateA || !dateB) return 0;
        return dateB.getTime() - dateA.getTime();
      });
  }, [completedTasks, labelFilter, periodFilter]);

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
        <Text style={styles.errorText}>完了済みタスクの取得に失敗しました。時間をおいて再度お試しください。</Text>
      </View>
    );
  }

  async function handleDelete(task: Task | CompletedTask) {
    try {
      await removeCompletedTask(task.id);
    } catch (err) {
      console.error('完了済みタスクの削除に失敗しました:', err);
      Alert.alert('削除に失敗しました。時間をおいて再度お試しください。');
    }
  }

  const labelChips: LabelFilter[] = ['all', ...(Object.keys(TASK_LABELS) as TaskColor[])];

  return (
    <View style={styles.container}>
      <View style={styles.filterBar}>
        <SegmentedControl options={PERIOD_OPTIONS} value={periodFilter} onChange={setPeriodFilter} />

        <FlatList
          horizontal
          data={labelChips}
          keyExtractor={(key) => key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.labelChipRow}
          renderItem={({ item: key }) => {
            const isSelected = labelFilter === key;
            const chipLabel = key === 'all' ? 'すべてのラベル' : getTaskLabel(key, labelNames).name;
            const dotColor = key === 'all' ? undefined : TASK_LABELS[key].color;
            return (
              <Pressable
                onPress={() => setLabelFilter(key)}
                style={[styles.labelChip, isSelected && styles.labelChipSelected]}>
                {!!dotColor && <View style={[styles.labelChipDot, { backgroundColor: dotColor }]} />}
                <Text style={[styles.labelChipText, isSelected && styles.labelChipTextSelected]}>{chipLabel}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredTasks}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState>条件に合う完了済みタスクはありません。</EmptyState>}
        renderItem={({ item }) => (
          <TaskCard task={item} variant="completed" labelNames={labelNames} onDelete={handleDelete} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  errorText: { color: '#ff3b30', textAlign: 'center', paddingHorizontal: 24 },
  filterBar: { padding: 16, gap: 10, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  labelChipRow: { gap: 8 },
  labelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#f2f2f7',
  },
  labelChipSelected: { backgroundColor: '#0a84ff' },
  labelChipDot: { width: 8, height: 8, borderRadius: 4 },
  labelChipText: { fontSize: 13, color: '#1c1c1e' },
  labelChipTextSelected: { color: '#fff', fontWeight: '700' },
  listContent: { padding: 16 },
});
