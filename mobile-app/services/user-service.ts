import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { LabelNames, NotificationSettings, UserData } from "../types/task";

// 既存 user-data.js の loadUserData と同じ仕様：users/{uid} ドキュメントをそのまま返す。
export async function fetchUserData(uid: string): Promise<UserData | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserData) : null;
}

// 既存 user-data.js の saveFcmToken と同じ仕様・同じフィールド名（トップレベル fcmToken、merge保存）。
export async function saveFcmToken(uid: string, token: string) {
  await setDoc(doc(db, "users", uid), { fcmToken: token }, { merge: true });
}

// 既存 user-data.js の saveNotificationSettings と同じ仕様・同じフィールド名（notificationSettings、merge保存）。
export async function saveNotificationSettings(uid: string, settings: NotificationSettings) {
  await setDoc(doc(db, "users", uid), { notificationSettings: settings }, { merge: true });
}

// 既存 user-data.js の saveLabelNames と同じ仕様・同じフィールド名（labelNames、merge保存）。
export async function saveLabelNames(uid: string, labelNames: LabelNames) {
  await setDoc(doc(db, "users", uid), { labelNames }, { merge: true });
}

// ステータス発見度用：これまでに一度でも該当したステータスのキー一覧（discoverStatusKeysで重複排除済み）。
export async function fetchDiscoveredStatuses(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().discoveredStatuses as string[]) || [] : [];
}

export async function saveDiscoveredStatuses(uid: string, discoveredStatusKeys: string[]) {
  await setDoc(doc(db, "users", uid), { discoveredStatuses: discoveredStatusKeys }, { merge: true });
}
