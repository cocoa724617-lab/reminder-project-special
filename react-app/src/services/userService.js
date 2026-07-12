import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase.js";

// 既存 user-data.js の loadUserData と同じ仕様：users/{uid} ドキュメントをそのまま返す。
export async function fetchUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// 既存 user-data.js の saveFcmToken と同じ仕様・同じフィールド名（トップレベル fcmToken、merge保存）。
export async function saveFcmToken(uid, token) {
  await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
}

// 既存 user-data.js の saveNotificationSettings と同じ仕様・同じフィールド名（notificationSettings、merge保存）。
export async function saveNotificationSettings(uid, settings) {
  await setDoc(doc(db, "users", uid), { notificationSettings: settings }, { merge: true });
}

// 既存 user-data.js の saveLabelNames と同じ仕様・同じフィールド名（labelNames、merge保存）。
export async function saveLabelNames(uid, labelNames) {
  await setDoc(doc(db, "users", uid), { labelNames }, { merge: true });
}
