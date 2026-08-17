import type { FirestoreTimestampLike } from "../types/task";

// 既存 react-app/src/utils/dateUtils.js の verbatim 移植（TypeScript化のみ）。
// Firestore Timestamp（.toDate()を持つ）、Date、日付文字列を安全に Date へ変換する。
export function toDate(value: FirestoreTimestampLike | null | undefined): Date | null {
  if (!value) return null;
  if (typeof value === "object" && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number | Date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// 既存 completed-tasks.html の formatDate と同じ実装（完了日時の表示用）。
export function formatDate(value: FirestoreTimestampLike | null | undefined, emptyLabel = "完了日不明"): string {
  const date = toDate(value);
  if (!date) return emptyLabel;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

// 移植元にはない新規関数：「次回：YYYY年MM月DD日 HH:mm」表示用。
// 繰り返しタスクの dueDate は日付のみ（時刻情報を持たない）ため、時刻部分は 00:00 になる。
export function formatDateTimeJa(value: FirestoreTimestampLike | null | undefined, emptyLabel = "未定"): string {
  const date = toDate(value);
  if (!date) return emptyLabel;
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hh}:${mm}`;
}

// dueDate("YYYY-MM-DD")とdueTime("HH:MM")を組み合わせてローカル時刻のDateを作る。
// new Date(`${dueDate}T${dueTime}`)は形式次第でUTC/ローカルの解釈がぶれるため、年月日時分を明示して構築する。
export function combineDueDateTime(dueDateStr: string | null | undefined, dueTimeStr: string | null | undefined): Date | null {
  const dateMatch = String(dueDateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const timeMatch = String(dueTimeStr || "").match(/^(\d{1,2}):(\d{1,2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  const [, y, m, d] = dateMatch;
  return new Date(Number(y), Number(m) - 1, Number(d), hour, minute);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 週の開始は月曜0時（日曜起点ではない）。日曜は getDay()===0 のため6日分戻す。
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

// 連続達成日数（ストリーク）判定用：ローカル日付を"YYYY-MM-DD"にする。
// このファイルの他の関数と同じく、デバイスのローカル時刻をそのまま使う想定（日本語圏ユーザー前提）。
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
