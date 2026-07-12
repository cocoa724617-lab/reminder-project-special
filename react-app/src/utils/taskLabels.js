// 既存 task-labels.js の色ラベル定義・正規化ロジックの移植。
// 元ファイルはモジュールスコープの customLabelNames を setCustomLabelNames() で書き換える設計だが、
// Reactの再レンダリングとは相性が悪いため、customLabelNames は引数として明示的に渡す形にしている。
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
