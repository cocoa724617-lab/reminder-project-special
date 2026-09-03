import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useRecentCompletedTasks, useTasks } from '@/hooks/use-tasks';
import { formatDate } from '@/utils/date-utils';
import { computeCompletionStats, formatPercentText } from '@/utils/stats-utils';
import { computeMonthlyProgress } from '@/utils/user-status-utils';

const MONTHLY_RANGE_DAYS = 30;

// 既存 react-app/src/pages/StatsPage.jsx のExpo版。
// completed.tsxと同じくpushされた通常画面（開くたびに新規マウント）なのでrefetchは不要。
export default function StatsScreen() {
  const { tasks, isLoading: tasksLoading, error: tasksError } = useTasks();
  const {
    completedTasks,
    isLoading: completedLoading,
    error: completedError,
  } = useRecentCompletedTasks(MONTHLY_RANGE_DAYS);

  if (tasksLoading || completedLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (tasksError || completedError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>実績の取得に失敗しました。時間をおいて再度お試しください。</Text>
      </View>
    );
  }

  const stats = computeCompletionStats(completedTasks);
  const weekdayText = stats.bestWeekdays.length > 0 ? stats.bestWeekdays.map((day) => `${day}曜日`).join('・') : 'まだデータがありません';

  // 直近30日（約1か月）分の達成率・完了数・完了タスク名一覧。
  // 達成率・完了数はremovedFromHistory（完了済み一覧からの削除）の影響を受けないが、
  // 名前一覧はここで除外し、一覧から消す操作をこの画面でも反映する。
  const monthlyStats = computeMonthlyProgress(tasks, completedTasks, new Date(), MONTHLY_RANGE_DAYS);
  const visibleMonthlyCompletedTasks = monthlyStats.completedTasks.filter((task) => !task.removedFromHistory);
  const monthlyCompletionRateText =
    monthlyStats.completionTargetCount > 0 ? formatPercentText(monthlyStats.completionRate) : '集計対象なし';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.tileGrid}>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{stats.todayCount}</Text>
          <Text style={styles.tileLabel}>今日の完了</Text>
        </View>
        <View style={styles.tile}>
          <Text style={styles.tileValue}>{stats.weekCount}</Text>
          <Text style={styles.tileLabel}>今週の完了</Text>
        </View>
        <View style={[styles.tile, styles.tileAccent]}>
          <Text style={[styles.tileValue, styles.tileValueAccent]}>{stats.fromLaterCount}</Text>
          <Text style={styles.tileLabel}>あとでから完了</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>よくできた曜日</Text>
        <Text style={styles.cardBody}>{weekdayText}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>直近{MONTHLY_RANGE_DAYS}日の実績</Text>
        <View style={styles.tileGrid}>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{monthlyStats.monthlyCompletedCount}</Text>
            <Text style={styles.tileLabel}>完了タスク数</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{monthlyCompletionRateText}</Text>
            <Text style={styles.tileLabel}>達成率</Text>
          </View>
        </View>

        {visibleMonthlyCompletedTasks.length === 0 ? (
          <Text style={styles.emptyText}>まだ完了したタスクがありません。</Text>
        ) : (
          <View style={styles.historyList}>
            {visibleMonthlyCompletedTasks.map((task) => (
              <View style={styles.historyItem} key={task.id}>
                <Text style={styles.historyName}>{task.name}</Text>
                <Text style={styles.historyDate}>
                  {formatDate(task.completedAt)}
                  {task.isFromLater ? '・あとでから完了' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <Text style={styles.footnote}>
        「あとでから完了」は、一度でも後回しにしたタスクを最後までやり切れた数です。先延ばしからの巻き返しも、ちゃんと成果としてカウントします。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 16, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  errorText: { color: '#ff3b30', textAlign: 'center', paddingHorizontal: 24 },
  tileGrid: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  tileAccent: { backgroundColor: '#eafaf0' },
  tileValue: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  tileValueAccent: { color: '#248a3d' },
  tileLabel: { fontSize: 12, color: '#6b6b70' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1c1c1e' },
  cardBody: { fontSize: 14, color: '#6b6b70' },
  emptyText: { fontSize: 13, color: '#8e8e93' },
  historyList: { gap: 10 },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  historyName: { fontSize: 14, color: '#1c1c1e', flexShrink: 1 },
  historyDate: { fontSize: 12, color: '#8e8e93' },
  footnote: { fontSize: 12, color: '#8e8e93', paddingHorizontal: 4, paddingBottom: 24 },
});
