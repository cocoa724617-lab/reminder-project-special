import { toDate, isSameDay, startOfWeek } from "./dateUtils.js";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

// 完了済みタスクの一覧から「今日/今週の完了数」「あとでから完了できた数」「よくできた曜日」を集計する。
// 既存 stats.js の computeCompletionStats と同じ集計仕様（同率1位は複数曜日を返す）。
export function computeCompletionStats(completedTasks) {
  const now = new Date();
  const weekStart = startOfWeek(now);

  let todayCount = 0;
  let weekCount = 0;
  let fromLaterCount = 0;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];

  (completedTasks || []).forEach((task) => {
    const completedAt = toDate(task.deletedAt);
    if (!completedAt) return;

    if (isSameDay(completedAt, now)) todayCount++;
    if (completedAt >= weekStart) weekCount++;
    if ((task.laterCount || 0) > 0) fromLaterCount++;
    weekdayCounts[completedAt.getDay()]++;
  });

  const maxCount = Math.max(...weekdayCounts);
  const bestWeekdays = maxCount > 0
    ? weekdayCounts.map((count, i) => (count === maxCount ? WEEKDAY_LABELS[i] : null)).filter(Boolean)
    : [];

  return { todayCount, weekCount, fromLaterCount, bestWeekdays };
}
