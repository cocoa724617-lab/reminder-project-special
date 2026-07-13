import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  increment,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";

function tasksCollection(uid) {
  return collection(db, "users", uid, "tasks");
}

// 既存 tasks-data.js の loadTask と同じ仕様：編集画面で1件だけ取得する。
export async function fetchTask(uid, taskId) {
  const snap = await getDoc(doc(db, "users", uid, "tasks", taskId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

// 既存 tasks-data.js の saveTask と同じ仕様：新規は自動採番、編集は同じidに上書き保存する。
// 新規作成時のみ createdAt を付与する（userStatusUtils の登録日集計に必要。編集時は既存の createdAt を保持）。
export async function saveTask(uid, task) {
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

// 既存 tasks-data.js の clearFixedReminders と同じ仕様：
// 「この日時に必ず通知する」設定はタスク保存のたびに作り直すため、まず既存分を消す。
export async function clearFixedReminders(uid, taskId) {
  const remindersQuery = query(
    collection(db, "reminders"),
    where("uid", "==", uid),
    where("taskId", "==", taskId),
    where("kind", "==", "fixed"),
  );
  const snapshot = await getDocs(remindersQuery);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

// 既存 tasks-data.js の saveFixedReminders と同じ仕様。
export async function saveFixedReminders(uid, taskId, title, fcmToken, reminders) {
  await clearFixedReminders(uid, taskId);
  await Promise.all(
    reminders.map((reminder) =>
      addDoc(collection(db, "reminders"), {
        uid,
        taskId,
        title,
        body: "指定した日時のお知らせです",
        remindAt: Timestamp.fromDate(new Date(`${reminder.date}T${reminder.time}:00+09:00`)),
        fcmToken,
        kind: "fixed",
        notified: false,
        createdAt: serverTimestamp(),
      }),
    ),
  );
}

// 既存 tasks-data.js の loadTasks と同じ仕様：ユーザーの未完了タスク一覧（tasksサブコレクション全件）を取得する。
export async function fetchTasks(uid) {
  const snapshot = await getDocs(tasksCollection(uid));
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
}

// 既存 tasks-data.js の loadCompletedTasks と同じ仕様：完了済みタスクの全履歴を取得する
// （実績画面用の fetchRecentCompletedTasks とは異なり、期間で絞り込まない）。
export async function fetchCompletedTasks(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "completedTasks"));
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
}

// 既存 tasks-data.js の loadRecentCompletedTasks と同じ仕様：
// 実績画面は履歴全件ではなく直近 days 日分だけを使うため、期間を絞って取得する。
export async function fetchRecentCompletedTasks(uid, days = 14) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  const recentQuery = query(
    collection(db, "users", uid, "completedTasks"),
    where("deletedAt", ">=", Timestamp.fromDate(cutoff)),
  );
  const snapshot = await getDocs(recentQuery);
  return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id }));
}

// 既存 tasks-data.js の cancelPendingReminders と同じ仕様：未通知のリマインダーを削除する。
async function cancelPendingReminders(uid, taskId) {
  const remindersQuery = query(
    collection(db, "reminders"),
    where("uid", "==", uid),
    where("taskId", "==", taskId),
    where("notified", "==", false),
  );
  const snapshot = await getDocs(remindersQuery);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

function isRepeatingTask(task) {
  return !!task.repeat && task.repeat !== "none";
}

// 既存 tasks-data.js の computeNextDueDate と同じ仕様：繰り返しタスクの次回期限を計算する。
function computeNextDueDate(dueDateStr, repeat) {
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

// 既存 tasks-data.js の completeTask と同じ仕様：
// completedTasks へ履歴を書き込み、繰り返しタスクなら次回期限へリセット、そうでなければ tasks から削除し、
// 保留中のリマインダーも合わせてキャンセルする。
export async function completeTask(uid, task) {
  const completedId = `${task.id}_${Date.now()}`;
  const completedAt = new Date();
  await setDoc(doc(db, "users", uid, "completedTasks", completedId), {
    ...task,
    originalTaskId: task.id,
    deletedAt: serverTimestamp(),
  });

  if (isRepeatingTask(task)) {
    await updateDoc(doc(db, "users", uid, "tasks", task.id), {
      status: "未完了",
      dueDate: computeNextDueDate(task.dueDate, task.repeat),
      laterCount: 0,
      lastPostponedAt: null,
      laterTime: null,
      updatedAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(doc(db, "users", uid, "tasks", task.id));
  }

  await cancelPendingReminders(uid, task.id);

  return { ...task, id: completedId, originalTaskId: task.id, deletedAt: completedAt };
}

// 既存 tasks-data.js の setTaskStatus と同じ仕様：statusフィールドだけを更新する
// （あとでやる画面の「今やる」＝後でやる状態の解除に使う）。
export async function setTaskStatus(uid, taskId, status) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), { status });
}

// 既存 tasks-data.js の delayTaskWithLaterTime と同じ仕様：
// 「あとでやる」時に選んだ時間帯を保存する。dueDateやupdatedAtは元実装でも更新していないため、ここでも触らない。
// laterTimeは実際のリマインダー再スケジュールには使われず（Cloud Functions側は見ていない）、
// 表示・統計用のメタデータとして保存されるだけ。
export async function delayTaskWithLaterTime(uid, taskId, laterTime) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), {
    status: "後でやる",
    laterTime,
    laterCount: increment(1),
    lastPostponedAt: serverTimestamp(),
  });
}

// 既存 tasks-data.js の deleteTask と同じ仕様：タスク本体を削除し、保留中のリマインダーもキャンセルする。
export async function deleteTask(uid, taskId) {
  await deleteDoc(doc(db, "users", uid, "tasks", taskId));
  await cancelPendingReminders(uid, taskId);
}

// 完了済みタスクの削除。
// 実装上の仮定：既存アプリの completed-tasks.html にはこの操作自体が存在しないため、
// 一番素直な実装（ドキュメントを削除するだけ）とした。completeTask の時点で該当タスクの
// 保留中リマインダーは既にキャンセル済みのため、ここでの追加のリマインダー処理は行わない。
export async function deleteCompletedTask(uid, completedTaskId) {
  await deleteDoc(doc(db, "users", uid, "completedTasks", completedTaskId));
}

// 既存 user-data.js の loadUserData と同じ場所（users/{uid}）から labelNames だけを取り出す。
export async function fetchUserLabelNames(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().labelNames || {} : {};
}
