import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import EmptyState from '@/components/empty-state';
import MetaPillRow from '@/components/meta-pill-row';
import { STATUS_IMAGES } from '@/constants/status-images';
import { useDiscoveredStatuses, useLabelNames, useRecentCompletedTasks, useStreak, useTasks } from '@/hooks/use-tasks';
import { celebrateCompletion, celebrateStatusDiscovery } from '@/utils/celebrate';
import { toDateKey } from '@/utils/date-utils';
import { computeCompletionStats, formatPercentText } from '@/utils/stats-utils';
import { getReminderLabel, getTaskDueDate, getTaskTitle, getRepeatCycleStatus, normalizeImportance } from '@/utils/task-labels';
import { computeUserStatusStats, computeWeeklyProgress, getStatusDiscoveryStats, getUserStatusesFromStats } from '@/utils/user-status-utils';
import type { CompletedTask, Task, TaskPriority } from '@/types/task';
import type { StatusKey } from '@/utils/user-status-utils';

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

function formatBestWeekdays(bestWeekdays: string[] | undefined): string {
  if (!bestWeekdays || bestWeekdays.length === 0) return 'まだ集計中';
  return bestWeekdays.map((day) => `${day}曜日`).join(' / ');
}

function getUserStatusMessage(stats: { todayCompletedCount: number; postponedCompletedCount: number }): string {
  if (stats.todayCompletedCount === 0) {
    return '今日はまだ完了タスクがありません。まずは1つ進めてみましょう。';
  }
  if (stats.postponedCompletedCount > 0) {
    return 'あとでにしたタスクも、最終的に完了できています。';
  }
  return '少しずつ進めていきましょう。';
}

