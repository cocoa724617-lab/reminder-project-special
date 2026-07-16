// 既存 user-status.js の verbatim 移植。
// 画像パスは react-app/public/assets/status/ にコピー済みの静的アセットを指す。
import { startOfWeek, combineDueDateTime } from "./dateUtils.js";

const RECENT_DAYS = 7;
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export const STATUS_DEFINITIONS = {
  selfManagementMaster: {
    key: "selfManagementMaster",
    name: "セルフマネジメントマスター",
    image: "/assets/status/self_management_master.png",
    description: "タスクを計画的に登録し、高い達成率を維持できています。",
  },
  routineMaster: {
    key: "routineMaster",
    name: "ルーティーンマスター",
    image: "/assets/status/routine_master.png",
    description: "同じタスクを継続して達成できています。",
  },
  lazyPerson: {
    key: "lazyPerson",
    name: "怠惰な人",
    image: "/assets/status/lazy_person.png",
    description: "登録したタスクの達成率がかなり低い状態です。まずは小さなタスクから達成していきましょう。",
  },
  procrastinationDemon: {
    key: "procrastinationDemon",
    name: "先延ばし大魔神",
    image: "/assets/status/procrastination_demon.png",
    description: "後でやる機能をかなり多く使っています。次にやる時間を決めて、少しずつ進めましょう。",
  },
  forgetfulAlien: {
    key: "forgetfulAlien",
    name: "うっかり星人",
    image: "/assets/status/forgetful_alien.png",
    description: "たまにタスクを忘れてしまっているようです。通知をうまく活用しましょう。",
  },
  tooBusyPerson: {
    key: "tooBusyPerson",
    name: "猫の手も借りたい人",
    image: "/assets/status/too_busy_person.png",
    description: "タスク量が多く、こなしきれない状態です。優先順位をつけて整理しましょう。",
  },
  vacationMode: {
    key: "vacationMode",
    name: "バカンス中？",
    image: "/assets/status/vacation_mode.png",
    description: "最近タスクがほとんど登録されていません。まずはタスクを登録してみましょう。",
  },
  normalMode: {
    key: "normalMode",
    name: "通常運転中",
    image: "/assets/status/normal_mode.png",
    description: "少しずつタスクを進めていきましょう。",
  },
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function validDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
}

function toDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return validDate(new Date(value.getTime()));
  }

  if (typeof value.toDate === "function") {
    try {
      return validDate(value.toDate());
    } catch {
      return null;
    }
  }

  const seconds = typeof value.seconds === "number" ? value.seconds : value._seconds;
  const nanoseconds = typeof value.nanoseconds === "number" ? value.nanoseconds : value._nanoseconds;
  if (Number.isFinite(seconds)) {
    return validDate(new Date(seconds * 1000 + Math.floor((nanoseconds || 0) / 1000000)));
  }

  if (typeof value === "number") {
    return validDate(new Date(value));
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return null;

    const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      return validDate(new Date(Number(year), Number(month) - 1, Number(day)));
    }

    return validDate(new Date(text));
  }

  return null;
}

function firstDateFrom(task, keys) {
  if (!task || typeof task !== "object") return null;

  for (const key of keys) {
    const date = toDate(task[key]);
    if (date) return date;
  }

  return null;
}

function getCompletedDate(task) {
  return firstDateFrom(task, ["completedAt", "deletedAt", "finishedAt", "finishedDate"]);
}

function getRegisteredDate(task) {
  return firstDateFrom(task, ["createdAt", "registeredAt", "createdDate"]);
}

function getDueDate(task) {
  if (task && task.dueDate && task.dueTime) {
    const combined = combineDueDateTime(task.dueDate, task.dueTime);
    if (combined) return combined;
  }
  return firstDateFrom(task, ["dueDate", "notifyDate", "time"]);
}

function getTaskName(task) {
  const name = String((task && task.name) || "").trim();
  if (name) return name;

  const title = String((task && task.title) || "").trim();
  return title || "名称未設定";
}

