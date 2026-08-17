// react-app/src（Web版）が使っているFirestoreスキーマをそのまま踏襲した型定義。
// バックエンド（functions/, firestore.rules）は変更しないため、フィールド名・意味は既存のまま。
// レガシー互換フィールド（title/date/notifyDate など）の理由は各利用箇所のコメントを参照。

// Firestore Timestamp / Date / 数値秒 / 日付文字列 いずれの形でも受け取れるようにする
// （utils/date-utils.ts の toDate() が実行時に吸収する）。
export type FirestoreTimestampLike =
  | Date
  | string
  | number
  | { toDate: () => Date }
  | { seconds: number; nanoseconds?: number }
  | { _seconds: number; _nanoseconds?: number };

export type TaskColor = "none" | "urgent" | "school" | "life" | "jobhunt" | "think-later";
export type TaskPriority = "low" | "medium" | "high"; // 重要度
export type TaskUrgency = "today" | "thisWeek" | "whenFree"; // 優先度（いつやるか）
export type TaskStatus = "未完了" | "後でやる";
export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";
export type NotificationVolume = "none" | "small" | "medium" | "large";
export type FixedReminderUnit = "minutes" | "hours" | "days" | "weeks";
export type PostponeMessageType = "gentle" | "normal" | "strict" | "cheer";

export interface FixedReminder {
  unit: FixedReminderUnit;
  value: number;
}

// users/{uid}/tasks/{taskId}
export interface Task {
  id: string;
  name?: string;
  title?: string; // nameと同じ値を保存する旧互換フィールド（読み取りのフォールバックに使われる）
  description?: string;
  memo?: string; // descriptionと同じ値を保存する旧互換フィールド
  color?: TaskColor;
  priority?: TaskPriority;
  importance?: TaskPriority; // priorityの旧フィールド名（読み取り専用フォールバック）
  priorityLevel?: TaskPriority; // 同上
  urgency?: TaskUrgency;
  status?: TaskStatus;
  dueDate?: string | null; // "YYYY-MM-DD"
  date?: string | null; // dueDateの旧フィールド名（読み取り専用フォールバック）
  dueTime?: string | null; // "HH:MM"
  repeat?: RepeatFrequency;
  lastCompletedAt?: FirestoreTimestampLike | null;
  enabled?: boolean;
  frequency?: NotificationVolume;
  frequencyUnit?: "day" | "week";
  frequencyCount?: number;
  fixedReminders?: FixedReminder[];
  laterCount?: number;
  laterTime?: string | null;
  lastPostponedAt?: FirestoreTimestampLike | null;
  createdAt?: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
  notifyDate?: string; // 非常に古い形式の通知日時（読み取り専用フォールバック）
  time?: string; // 同上
}

// users/{uid}/completedTasks/{id}（完了時点のtaskスナップショット＋履歴用メタデータ）
export interface CompletedTask extends Task {
  originalTaskId: string;
  deletedAt: FirestoreTimestampLike; // 完了日時
  removedFromHistory?: boolean; // 一覧からの論理削除フラグ（統計・達成率の集計には影響しない）
  removedFromHistoryAt?: FirestoreTimestampLike;
}

export interface ExcludeTimeRange {
  start: string;
  end: string;
}

export interface NotificationSettings {
  startTime: string;
  endTime: string;
  excludeTimes: ExcludeTimeRange[];
  notificationTypes: string[];
  messageType: PostponeMessageType;
  enabled: boolean;
}

export type LabelNames = Partial<Record<Exclude<TaskColor, "none">, string>>;

// users/{uid}
export interface UserData {
  fcmToken?: string | null;
  notificationSettings?: NotificationSettings;
  labelNames?: LabelNames;
  discoveredStatuses?: string[];
  streakCurrent?: number;
  streakLongest?: number;
  streakLastDate?: string; // "YYYY-MM-DD"
}