// 既存 react-app/src/pages/HomePage.jsx のExpo版（Phase3でPhase2が見送った残りのセクションを復元）。
// useNow()は使わず、repeat-cycle判定用のnowは毎回のレンダー時にnew Date()で計算する
// （tasks.tsx/later.tsxと同じ理由：フォーカス時のrefetchで十分）。
export default function HomeScreen() {
  const { tasks, isLoading: tasksLoading, error: tasksError, completeTask, refetch } = useTasks();
  const {
    completedTasks: recentCompletedFromServer,
    isLoading: completedLoading,
    refetch: refetchRecentCompleted,
  } = useRecentCompletedTasks();
  const { labelNames, refetch: refetchLabelNames } = useLabelNames();
  const {
    discoveredKeys,
    isLoaded: discoveredStatusesLoaded,
    recordDiscoveries,
    newlyDiscovered,
    clearNewlyDiscovered,
  } = useDiscoveredStatuses();
  const { streak, applyStreak } = useStreak();
  const router = useRouter();

  // タスク完了直後は再取得を待たず、その場ですぐ集計へ反映するための楽観的な追加分。
  const [optimisticCompletions, setOptimisticCompletions] = useState<CompletedTask[]>([]);
  const recentCompleted = useMemo(
    () => [...optimisticCompletions, ...recentCompletedFromServer],
    [optimisticCompletions, recentCompletedFromServer],
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchRecentCompleted();
      refetchLabelNames();
    }, [refetch, refetchRecentCompleted, refetchLabelNames]),
  );

  // ステータス発見度の蓄積：読み込み完了後、今まさに該当しているステータスを発見済み一覧へマージする。
  // データ未取得のまま集計すると「タスクなし」判定でバカンス中を誤発見してしまうため、読み込み中は行わない。
  useEffect(() => {
    if (tasksLoading || completedLoading || !discoveredStatusesLoaded) return;
    const stats = computeUserStatusStats(tasks, recentCompleted);
    const statuses = getUserStatusesFromStats(stats);
    if (statuses.length > 0) recordDiscoveries(statuses);
  }, [tasksLoading, completedLoading, discoveredStatusesLoaded, tasks, recentCompleted, recordDiscoveries]);

  // 新規発見があった瞬間だけトースト演出を出す。表示後は自身でキューを空にする。
  useEffect(() => {
    if (newlyDiscovered.length === 0) return;
    newlyDiscovered.forEach((status) => celebrateStatusDiscovery(status));
    clearNewlyDiscovered();
  }, [newlyDiscovered, clearNewlyDiscovered]);

  if (tasksLoading || completedLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (tasksError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>タスクの取得に失敗しました。時間をおいて再度お試しください。</Text>
      </View>
    );
  }

  async function handleComplete(task: Task) {
    try {
      const { completedEntry, streak: nextStreak } = await completeTask(task);
      celebrateCompletion();
      if (completedEntry) {
        setOptimisticCompletions((prev) => [completedEntry, ...prev]);
      }
      if (nextStreak) {
        applyStreak(nextStreak);
      }
    } catch (err) {
      console.error('タスクの完了に失敗しました:', err);
      Alert.alert('タスクの完了に失敗しました。時間をおいて再度お試しください。');
    }
  }

  function handlePostpone(task: Task) {
    router.push({ pathname: '/postpone/[id]', params: { id: task.id } });
  }

  const now = new Date();
  const todayStr = toDateKey(now);

  // 繰り返しタスクは今回分を完了済み（次のdueDateが来ていない）なら、ホーム画面には出さない。
  const visibleTasks = tasks.filter((task) => !getRepeatCycleStatus(task, now));
  const activeTasks = visibleTasks.filter(isActiveTask);
  const nextTask = pickNextTask(activeTasks, todayStr);
  const todaysActive = activeTasks.filter((task) => isTodayTask(task, todayStr)).filter((task) => !nextTask || task.id !== nextTask.id);

  const completionStats = computeCompletionStats(recentCompleted);
  // バッジ判定用：直近7日の移動窓（月曜になっても急にリセットされない）。
  const userStatusStats = computeUserStatusStats(tasks, recentCompleted);
  const currentStatuses = getUserStatusesFromStats(userStatusStats);
  // 「今週の進み具合」カード表示用：月曜0時起点の暦週で、実際に毎週リセットされる。
  const weeklyProgress = computeWeeklyProgress(tasks, recentCompleted);
  const completionRateText =
    weeklyProgress.completionTargetCount > 0 ? formatPercentText(weeklyProgress.completionRate) : '集計対象なし';
  const postponeRateText = formatPercentText(weeklyProgress.postponeRate, '0%');
  const discoveryStats = getStatusDiscoveryStats(discoveredKeys);
  const discoveryPercent = Math.round((discoveryStats.discoveredCount / discoveryStats.totalCount) * 100);

  return (
    <View style={styles.container}>
      <FlatList
        data={todaysActive}
        keyExtractor={(task) => task.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.streakBanner}>
              {streak.current > 0 ? (
                <>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text style={styles.streakText}>
                    <Text style={styles.streakBold}>{streak.current}日連続</Text>で達成中
                  </Text>
                  {streak.longest > streak.current && (
                    <Text style={styles.streakBest}>最長{streak.longest}日</Text>
                  )}
                </>
              ) : (
                <Text style={styles.streakText}>今日タスクを1つ完了して、連続達成を始めよう</Text>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>あなたの現在のステータス</Text>
              {currentStatuses.length === 0 ? (
                <Text style={styles.mutedText}>ステータスはまだ集計中です。少しずつタスクを進めていきましょう。</Text>
              ) : (
                <View style={styles.statusList}>
                  {currentStatuses.map((status) => (
                    <View style={styles.statusCard} key={status.key}>
                      <Image source={STATUS_IMAGES[status.key]} style={styles.statusImage} />
                      <View style={styles.statusBody}>
                        <Text style={styles.statusName}>{status.name}</Text>
                        <Text style={styles.statusDescription}>{status.description}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {nextTask && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>次にやるタスク</Text>
                <View style={styles.nextTaskCard}>
                  <Text style={styles.nextTaskTitle}>{getTaskTitle(nextTask, '無題のタスク')}</Text>
                  <Text style={styles.remindText}>📅 {getReminderLabel(nextTask)}</Text>
                  <MetaPillRow task={nextTask} labelNames={labelNames} />
                  <View style={styles.nextTaskActions}>
                    <Pressable style={styles.completeButton} onPress={() => handleComplete(nextTask)}>
                      <Text style={styles.completeButtonText}>完了</Text>
                    </Pressable>
                    <Pressable style={styles.postponeButton} onPress={() => handlePostpone(nextTask)}>
                      <Text style={styles.postponeButtonText}>あとでやる</Text>
                    </Pressable>
                  </View>
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
            <Pressable onPress={() => handlePostpone(item)} hitSlop={8}>
              <Text style={styles.laterLink}>あとで</Text>
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>今週の進み具合</Text>
              <View style={styles.card}>
                <View style={styles.weeklyGrid}>
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{weeklyProgress.todayCompletedCount}</Text>
                    <Text style={styles.weeklyLabel}>今日の完了</Text>
                  </View>
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{weeklyProgress.weeklyCompletedCount}</Text>
                    <Text style={styles.weeklyLabel}>今週の完了</Text>
                  </View>
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{weeklyProgress.postponedCompletedCount}</Text>
                    <Text style={styles.weeklyLabel}>あとでから完了</Text>
                  </View>
                  <View style={[styles.weeklyItem, styles.weeklyItemWide]}>
                    <Text style={styles.weeklyLabel}>よくできた曜日</Text>
                    <Text style={styles.weeklyText}>{formatBestWeekdays(weeklyProgress.bestWeekdays)}</Text>
                  </View>
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{completionRateText}</Text>
                    <Text style={styles.weeklyLabel}>達成率</Text>
                  </View>
                  <View style={styles.weeklyItem}>
                    <Text style={styles.weeklyValue}>{postponeRateText}</Text>
                    <Text style={styles.weeklyLabel}>後でやる使用率</Text>
                  </View>
                </View>
                <Text style={styles.weeklyMessage}>{getUserStatusMessage(weeklyProgress)}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>成果の確認</Text>
              <View style={styles.tileGrid}>
                <View style={styles.tile}>
                  <Text style={styles.tileValue}>{completionStats.todayCount}</Text>
                  <Text style={styles.tileLabel}>今日の完了</Text>
                </View>
                <View style={styles.tile}>
                  <Text style={styles.tileValue}>{completionStats.weekCount}</Text>
                  <Text style={styles.tileLabel}>今週の完了</Text>
                </View>
                <View style={[styles.tile, styles.tileAccent]}>
                  <Text style={[styles.tileValue, styles.tileValueAccent]}>{completionStats.fromLaterCount}</Text>
                  <Text style={styles.tileLabel}>あとでから完了</Text>
                </View>
              </View>
              <Pressable onPress={() => router.push('/stats')}>
                <Text style={styles.statsLink}>実績をもっと見る ›</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ステータス発見度</Text>
              <View style={styles.card}>
                <Text style={styles.discoveryCount}>
                  {discoveryStats.discoveredCount} / {discoveryStats.totalCount} 種類発見
                </Text>
                <View style={styles.discoveryBarTrack}>
                  <View style={[styles.discoveryBarFill, { width: `${discoveryPercent}%` }]} />
                </View>
                <View style={styles.discoveryGrid}>
                  {discoveryStats.statuses.map((status) => (
                    <View key={status.key} style={styles.discoveryTile}>
                      {status.discovered ? (
                        <Image source={STATUS_IMAGES[status.key as StatusKey]} style={styles.discoveryImage} />
                      ) : (
                        <View style={styles.discoveryPlaceholder}>
                          <Text style={styles.discoveryPlaceholderText}>？</Text>
                        </View>
                      )}
                      <Text style={styles.discoveryName} numberOfLines={1}>
                        {status.discovered ? status.name : '未発見'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>
        }
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
  mutedText: { fontSize: 13, color: '#8e8e93' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },

  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff4e5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  streakEmoji: { fontSize: 20 },
  streakText: { fontSize: 14, color: '#1c1c1e', flexShrink: 1 },
  streakBold: { fontWeight: '700' },
  streakBest: { fontSize: 12, color: '#8e8e93', marginLeft: 'auto' },

  statusList: { gap: 10 },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  statusImage: { width: 52, height: 52, borderRadius: 26 },
  statusBody: { flex: 1, gap: 2 },
  statusName: { fontSize: 15, fontWeight: '700', color: '#1c1c1e' },
  statusDescription: { fontSize: 12, color: '#6b6b70' },

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
  nextTaskActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  completeButton: { flex: 1, backgroundColor: '#0a84ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  completeButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  postponeButton: { flex: 1, backgroundColor: '#f1e8d9', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  postponeButtonText: { color: '#6b6b70', fontSize: 15, fontWeight: '600' },

  todayCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  laterLink: { fontSize: 13, color: '#0a84ff', marginTop: 4 },

  weeklyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  weeklyItem: { width: '28%', gap: 2 },
  weeklyItemWide: { width: '100%' },
  weeklyValue: { fontSize: 20, fontWeight: '700', color: '#1c1c1e' },
  weeklyLabel: { fontSize: 11, color: '#8e8e93' },
  weeklyText: { fontSize: 14, color: '#1c1c1e', fontWeight: '600' },
  weeklyMessage: { fontSize: 13, color: '#6b6b70' },

  tileGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tile: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  tileAccent: { backgroundColor: '#eafaf0' },
  tileValue: { fontSize: 22, fontWeight: '700', color: '#1c1c1e' },
  tileValueAccent: { color: '#248a3d' },
  tileLabel: { fontSize: 12, color: '#6b6b70' },
  statsLink: { fontSize: 14, color: '#0a84ff', fontWeight: '600' },

  discoveryCount: { fontSize: 15, fontWeight: '700', color: '#1c1c1e' },
  discoveryBarTrack: { height: 8, borderRadius: 4, backgroundColor: '#e5e5ea', overflow: 'hidden' },
  discoveryBarFill: { height: '100%', backgroundColor: '#0a84ff' },
  discoveryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  discoveryTile: { width: '22%', alignItems: 'center', gap: 4 },
  discoveryImage: { width: 48, height: 48, borderRadius: 24 },
  discoveryPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f2f2f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoveryPlaceholderText: { fontSize: 18, color: '#c7c7cc' },
  discoveryName: { fontSize: 10, color: '#6b6b70', textAlign: 'center' },

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