function getLaterCount(task) {
  const count = Number(task && task.laterCount);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function inRange(date, startInclusive, endExclusive) {
  return !!date && date >= startInclusive && date < endExclusive;
}

function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function countRecentRegisteredTasks(tasks, rangeStart, rangeEnd) {
  return tasks.filter((task) => inRange(getRegisteredDate(task), rangeStart, rangeEnd)).length;
}

function getRecentCompletedTasks(completedTasks, rangeStart, rangeEnd) {
  return completedTasks.filter((task) => inRange(getCompletedDate(task), rangeStart, rangeEnd));
}

// dueDate は「締切が既に到来している（now以前）」場合のみノルマに含める。
// 未到来の締切をノルマに含めると、①まだ来ていない締切分だけ達成率が不当に下がる、
// ②繰り返しタスクを完了した直後に次回分の期日(未来)がまだ今週内だと、
//   「完了記録」と「次回分の未完了タスク」を二重にノルマとして数えてしまう、という2つの不具合が出る。
function isCompletionTargetTask(task, rangeStart, rangeEnd, now) {
  const dueDate = getDueDate(task);
  const isDueTarget = inRange(dueDate, rangeStart, rangeEnd) && dueDate <= now;
  return (
    isDueTarget ||
    inRange(getRegisteredDate(task), rangeStart, rangeEnd) ||
    inRange(getCompletedDate(task), rangeStart, rangeEnd)
  );
}

function getTaskKey(source, task, index) {
  const id = task && task.id;
  if (id) return `${source}:${id}`;

  const originalTaskId = task && task.originalTaskId;
  if (originalTaskId) return `${source}:original:${originalTaskId}:${index}`;

  return `${source}:index:${index}`;
}

function addCompletionTargetTask(targetTaskKeys, source, task, index, rangeStart, rangeEnd, now) {
  if (!isCompletionTargetTask(task, rangeStart, rangeEnd, now)) return;
  targetTaskKeys.add(getTaskKey(source, task, index));
}

function countCompletionTargetTasks(activeTasks, completedTasks, rangeStart, rangeEnd, now) {
  const targetTaskKeys = new Set();

  activeTasks.forEach((task, index) => {
    addCompletionTargetTask(targetTaskKeys, "active", task, index, rangeStart, rangeEnd, now);
  });

  completedTasks.forEach((task, index) => {
    addCompletionTargetTask(targetTaskKeys, "completed", task, index, rangeStart, rangeEnd, now);
  });

  return targetTaskKeys.size;
}

function getBestWeekdays(recentCompletedTasks) {
  const counts = Array(WEEKDAY_LABELS.length).fill(0);

  recentCompletedTasks.forEach((task) => {
    const completedDate = getCompletedDate(task);
    if (completedDate) counts[completedDate.getDay()] += 1;
  });

  const maxCount = Math.max(...counts);
  if (maxCount <= 0) return [];

  return counts.map((count, index) => (count === maxCount ? WEEKDAY_LABELS[index] : null)).filter(Boolean);
}

function getRoutineCompletedTaskNames(recentCompletedTasks) {
  const completionsByName = new Map();

  recentCompletedTasks.forEach((task) => {
    const name = getTaskName(task);
    const completedDate = getCompletedDate(task);
    if (!name || !completedDate) return;

    if (!completionsByName.has(name)) {
      completionsByName.set(name, new Set());
    }
    completionsByName.get(name).add(localDateKey(completedDate));
  });

  return Array.from(completionsByName.entries())
    .filter(([, completedDays]) => completedDays.size >= 5)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, "ja"));
}

function copyStatus(key) {
  return { ...STATUS_DEFINITIONS[key] };
}

export const ALL_STATUS_KEYS = Object.keys(STATUS_DEFINITIONS);

// 既に発見済みのステータスキー一覧に、今回新たに該当したステータスをマージする。
// Setで管理するため、同じキーが複数回渡されても発見数が二重にカウントされることはない。
// STATUS_DEFINITIONSに存在しないキー（過去バージョンの残骸など）は無視する。
export function discoverStatusKeys(existingDiscoveredKeys, newlyDetectedStatuses) {
  const discovered = new Set(asArray(existingDiscoveredKeys).filter((key) => STATUS_DEFINITIONS[key]));

  asArray(newlyDetectedStatuses).forEach((status) => {
    const key = typeof status === "string" ? status : status && status.key;
    if (key && STATUS_DEFINITIONS[key]) discovered.add(key);
  });

  return Array.from(discovered);
}

// ホーム画面下部の「ステータス発見度」表示用：全ステータス中いくつ発見済みかと、
// 一覧（発見済みかどうかのフラグ付き）をまとめて返す。
export function getStatusDiscoveryStats(discoveredKeys) {
  const uniqueDiscoveredKeys = discoverStatusKeys(discoveredKeys, []);
  const discoveredSet = new Set(uniqueDiscoveredKeys);

  return {
    discoveredCount: uniqueDiscoveredKeys.length,
    totalCount: ALL_STATUS_KEYS.length,
    statuses: ALL_STATUS_KEYS.map((key) => ({
      ...STATUS_DEFINITIONS[key],
      discovered: discoveredSet.has(key),
    })),
  };
}

function getStatsArray(value) {
  return Array.isArray(value) ? value : [];
}

