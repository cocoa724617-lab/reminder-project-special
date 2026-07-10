const RECENT_DAYS = 7;
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

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

  if (typeof value.toDate === 'function') {
    try {
      return validDate(value.toDate());
    } catch (error) {
      return null;
    }
  }

  const seconds = typeof value.seconds === 'number' ? value.seconds : value._seconds;
  const nanoseconds = typeof value.nanoseconds === 'number' ? value.nanoseconds : value._nanoseconds;
  if (Number.isFinite(seconds)) {
    return validDate(new Date((seconds * 1000) + Math.floor((nanoseconds || 0) / 1000000)));
  }

  if (typeof value === 'number') {
    return validDate(new Date(value));
  }

  if (typeof value === 'string') {
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
  if (!task || typeof task !== 'object') return null;

  for (const key of keys) {
    const date = toDate(task[key]);
    if (date) return date;
  }

  return null;
}

function getCompletedDate(task) {
  return firstDateFrom(task, ['completedAt', 'deletedAt', 'updatedAt', 'finishedAt', 'finishedDate']);
}

function getRegisteredDate(task) {
  return firstDateFrom(task, ['createdAt', 'registeredAt', 'createdDate', 'updatedAt']);
}

function getTaskName(task) {
  return String((task && (task.name || task.title)) || '').trim();
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
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inRange(date, startInclusive, endExclusive) {
  return !!date && date >= startInclusive && date < endExclusive;
}

function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
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

function getBestWeekdays(recentCompletedTasks) {
  const counts = Array(WEEKDAY_LABELS.length).fill(0);

  recentCompletedTasks.forEach((task) => {
    const completedDate = getCompletedDate(task);
    if (completedDate) counts[completedDate.getDay()] += 1;
  });

  const maxCount = Math.max(...counts);
  if (maxCount <= 0) return [];

  return counts
    .map((count, index) => (count === maxCount ? WEEKDAY_LABELS[index] : null))
    .filter(Boolean);
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
    .sort((a, b) => a.localeCompare(b, 'ja'));
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
  const recentRegisteredTasksCount = countRecentRegisteredTasks(activeTasks, recentStart, recentEnd);
  const weeklyCompletedCount = recentCompletedTasks.length;
  const todayCompletedCount = recentCompletedTasks
    .filter((task) => isSameDay(getCompletedDate(task), currentDate))
    .length;

  const recentTaskPool = activeTasks
    .filter((task) => inRange(getRegisteredDate(task), recentStart, recentEnd))
    .concat(recentCompletedTasks);
  const postponedRecentTasksCount = recentTaskPool
    .filter((task) => getLaterCount(task) > 0)
    .length;

  const completionDenominator = recentRegisteredTasksCount + weeklyCompletedCount;

  return {
    totalTasks: activeTasks.length + completedTaskList.length,
    completedTasksCount: completedTaskList.length,
    todayCompletedCount,
    weeklyCompletedCount,
    averageTasksPerDay: round(safeDivide(weeklyCompletedCount, RECENT_DAYS), 2),
    completionRate: round(safeDivide(weeklyCompletedCount, completionDenominator), 4),
    postponeRate: round(safeDivide(postponedRecentTasksCount, recentTaskPool.length), 4),
    postponedCompletedCount: recentCompletedTasks.filter((task) => getLaterCount(task) > 0).length,
    bestWeekdays: getBestWeekdays(recentCompletedTasks),
    routineCompletedTaskNames: getRoutineCompletedTaskNames(recentCompletedTasks)
  };
}
