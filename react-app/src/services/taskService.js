import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "./firebase.js";

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
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}
