import { db } from "./firebase-init.js";
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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

function tasksCollection(uid) {
  return collection(db, "users", uid, "tasks");
}

export async function loadTasks(uid) {
  const snapshot = await getDocs(tasksCollection(uid));
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

export async function completeTask(uid, task) {
  await setDoc(doc(db, "users", uid, "completedTasks", task.id), {
    ...task,
    deletedAt: serverTimestamp()
  });
  await deleteDoc(doc(db, "users", uid, "tasks", task.id));
  await cancelPendingReminders(uid, task.id);
}
