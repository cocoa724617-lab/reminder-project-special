import { db } from "./firebase-init.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

export async function loadUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function saveFcmToken(uid, token) {
  await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
}

export async function saveNotificationSettings(uid, settings) {
  await setDoc(doc(db, "users", uid), { notificationSettings: settings }, { merge: true });
}
