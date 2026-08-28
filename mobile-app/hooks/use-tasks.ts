import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/auth-context";
import {
  fetchTasks,
  fetchTask,
  fetchRecentCompletedTasks,
  fetchUserLabelNames,
  completeTask as completeTaskInFirestore,
  deleteTask as deleteTaskInFirestore,
  deleteCompletedTask as deleteCompletedTaskInFirestore,
} from "../services/task-service";
import type { CompletedTask, LabelNames, Task } from "../types/task";

// 既存 react-app/src/hooks/useTasks.js の移植（Phase2でuseLabelNames/useRecentCompletedTasksを追加）。
// useCompletedTasks（完了済み全履歴） / useDiscoveredStatuses / useStreak はまだ使う画面が無いため、
// Phase3（完了済みタスク一覧・ステータス発見度・連続記録の画面を作る際）に追加する。

// ログイン中ユーザーの未完了タスク一覧を取得するフック。
// removeTask、および completeTask の通常タスクは、Firestore を更新したあとローカルの一覧からも
// 該当タスクを取り除く（既存 task-list.html の tasks.splice(...); render(); と同じ、再取得しない楽観更新）。
// completeTask の繰り返しタスクは Firestore 上で消えないため、一覧からは取り除かず更新後の内容に差し替える。
//
// Web版からの変更点：refetch を追加した。RN版はHome/タスク一覧のタブが常駐したままタスク登録・編集画面へ
// モーダル遷移するため、フォーム側から「一覧側のstateを直接書き換える」手段が無い。戻ってきたタイミングで
// 呼び出し側（画面）が useFocusEffect から refetch() を呼び、素直に取得し直す方式にする。
// 合わせて、Web版の isCancelled（アンマウント時のみガード）より広く、「最後に呼んだfetchの結果だけを
// 採用する」方式（latestRequestIdによる比較）にしている。これは手動refetchと自動読み込みが
// ほぼ同時に走った場合でも、後から返ってきた方の結果で必ず上書きされるようにするため
// （isCancelledのままだと、まれに古いfetchの結果で新しい結果を上書きしてしまう可能性がある）。
export function useTasks() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const latestRequestId = useRef(0);

  const refetch = useCallback(async () => {
    if (!currentUser) {
      setTasks([]);
      setIsLoading(false);
      return;
    }

    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchTasks(currentUser.uid);
      if (latestRequestId.current === requestId) setTasks(result);
    } catch (err) {
      if (latestRequestId.current === requestId) {
        console.error("タスクの取得に失敗しました:", err);
        setError(err as Error);
      }
    } finally {
      if (latestRequestId.current === requestId) setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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

  return { tasks, isLoading, error, completeTask, removeTask, refetch };
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

// ログイン中ユーザーの直近 days 日分の完了済みタスクを取得するフック（タスク一覧の完了済みセクション用）。
export function useRecentCompletedTasks(days = 14) {
  const { currentUser } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) {
          setCompletedTasks([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const tasks = await fetchRecentCompletedTasks(currentUser.uid, days);
        if (!isCancelled) setCompletedTasks(tasks);
      } catch (err) {
        if (!isCancelled) {
          console.error("完了済みタスクの取得に失敗しました:", err);
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
  }, [currentUser, days]);

  async function removeCompletedTask(completedTaskId: string) {
    if (!currentUser) throw new Error("ログインしていません");
    await deleteCompletedTaskInFirestore(currentUser.uid, completedTaskId);
    setCompletedTasks((prev) => prev.filter((t) => t.id !== completedTaskId));
  }

  return { completedTasks, isLoading, error, removeCompletedTask };
}

// ユーザーが設定画面で付け替えたラベル名。取得に失敗しても致命的ではないため、
// エラーはコンソールに残すだけでページ全体は落とさず、デフォルト（空オブジェクト）にフォールバックする。
export function useLabelNames(): LabelNames {
  const { currentUser } = useAuth();
  const [labelNames, setLabelNames] = useState<LabelNames>({});

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) setLabelNames({});
        return;
      }

      try {
        const names = await fetchUserLabelNames(currentUser.uid);
        if (!isCancelled) setLabelNames((names as LabelNames) || {});
      } catch (err) {
        console.error("ラベル名の取得に失敗しました:", err);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  return labelNames;
}