function getAverageRegisteredTasksPerDay(stats) {
  if (!stats || typeof stats !== "object") return 0;
  if (Number.isFinite(Number(stats.averageRegisteredTasksPerDay))) {
    return safeNumber(stats.averageRegisteredTasksPerDay);
  }
  return safeNumber(stats.averageTasksPerDay);
}

function getSafeRate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

export function computeUserStatusStats(tasks, completedTasks, now = new Date()) {
  const activeTasks = asArray(tasks);
  const completedTaskList = asArray(completedTasks);
  const currentDate = toDate(now) || new Date();

  const todayStart = startOfDay(currentDate);
  const tomorrowStart = addDays(todayStart, 1);
  const recentStart = addDays(todayStart, -(RECENT_DAYS - 1));
  const recentEnd = tomorrowStart;

  const recentCompletedTasks = getRecentCompletedTasks(completedTaskList, recentStart, recentEnd);
  const allStatusTasks = activeTasks.concat(completedTaskList);
  const recentRegisteredTasksCount = countRecentRegisteredTasks(allStatusTasks, recentStart, recentEnd);
  const weeklyCompletedCount = recentCompletedTasks.length;
  const todayCompletedCount = recentCompletedTasks.filter((task) => isSameDay(getCompletedDate(task), currentDate)).length;

  const recentTaskPool = activeTasks
    .filter((task) => inRange(getRegisteredDate(task), recentStart, recentEnd))
    .concat(recentCompletedTasks);
  const postponedRecentTasksCount = recentTaskPool.filter((task) => getLaterCount(task) > 0).length;
  const totalLaterCount = recentTaskPool.reduce((sum, task) => sum + getLaterCount(task), 0);

  const completionTargetCount = countCompletionTargetTasks(activeTasks, completedTaskList, recentStart, recentEnd, currentDate);
  const completionRate = completionTargetCount > 0 ? round(weeklyCompletedCount / completionTargetCount, 4) : null;

  return {
    totalTasks: activeTasks.length + completedTaskList.length,
    completedTasksCount: completedTaskList.length,
    todayCompletedCount,
    weeklyCompletedCount,
    averageTasksPerDay: round(safeDivide(weeklyCompletedCount, RECENT_DAYS), 2),
    averageRegisteredTasksPerDay: round(safeDivide(recentRegisteredTasksCount, RECENT_DAYS), 2),
    completionTargetCount,
    completionRate,
    postponeRate: round(safeDivide(postponedRecentTasksCount, recentTaskPool.length), 4),
    totalLaterCount,
    postponedCompletedCount: recentCompletedTasks.filter((task) => getLaterCount(task) > 0).length,
    bestWeekdays: getBestWeekdays(recentCompletedTasks),
    routineCompletedTaskNames: getRoutineCompletedTaskNames(recentCompletedTasks),
  };
}

// 指定した期間[rangeStart, rangeEnd)における進み具合を集計する共通処理。
// computeWeeklyProgress（暦週）と computeMonthlyProgress（直近N日）の両方から呼ばれる。
function computeRangeProgress(activeTasks, completedTaskList, rangeStart, rangeEnd, currentDate) {
  const rangeCompletedTasks = completedTaskList.filter((task) => inRange(getCompletedDate(task), rangeStart, rangeEnd));
  const todayCompletedCount = rangeCompletedTasks.filter((task) => isSameDay(getCompletedDate(task), currentDate)).length;
  const completedCount = rangeCompletedTasks.length;
  const postponedCompletedCount = rangeCompletedTasks.filter((task) => getLaterCount(task) > 0).length;
  const bestWeekdays = getBestWeekdays(rangeCompletedTasks);

  const rangeTaskPool = activeTasks
    .filter((task) => inRange(getRegisteredDate(task), rangeStart, rangeEnd))
    .concat(rangeCompletedTasks);
  const postponedTasksCount = rangeTaskPool.filter((task) => getLaterCount(task) > 0).length;

  const completionTargetCount = countCompletionTargetTasks(activeTasks, completedTaskList, rangeStart, rangeEnd, currentDate);
  const completionRate = completionTargetCount > 0 ? round(completedCount / completionTargetCount, 4) : null;

  return {
    todayCompletedCount,
    completedCount,
    postponedCompletedCount,
    bestWeekdays,
    completionTargetCount,
    completionRate,
    postponeRate: round(safeDivide(postponedTasksCount, rangeTaskPool.length), 4),
    // completionRate/completedCountの集計はremovedFromHistory（完了済み一覧からの論理削除）を無視して
    // 全件を対象にするが、この一覧表示用データだけはremovedFromHistoryを持ち越し、呼び出し側で
    // 除外できるようにする（一覧からは消したいという操作者の意図を反映するため）。
    completedTasks: rangeCompletedTasks
      .slice()
      .sort((a, b) => getCompletedDate(b) - getCompletedDate(a))
      .map((task) => ({
        id: task.id,
        name: getTaskName(task),
        completedAt: getCompletedDate(task),
        isFromLater: getLaterCount(task) > 0,
        removedFromHistory: !!task.removedFromHistory,
      })),
  };
}

