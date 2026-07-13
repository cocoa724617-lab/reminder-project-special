// 既存 stats.js / completed-tasks.html の toDate・formatDate・isSameDay・startOfWeek と同じ実装。
// Firestore Timestamp（.toDate()を持つ）、Date、日付文字列を安全に Date へ変換する。
export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// 既存 completed-tasks.html の formatDate と同じ実装（完了日時の表示用）。
export function formatDate(value, emptyLabel = "完了日不明") {
  const date = toDate(value);
  if (!date) return emptyLabel;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 週の開始は月曜0時（日曜起点ではない）。日曜は getDay()===0 のため6日分戻す。
export function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}
