import { toDate, isSameDay, startOfWeek } from "./date-utils";
import type { CompletedTask } from "../types/task";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export interface CompletionStats {
  todayCount: number;
  weekCount: number;
  fromLaterCount: number;
  bestWeekdays: string[];
}

// 完了済みタスクの一覧から「今日/今週の完了数」「あとでから完了できた数」「よくできた曜日」を集計する。
// 既存 stats.js の computeCompletionStats と同じ集計仕様（同率1位は複数曜日を返す）。
export function computeCompletionStats(completedTasks: CompletedTask[] | null | undefined): CompletionStats {
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
  const bestWeekdays =
    maxCount > 0
      ? weekdayCounts.map((count, i) => (count === maxCount ? WEEKDAY_LABELS[i] : null)).filter((v): v is string => !!v)
      : [];

  return { todayCount, weekCount, fromLaterCount, bestWeekdays };
}

// 既存 react-app/src/pages/StatsPage.jsx と HomePage.jsx で全く同じ内容が重複していた
// formatPercentText をここへ集約（Phase3で app/stats.tsx を作る際に見つけた重複）。
// 0〜1の比率を「NN%」表示に丸める。null/undefinedは「集計対象なし」等のプレースホルダーにフォールバックする。
export function formatPercentText(value: number | null | undefined, emptyText = "集計対象なし"): string {
  if (value === null || value === undefined) return emptyText;
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) * 100)));
  return Number.isFinite(percent) ? `${percent}%` : emptyText;
}
