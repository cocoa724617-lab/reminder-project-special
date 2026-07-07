import { db } from "./firebase-init.js";
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
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

function tasksCollection(uid) {
  return collection(db, "users", uid, "tasks");
}

export async function loadTasks(uid) {
  const snapshot = await getDocs(tasksCollection(uid));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function loadCompletedTasks(uid) {
  const snapshot = await getDocs(collection(db, "users", uid, "completedTasks"));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function loadTask(uid, taskId) {
  const snap = await getDoc(doc(db, "users", uid, "tasks", taskId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveTask(uid, task) {
  const id = task.id || doc(tasksCollection(uid)).id;
  await setDoc(doc(db, "users", uid, "tasks", id), {
    ...task,
    id,
    updatedAt: serverTimestamp()
  });
  return id;
}

export async function setTaskStatus(uid, taskId, status) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), { status });
}

export async function delayTaskWithLaterTime(uid, taskId, laterTime) {
  await updateDoc(doc(db, "users", uid, "tasks", taskId), {
    status: '後でやる',
    laterTime,
    laterCount: increment(1),
    lastPostponedAt: serverTimestamp()
  });
}

async function cancelPendingReminders(uid, taskId) {
  const remindersQuery = query(
    collection(db, "reminders"),
    where("uid", "==", uid),
    where("taskId", "==", taskId),
    where("notified", "==", false)
  );
  const snapshot = await getDocs(remindersQuery);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

function isRepeatingTask(task) {
  return !!task.repeat && task.repeat !== 'none';
}

function computeNextDueDate(dueDateStr, repeat) {
  const base = dueDateStr ? new Date(`${dueDateStr}T00:00:00`) : new Date();
  if (repeat === 'daily') base.setDate(base.getDate() + 1);
  else if (repeat === 'weekly') base.setDate(base.getDate() + 7);
  else if (repeat === 'monthly') base.setMonth(base.getMonth() + 1);
  else if (repeat === 'yearly') base.setFullYear(base.getFullYear() + 1);

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function completeTask(uid, task) {
  // completedTasksのidはtask.idと分ける：繰り返しタスクは同じtask.idで何度も完了するため、履歴を上書きしないようにする
  const completedId = `${task.id}_${Date.now()}`;
  await setDoc(doc(db, "users", uid, "completedTasks", completedId), {
    ...task,
    originalTaskId: task.id,
    deletedAt: serverTimestamp()
  });

  if (isRepeatingTask(task)) {
    await updateDoc(doc(db, "users", uid, "tasks", task.id), {
      status: '未完了',
      dueDate: computeNextDueDate(task.dueDate, task.repeat),
      laterCount: 0,
      lastPostponedAt: null,
      laterTime: null,
      updatedAt: serverTimestamp()
    });
  } else {
    await deleteDoc(doc(db, "users", uid, "tasks", task.id));
  }

  await cancelPendingReminders(uid, task.id);
}

export async function deleteTask(uid, taskId) {
  await deleteDoc(doc(db, "users", uid, "tasks", taskId));
  await cancelPendingReminders(uid, taskId);
}

// 「この日時に必ず通知する」個別リマインダー：タスクごとに毎回作り直す
export async function clearFixedReminders(uid, taskId) {
  const remindersQuery = query(
    collection(db, "reminders"),
    where("uid", "==", uid),
    where("taskId", "==", taskId),
    where("kind", "==", "fixed")
  );
  const snapshot = await getDocs(remindersQuery);
  await Promise.all(snapshot.docs.map((docSnap) => deleteDoc(docSnap.ref)));
}

export async function saveFixedReminders(uid, taskId, title, fcmToken, reminders) {
  await clearFixedReminders(uid, taskId);
  await Promise.all(reminders.map((reminder) => addDoc(collection(db, "reminders"), {
    uid,
    taskId,
    title,
    body: "指定した日時のお知らせです",
    remindAt: Timestamp.fromDate(new Date(`${reminder.date}T${reminder.time}:00+09:00`)),
    fcmToken,
    kind: "fixed",
    notified: false,
    createdAt: serverTimestamp()
  })));
}
