import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { fetchRecentCompletedTasks } from "../services/taskService.js";

// ログイン中ユーザーの直近 days 日分の完了済みタスクを取得するフック。
// uid は AuthContext から取る。ProtectedRoute の内側で使う前提のため
// currentUser が無い場合は空配列のまま何もしない（ログアウト直後の一瞬などの保険）。
export function useRecentCompletedTasks(days = 14) {
  const { currentUser } = useAuth();
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) {
      setCompletedTasks([]);
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    fetchRecentCompletedTasks(currentUser.uid, days)
      .then((tasks) => {
        if (isCancelled) return;
        setCompletedTasks(tasks);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error("完了済みタスクの取得に失敗しました:", err);
        setError(err);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentUser, days]);

  return { completedTasks, isLoading, error };
}
