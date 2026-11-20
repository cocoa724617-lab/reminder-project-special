// 既存 task-labels.js の色ラベル定義・正規化ロジックの移植。
// 元ファイルはモジュールスコープの customLabelNames を setCustomLabelNames() で書き換える設計だが、
// Reactの再レンダリングとは相性が悪いため、customLabelNames は引数として明示的に渡す形にしている。
import { toDate, combineDueDateTime, toDateKey } from "./dateUtils.js";

export const TASK_LABELS = {
  none: { name: "ラベルなし", color: "#c7c7cc" },
  urgent: { name: "緊急", color: "#ff3b30" },
  school: { name: "学校", color: "#0a84ff" },
  life: { name: "生活", color: "#34c759" },
  jobhunt: { name: "就活", color: "#bf5af2" },
  "think-later": { name: "後で考える", color: "#8e8e93" },
};

export function getTaskLabel(value, customLabelNames = {}) {
  const key = value && TASK_LABELS[value] ? value : "none";
  const meta = TASK_LABELS[key];
  return { name: customLabelNames[key] || meta.name, color: meta.color };
}

// 過去に文字化けして保存された「高/低」(鬮樣/菴・) も引き続き高/低として扱う
export function normalizeImportance(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "high" || text === "高" || text.includes("高") || text.includes("鬮")) return "high";
  if (text === "low" || text === "低" || text.includes("低") || text.includes("菴")) return "low";
  return "medium";
}

export const IMPORTANCE_LABELS = { high: "高", medium: "中", low: "低" };

export function normalizeUrgency(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "thisweek" || text === "this-week") return "thisWeek";
  if (text === "whenfree" || text === "when-free") return "whenFree";
  return "today";
}

export const URGENCY_LABELS = {
  today: "今日やる",
  thisWeek: "今週中",
  whenFree: "余裕があれば",
};

export const REPEAT_LABELS = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
  yearly: "毎年",
};

export function isRepeatingTask(task) {
  return !!(task && task.repeat && task.repeat !== "none");
}

// 繰り返しタスクの「その回の締切」。期限時刻があればその時刻、日付だけならその日の終わり(翌日0:00)。
// Cloud Functions側 computeCycleDeadline と同じ仕様（締切を過ぎると、サーバー側で次回の期限へ自動で繰り越される）。
function getCycleDeadline(dueDateStr, dueTimeStr) {
  const deadline = combineDueDateTime(dueDateStr, dueTimeStr);
  if (!deadline) return null;
  if (!dueTimeStr) deadline.setDate(deadline.getDate() + 1);
  return deadline;
}

// taskService.js の computeNextDueDate の逆：1周期前の期限(YYYY-MM-DD)を求める。
function computePreviousDueDate(dueDateStr, repeat) {
  const base = combineDueDateTime(dueDateStr, null);
  if (!base) return null;
  if (repeat === "daily") base.setDate(base.getDate() - 1);
  else if (repeat === "weekly") base.setDate(base.getDate() - 7);
  else if (repeat === "monthly") base.setMonth(base.getMonth() - 1);
  else if (repeat === "yearly") base.setFullYear(base.getFullYear() - 1);
  return toDateKey(base);
}

// 以下は移植元には存在しない新規ロジック（旧アプリにはこの機能自体がなかった）。
// 繰り返しタスクは完了すると dueDate が次回分に進み status も「未完了」に戻るため、
// 「今回分をもう完了したか」を見た目上は区別できない。
// taskService.completeTask が書き込む lastCompletedAt と、現在の dueDate（＝次回の期限）から判定する：
// lastCompletedAt が入っていて、かつ「次の周回の始まり（＝1周期前の期限の締切。完了前の元の締切）」が
// まだ来ていなければ「今回分は完了済み・次回の周回待ち」とみなす。
// 以前は「次回の期限(dueDate)が来るまで」待機させていたが、締切を過ぎた繰り返しタスクはサーバー側で
// 次回へ自動繰り越しされるようになったため、それだと次の周回で一度も「やるべきタスク」に出ないまま
// 期限切れ→繰り越しを繰り返してしまう。そのため待機は「元の締切まで」に変更した。
export function getRepeatCycleStatus(task, now = new Date()) {
  if (!isRepeatingTask(task)) return null;
  if (!task.lastCompletedAt) return null;

  // 表示(「次回：〜」)用なので、日付だけのタスクは締切(翌日0:00)ではなくその日付自体を返す。
  const nextDueDate = task.dueTime ? combineDueDateTime(task.dueDate, task.dueTime) : toDate(task.dueDate);
  const cycleStart = getCycleDeadline(computePreviousDueDate(task.dueDate, task.repeat), task.dueTime);
  if (!nextDueDate || !cycleStart) return null;

  const currentDate = toDate(now) || new Date();
  if (currentDate >= cycleStart) return null;

  return { completedAt: toDate(task.lastCompletedAt), nextDueDate };
}

// タスク一覧を「今すぐやるべきもの(pending)」と「繰り返しタスクで今回分は完了済み・次回待ちのもの
// (waiting、cycleStatus付き)」に分ける共通ヘルパー。
// HomePage/TaskListPageがそれぞれ別々にgetRepeatCycleStatusを呼んでいたのをここに集約する。
// 各ページは「waitingをどう見せるか(非表示にする／「次回：〜」ピルで見せる)」だけを決めればよく、
// 判定ロジック自体を書き直す必要がなくなる。
export function splitTasksByRepeatCycle(tasks, now = new Date()) {
  const pending = [];
  const waiting = [];

  tasks.forEach((task) => {
    const cycleStatus = getRepeatCycleStatus(task, now);
    if (cycleStatus) {
      waiting.push({ task, cycleStatus });
    } else {
      pending.push(task);
    }
  });

  return { pending, waiting };
}

// 既存 notification-settings.html の CUSTOMIZABLE_LABEL_KEYS と同じ：noneはカスタマイズ対象外。
export const CUSTOMIZABLE_LABEL_KEYS = Object.keys(TASK_LABELS).filter((key) => key !== "none");

// 既存 collectLabelNames と同じ仕様：空欄はデフォルト名にフォールバックする。保存直前に呼ぶ想定。
export function normalizeLabelNames(labelNamesForm) {
  const normalized = {};
  CUSTOMIZABLE_LABEL_KEYS.forEach((key) => {
    const raw = (labelNamesForm[key] || "").trim();
    normalized[key] = raw || TASK_LABELS[key].name;
  });
  return normalized;
}
