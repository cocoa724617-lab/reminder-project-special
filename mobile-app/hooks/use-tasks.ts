import { useEffect, useState } from "react";
import { useAuth } from "../contexts/auth-context";
import {
  fetchTasks,
  fetchTask,
  completeTask as completeTaskInFirestore,
  deleteTask as deleteTaskInFirestore,
} from "../services/task-service";
import type { Task } from "../types/task";

// 既存 react-app/src/hooks/useTasks.js のうち useTasks / useTask のみ移植（Phase1スコープ）。
// useRecentCompletedTasks / useCompletedTasks / useLabelNames / useDiscoveredStatuses / useStreak は
// Phase3（完了済みタスク・ラベル・ステータス発見度・連続記録の画面を作る際）に追加する。

// ログイン中ユーザーの未完了タスク一覧を取得するフック。
// removeTask、および completeTask の通常タスクは、Firestore を更新したあとローカルの一覧からも
// 該当タスクを取り除く（既存 task-list.html の tasks.splice(...); render(); と同じ、再取得しない楽観更新）。
// completeTask の繰り返しタスクは Firestore 上で消えないため、一覧からは取り除かず更新後の内容に差し替える。
export function useTasks() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) {
          setTasks([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchTasks(currentUser.uid);
        if (!isCancelled) setTasks(result);
      } catch (err) {
        if (!isCancelled) {
          console.error("タスクの取得に失敗しました:", err);
          setError(err as Error);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  // 繰り返しタスクは Firestore 上では削除されず更新されるだけなので、ローカル一覧からも
  // 削除するのではなく updatedTask の内容で差し替える（通常タスクは従来通り一覧から取り除く）。
  async function completeTask(task: Task) {
    if (!currentUser) throw new Error("ログインしていません");
    const { completedEntry, updatedTask, streak } = await completeTaskInFirestore(currentUser.uid, task);
    setTasks((prev) =>
      updatedTask ? prev.map((t) => (t.id === task.id ? updatedTask : t)) : prev.filter((t) => t.id !== task.id),
    );
    return { completedEntry, streak };
  }

  async function removeTask(taskId: string) {
    if (!currentUser) throw new Error("ログインしていません");
    await deleteTaskInFirestore(currentUser.uid, taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  return { tasks, isLoading, error, completeTask, removeTask };
}

// タスク登録・編集フォーム用：taskId が指定されている間だけ既存タスクを1件取得する
// （新規作成時は taskId が無いので何もしない＝isLoading は false のまま）。
export function useTask(taskId?: string | null) {
  const { currentUser } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(!!taskId);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser || !taskId) {
        if (!isCancelled) {
          setTask(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchTask(currentUser.uid, taskId);
        if (!isCancelled) setTask(result);
      } catch (err) {
        if (!isCancelled) {
          console.error("タスクの取得に失敗しました:", err);
          setError(err as Error);
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [currentUser, taskId]);

  return { task, isLoading, error };
}
