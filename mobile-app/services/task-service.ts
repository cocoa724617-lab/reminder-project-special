import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  increment,
  Timestamp,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import { toDateKey } from "../utils/date-utils";
import type { CompletedTask, RepeatFrequency, Task } from "../types/task";

function tasksCollection(uid: string) {
  return collection(db, "users", uid, "tasks");
}

// 既存 tasks-data.js の loadTask と同じ仕様：編集画面で1件だけ取得する。
export async function fetchTask(uid: string, taskId: string): Promise<Task | null> {
  const snap = await getDoc(doc(db, "users", uid, "tasks", taskId));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as Task) : null;
}

// 既存 tasks-data.js の saveTask と同じ仕様：新規は自動採番、編集は同じidに上書き保存する。
// 新規作成時のみ createdAt を付与する（userStatusUtils の登録日集計に必要。編集時は既存の createdAt を保持）。
export async function saveTask(uid: string, task: Omit<Partial<Task>, "id"> & { id?: string | null }): Promise<string> {
  const isNewTask = !task.id;
  const id = task.id || doc(tasksCollection(uid)).id;
  await setDoc(doc(db, "users", uid, "tasks", id), {
    ...task,
    id,
    ...(isNewTask ? { createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  });
  return id;
}

// 既存 tasks-data.js の loadTasks と同じ仕様：ユーザーの未完了タスク一覧（tasksサブコレクション全件）を取得する。
export async function fetchTasks(uid: string): Promise<Task[]> {
  const snapshot = await getDocs(tasksCollection(uid));
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }) as Task);
}

// 既存 tasks-data.js の loadCompletedTasks と同じ仕様：完了済みタスクの全履歴を取得する
// （実績画面用の fetchRecentCompletedTasks とは異なり、期間で絞り込まない）。
export async function fetchCompletedTasks(uid: string): Promise<CompletedTask[]> {
  const snapshot = await getDocs(collection(db, "users", uid, "completedTasks"));
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }) as CompletedTask);
}

// 既存 tasks-data.js の loadRecentCompletedTasks と同じ仕様：
// 実績画面は履歴全件ではなく直近 days 日分だけを使うため、期間を絞って取得する。
export async function fetchRecentCompletedTasks(uid: string, days = 14): Promise<CompletedTask[]> {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  const recentQuery = query(
    collection(db, "users", uid, "completedTasks"),
    where("deletedAt", ">=", Timestamp.fromDate(cutoff)),
  );
  const snapshot = await getDocs(recentQuery);
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }) as CompletedTask);
}

// 既存 tasks-data.js の cancelPendingReminders と同じ仕様：未通知のリマインダーを削除する。
async function cancelPendingReminders(uid: string, taskId: string) {
  const remindersQuery = query(
    collection(db, "reminders"),
    where("uid", "==", uid),
    where("taskId", "==", taskId),
    where("notified", "==", false),
  );
  const snapshot = await getDocs(remindersQuery);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

function isRepeatingTask(task: Task): boolean {
  return !!task.repeat && task.repeat !== "none";
}

// 既存 tasks-data.js の computeNextDueDate と同じ仕様：繰り返しタスクの次回期限を計算する。
function computeNextDueDate(dueDateStr: string | null | undefined, repeat: RepeatFrequency | undefined): string {
  const base = dueDateStr ? new Date(`${dueDateStr}T00:00:00`) : new Date();
  if (repeat === "daily") base.setDate(base.getDate() + 1);
  else if (repeat === "weekly") base.setDate(base.getDate() + 7);
  else if (repeat === "monthly") base.setMonth(base.getMonth() + 1);
  else if (repeat === "yearly") base.setFullYear(base.getFullYear() + 1);

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface StreakInput {
  lastDateKey: string | null;
  todayKey: string;
  yesterdayKey: string;
  currentStreak: number;
  longestStreak: number;
}

// 連続達成日数（ストリーク）の次の値を計算する純粋関数。Firestoreを触らないため単体テストしやすいよう
// updateStreakOnCompletion（トランザクションの配線部分）から切り出している。
// 「日数」のストリークであって完了回数のストリークではないため、同じ日に何度完了しても加算しない。
// 前回カウントした日が「昨日」なら+1、「今日」ならそのまま、それ以外（間が空いた）なら1にリセットする。
// Cloud Functions側のquickCompleteTask（通知のクイック操作用）にも同じロジックのサーバー版があるため、
// 変更する場合は両方を揃えること。
export function computeNextStreak({ lastDateKey, todayKey, yesterdayKey, currentStreak, longestStreak }: StreakInput) {
  if (lastDateKey === todayKey) {
    return { current: currentStreak, longest: longestStreak, changed: false };
  }

  const current = lastDateKey === yesterdayKey ? currentStreak + 1 : 1;
  const longest = Math.max(longestStreak, current);
  return { current, longest, changed: true };
}

// 連続達成日数（ストリーク）の更新。タスク完了のたびに呼ぶ。
// 複数タスクをほぼ同時に完了しても二重加算されないよう、読み取り→判定→書き込みをトランザクションにする。
async function updateStreakOnCompletion(uid: string, now: Date) {
  const todayKey = toDateKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  const userRef = doc(db, "users", uid);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const data = snap.exists() ? snap.data() : {};
    const result = computeNextStreak({
      lastDateKey: data.streakLastDate || null,
      todayKey,
      yesterdayKey,
      currentStreak: Number(data.streakCurrent) || 0,
      longestStreak: Number(data.streakLongest) || 0,
    });

    if (result.changed) {
      transaction.set(
        userRef,
        { streakCurrent: result.current, streakLongest: result.longest, streakLastDate: todayKey },
        { merge: true },
      );
    }
    return { current: result.current, longest: result.longest };
  });
}

