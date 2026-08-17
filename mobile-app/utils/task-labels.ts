// 既存 react-app/src/utils/taskLabels.js の色ラベル定義・正規化ロジックの移植（TypeScript化のみ）。
// 元ファイルはモジュールスコープの customLabelNames を setCustomLabelNames() で書き換える設計だが、
// Reactの再レンダリングとは相性が悪いため、customLabelNames は引数として明示的に渡す形にしている。
import { toDate, combineDueDateTime } from "./date-utils";
import type { LabelNames, RepeatFrequency, Task, TaskColor, TaskPriority, TaskUrgency } from "../types/task";

export const TASK_LABELS: Record<TaskColor, { name: string; color: string }> = {
  none: { name: "ラベルなし", color: "#c7c7cc" },
  urgent: { name: "緊急", color: "#ff3b30" },
  school: { name: "学校", color: "#0a84ff" },
  life: { name: "生活", color: "#34c759" },
  jobhunt: { name: "就活", color: "#bf5af2" },
  "think-later": { name: "後で考える", color: "#8e8e93" },
};

export function getTaskLabel(value: TaskColor | string | null | undefined, customLabelNames: LabelNames = {}) {
  const key = (value && TASK_LABELS[value as TaskColor] ? value : "none") as TaskColor;
  const meta = TASK_LABELS[key];
  return { name: customLabelNames[key as Exclude<TaskColor, "none">] || meta.name, color: meta.color };
}

// 過去に文字化けして保存された「高/低」(鬮樣/菴・) も引き続き高/低として扱う
export function normalizeImportance(value: string | null | undefined): TaskPriority {
  const text = String(value || "").trim().toLowerCase();
  if (text === "high" || text === "高" || text.includes("高") || text.includes("鬮")) return "high";
  if (text === "low" || text === "低" || text.includes("低") || text.includes("菴")) return "low";
  return "medium";
}

export const IMPORTANCE_LABELS: Record<TaskPriority, string> = { high: "高", medium: "中", low: "低" };

export function normalizeUrgency(value: string | null | undefined): TaskUrgency {
  const text = String(value || "").trim().toLowerCase();
  if (text === "thisweek" || text === "this-week") return "thisWeek";
  if (text === "whenfree" || text === "when-free") return "whenFree";
  return "today";
}

export const URGENCY_LABELS: Record<TaskUrgency, string> = {
  today: "今日やる",
  thisWeek: "今週中",
  whenFree: "余裕があれば",
};

export const REPEAT_LABELS: Record<Exclude<RepeatFrequency, "none">, string> = {
  daily: "毎日",
  weekly: "毎週",
  monthly: "毎月",
  yearly: "毎年",
};

export function isRepeatingTask(task: Task | null | undefined): boolean {
  return !!(task && task.repeat && task.repeat !== "none");
}

export interface RepeatCycleStatus {
  completedAt: Date | null;
  nextDueDate: Date;
}

// 以下は移植元には存在しない新規ロジック（旧アプリにはこの機能自体がなかった）。
// 繰り返しタスクは完了すると dueDate が次回分に進み status も「未完了」に戻るため、
// 「今回分をもう完了したか」を見た目上は区別できない。
// taskService.completeTask が書き込む lastCompletedAt と、現在の dueDate（＝次回の復活日時）
// だけで判定する：lastCompletedAt が入っていて、かつ dueDate（次回）がまだ来ていなければ
// 「今回分は完了済み・次回まで待機中」とみなす。dueDateが来た時点で自動的にnullへ戻る
// （lastCompletedAtは前回分の記録として残るだけで、以降の判定には影響しない）。
// 日数固定のスパン計算が不要なため、daily/weekly/monthly/yearlyすべてで共通して使える。
export function getRepeatCycleStatus(task: Task, now: Date = new Date()): RepeatCycleStatus | null {
  if (!isRepeatingTask(task)) return null;
  if (!task.lastCompletedAt) return null;

  const nextDueDate = task.dueTime ? combineDueDateTime(task.dueDate, task.dueTime) : toDate(task.dueDate);
  if (!nextDueDate) return null;

  const currentDate = toDate(now) || new Date();
  if (currentDate >= nextDueDate) return null;

  return { completedAt: toDate(task.lastCompletedAt), nextDueDate };
}

// 既存 notification-settings.html の CUSTOMIZABLE_LABEL_KEYS と同じ：noneはカスタマイズ対象外。
export const CUSTOMIZABLE_LABEL_KEYS = Object.keys(TASK_LABELS).filter(
  (key) => key !== "none",
) as Exclude<TaskColor, "none">[];

// 既存 collectLabelNames と同じ仕様：空欄はデフォルト名にフォールバックする。保存直前に呼ぶ想定。
export function normalizeLabelNames(labelNamesForm: LabelNames): Record<string, string> {
  const normalized: Record<string, string> = {};
  CUSTOMIZABLE_LABEL_KEYS.forEach((key) => {
    const raw = (labelNamesForm[key] || "").trim();
    normalized[key] = raw || TASK_LABELS[key].name;
  });
  return normalized;
}