// 「今週の進み具合」カード表示専用の集計。ステータス判定（computeUserStatusStats）とは別に、
// 月曜0時起点の暦週でリセットする。バッジ判定側は移動窓のまま据え置き、月曜朝に実績が
// 急に空になってステータスが乱高下するのを避ける。
export function computeWeeklyProgress(tasks, completedTasks, now = new Date()) {
  const activeTasks = asArray(tasks);
  const completedTaskList = asArray(completedTasks);
  const currentDate = toDate(now) || new Date();

  const weekStart = startOfWeek(currentDate);
  const weekEnd = addDays(weekStart, 7);

  const { completedCount, ...rest } = computeRangeProgress(activeTasks, completedTaskList, weekStart, weekEnd, currentDate);
  return { weeklyCompletedCount: completedCount, ...rest };
}

// 実績画面（もっと見る）用：直近 days 日分（既定30日＝約1か月）の完了率・完了数・完了タスク名一覧。
// 過去データを削除するわけではなく、毎回その場で期間を絞って集計するだけなので、
// 期間を広げても遡って別途保存し直す必要はない。
export function computeMonthlyProgress(tasks, completedTasks, now = new Date(), days = 30) {
  const activeTasks = asArray(tasks);
  const completedTaskList = asArray(completedTasks);
  const currentDate = toDate(now) || new Date();

  const rangeEnd = addDays(startOfDay(currentDate), 1);
  const rangeStart = addDays(startOfDay(currentDate), -(days - 1));

  const { completedCount, ...rest } = computeRangeProgress(activeTasks, completedTaskList, rangeStart, rangeEnd, currentDate);
  return { monthlyCompletedCount: completedCount, rangeDays: days, ...rest };
}

export function getUserStatusesFromStats(stats) {
  const safeStats = stats && typeof stats === "object" ? stats : {};
  const totalTasks = Math.max(0, safeNumber(safeStats.totalTasks));
  const averageRegisteredTasksPerDay = getAverageRegisteredTasksPerDay(safeStats);
  const completionRate = getSafeRate(safeStats.completionRate);
  const postponeRate = Math.max(0, safeNumber(safeStats.postponeRate));
  const totalLaterCount = Math.max(0, safeNumber(safeStats.totalLaterCount));
  const routineCompletedTaskNames = getStatsArray(safeStats.routineCompletedTaskNames);

  // 新規登録数だけで判定すると、既存タスクを黙々とこなしているだけの利用者（今週新しいタスクを
  // 登録していないだけ）や、期限切れで諦めたタスクを削除しただけの利用者まで「バカンス中」に
  // なってしまう（totalTasksはactiveTasks+直近14日の完了済みタスクの件数なので、これが0＝
  // アクティブなタスクも直近の完了実績も無い、という本当に何もしていない状態でのみ発動させる）。
  if (averageRegisteredTasksPerDay < 1 && totalTasks === 0) {
    return [copyStatus("vacationMode")];
  }

  const statuses = [];

  if (averageRegisteredTasksPerDay >= 4 && completionRate !== null && completionRate >= 0.9 && postponeRate < 0.1) {
    statuses.push(copyStatus("selfManagementMaster"));
  }

  if (routineCompletedTaskNames.length > 0) {
    statuses.push(copyStatus("routineMaster"));
  }

  const isLazyPerson = totalTasks >= 3 && completionRate !== null && completionRate < 0.3;
  if (isLazyPerson) {
    statuses.push(copyStatus("lazyPerson"));
  }

  if (postponeRate >= 0.5 && (totalTasks >= 3 || totalLaterCount >= 3)) {
    statuses.push(copyStatus("procrastinationDemon"));
  }

  if (!isLazyPerson && totalTasks >= 3 && completionRate !== null && completionRate >= 0.3 && completionRate < 0.6) {
    statuses.push(copyStatus("forgetfulAlien"));
  }

  if (
    !isLazyPerson &&
    averageRegisteredTasksPerDay >= 4 &&
    completionRate !== null &&
    completionRate >= 0.3 &&
    completionRate < 0.7
  ) {
    statuses.push(copyStatus("tooBusyPerson"));
  }

  return statuses.length > 0 ? statuses : [copyStatus("normalMode")];
}