// 既存 tasks-data.js の completeTask がベース：
// completedTasks へ履歴を書き込み、繰り返しタスクなら次回期限へリセット、そうでなければ tasks から削除し、
// 保留中のリマインダーも合わせてキャンセルする。
// 移植元にはなかった拡張：繰り返しタスクには lastCompletedAt も書き込む。
// 「今回分は完了済み・次のdueDateが来るまでは未完了扱いにしない」判定（utils/task-labels.ts の getRepeatCycleStatus）
// が、この lastCompletedAt と dueDate だけで完結できるようにするため。
// 戻り値も { completedEntry, updatedTask, streak } になっており、呼び出し側（hooks/use-tasks.ts）がローカルの
// tasks 一覧を「削除」ではなく「更新後の内容で差し替え」できるようにし、ストリーク表示も即時反映できるようにしている
// （繰り返しタスクは Firestore 上では消えていないため、ローカル一覧からも消してはいけない）。
export async function completeTask(uid: string, task: Task) {
  const completedId = `${task.id}_${Date.now()}`;
  const completedAt = new Date();
  await setDoc(doc(db, "users", uid, "completedTasks", completedId), {
    ...task,
    originalTaskId: task.id,
    deletedAt: serverTimestamp(),
  });

  let updatedTask: Task | null = null;
  if (isRepeatingTask(task)) {
    const patch = {
      status: "未完了" as const,
      dueDate: computeNextDueDate(task.dueDate, task.repeat),
      laterCount: 0,
      lastPostponedAt: null,
      laterTime: null,
      lastCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await updateDoc(doc(db, "users", uid, "tasks", task.id), patch);
    updatedTask = { ...task, ...patch, lastCompletedAt: completedAt, updatedAt: completedAt } as Task;
  } else {
    await deleteDoc(doc(db, "users", uid, "tasks", task.id));
  }

  await cancelPendingReminders(uid, task.id);
  const streak = await updateStreakOnCompletion(uid, completedAt);

  const completedEntry: CompletedTask = { ...task, id: completedId, originalTaskId: task.id, deletedAt: completedAt };
  return { completedEntry, updatedTask, streak };
}

// 既存 tasks-data.js の setTaskStatus と同じ仕様：statusフィールドだけを更新する
// （あとでやる画面の「今やる」＝後でやる状態の解除に使う）。
export async function setTaskStatus(uid: string, taskId: string, status: Task["status"]) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), { status });
}

// 既存 tasks-data.js の delayTaskWithLaterTime と同じ仕様：
// 「あとでやる」時に選んだ時間帯を保存する。dueDateやupdatedAtは元実装でも更新していないため、ここでも触らない。
// laterTimeは実際のリマインダー再スケジュールには使われず（Cloud Functions側は見ていない）、
// 表示・統計用のメタデータとして保存されるだけ。
export async function delayTaskWithLaterTime(uid: string, taskId: string, laterTime: string) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), {
    status: "後でやる",
    laterTime,
    laterCount: increment(1),
    lastPostponedAt: serverTimestamp(),
  });
}

// 既存 tasks-data.js の deleteTask と同じ仕様：タスク本体を削除し、保留中のリマインダーもキャンセルする。
export async function deleteTask(uid: string, taskId: string) {
  await deleteDoc(doc(db, "users", uid, "tasks", taskId));
  await cancelPendingReminders(uid, taskId);
}

// 完了済みタスクの「削除」。
// ドキュメント自体は消さず removedFromHistory フラグを立てるだけにする（論理削除）。
// このドキュメントは達成率・ステータス判定の集計（utils/user-status-utils.ts）で今日/直近7日間の
// 完了数としてそのまま数えられているため、物理削除すると一覧から消したいだけのはずが
// 過去の達成実績まで減ってしまう。一覧表示側だけがこのフラグを見て除外し、集計側は無視して全件を対象にする。
export async function deleteCompletedTask(uid: string, completedTaskId: string) {
  await updateDoc(doc(db, "users", uid, "completedTasks", completedTaskId), {
    removedFromHistory: true,
    removedFromHistoryAt: serverTimestamp(),
  });
}

// 既存 user-data.js の loadUserData と同じ場所（users/{uid}）から labelNames だけを取り出す。
export async function fetchUserLabelNames(uid: string): Promise<Record<string, string>> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().labelNames as Record<string, string>) || {} : {};
}
