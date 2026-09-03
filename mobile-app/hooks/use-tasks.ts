import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/auth-context";
import {
  fetchTasks,
  fetchTask,
  fetchCompletedTasks,
  fetchRecentCompletedTasks,
  fetchUserLabelNames,
  completeTask as completeTaskInFirestore,
  deleteTask as deleteTaskInFirestore,
  deleteCompletedTask as deleteCompletedTaskInFirestore,
} from "../services/task-service";
import { fetchDiscoveredStatuses, saveDiscoveredStatuses, fetchUserData } from "../services/user-service";
import { discoverStatusKeys, type StatusDefinition, type StatusKey } from "../utils/user-status-utils";
import type { CompletedTask, LabelNames, Task } from "../types/task";

// 既存 react-app/src/hooks/useTasks.js の移植（Phase2でuseLabelNames/useRecentCompletedTasksを追加、
// Phase3でuseCompletedTasks/useDiscoveredStatuses/useStreakを追加）。

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

// ログイン中ユーザーの直近 days 日分の完了済みタスクを取得するフック（タスク一覧の完了済みセクション・
// ホーム画面のステータス集計用）。
// Web版からの変更点：refetch を追加した（useTasksと同じ理由）。ホーム画面はステータス判定・週間進捗の
// 集計にこの値を使うため、タブへ戻った時に最新化できないと古い集計のまま表示され続けてしまう。
export function useRecentCompletedTasks(days = 14) {
  const { currentUser } = useAuth();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!currentUser) {
      setCompletedTasks([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tasks = await fetchRecentCompletedTasks(currentUser.uid, days);
      setCompletedTasks(tasks);
    } catch (err) {
      console.error("完了済みタスクの取得に失敗しました:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function removeCompletedTask(completedTaskId: string) {
    if (!currentUser) throw new Error("ログインしていません");
    await deleteCompletedTaskInFirestore(currentUser.uid, completedTaskId);
    setCompletedTasks((prev) => prev.filter((t) => t.id !== completedTaskId));
  }

  return { completedTasks, isLoading, error, removeCompletedTask, refetch };
}

// ログイン中ユーザーの完了済みタスク全履歴を取得するフック（完了済みタスク画面用、期間で絞り込まない）。
// タブ常駐のuseTasksと違い、この画面（app/completed.tsx）はpushされた非モーダル画面で、
// 開くたびに新しくマウントされる（React Navigationがpop時にアンマウントする）ため、
// useTasksのようなrefetchは不要：毎回の訪問で自然に最新が取れる。
export function useCompletedTasks() {
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
        const result = await fetchCompletedTasks(currentUser.uid);
        if (!isCancelled) setCompletedTasks(result);
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
  }, [currentUser]);

  async function removeCompletedTask(completedTaskId: string) {
    if (!currentUser) throw new Error("ログインしていません");
    await deleteCompletedTaskInFirestore(currentUser.uid, completedTaskId);
    setCompletedTasks((prev) => prev.filter((t) => t.id !== completedTaskId));
  }

  return { completedTasks, isLoading, error, removeCompletedTask };
}

// ユーザーが設定画面で付け替えたラベル名。取得に失敗しても致命的ではないため、
// エラーはコンソールに残すだけでページ全体は落とさず、デフォルト（空オブジェクト）にフォールバックする。
//
// Web版からの変更点：refetch を追加した（useTasksと同じ理由）。設定タブでラベル名を保存したあと、
// 常駐しているHome/タスク一覧/あとでタブへ戻った時にuseFocusEffectから呼び、最新の名前を反映する。
export function useLabelNames() {
  const { currentUser } = useAuth();
  const [labelNames, setLabelNames] = useState<LabelNames>({});

  const refetch = useCallback(async () => {
    if (!currentUser) {
      setLabelNames({});
      return;
    }

    try {
      const names = await fetchUserLabelNames(currentUser.uid);
      setLabelNames((names as LabelNames) || {});
    } catch (err) {
      console.error("ラベル名の取得に失敗しました:", err);
    }
  }, [currentUser]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { labelNames, refetch };
}

// ステータス発見度用：これまでに発見済みのステータスキー一覧を users/{uid}.discoveredStatuses から取得し、
// 新たに該当したステータスをマージして永続化する。currentStatuses（今まさに該当しているものだけ）とは違い、
// 過去に該当して今は該当しなくなったステータスも発見数から消えないようにするための蓄積。
export function useDiscoveredStatuses() {
  const { currentUser } = useAuth();
  const [discoveredKeys, setDiscoveredKeys] = useState<StatusKey[]>([]);
  // Firestoreからの初回読み込みが終わったuidを記録する。currentUserのuidと一致するまでは
  // discoveredKeysがまだ空のプレースホルダーの可能性があるため、一致前に recordDiscoveries を呼ぶと
  // 「既に発見済みのステータス」まで新規発見と誤判定してしまう（保存時に過去の発見分も上書き消去してしまう）。
  const [loadedForUid, setLoadedForUid] = useState<string | null | undefined>(undefined);
  // 今回のマージで新たに発見されたステータス（演出表示用）。表示側で消費したら clearNewlyDiscovered で空にする。
  const [newlyDiscovered, setNewlyDiscovered] = useState<StatusDefinition[]>([]);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) {
          setDiscoveredKeys([]);
          setLoadedForUid(null);
        }
        return;
      }

      try {
        const keys = await fetchDiscoveredStatuses(currentUser.uid);
        if (!isCancelled) setDiscoveredKeys(keys as StatusKey[]);
      } catch (err) {
        console.error("発見済みステータスの取得に失敗しました:", err);
      } finally {
        if (!isCancelled) setLoadedForUid(currentUser.uid);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  const isLoaded = loadedForUid === (currentUser ? currentUser.uid : null);

  // 現在該当しているステータス群を発見済み一覧にマージする（discoverStatusKeys がSetで重複を排除するため、
  // 同じステータスを何度呼んでも二重にカウントされない）。新規発見が無ければ書き込みは行わない。
  // useCallback で参照を固定し、呼び出し側（HomeScreen の useEffect）の依存配列に安全に含められるようにする。
  const recordDiscoveries = useCallback(
    (currentStatuses: StatusDefinition[]) => {
      setDiscoveredKeys((prevKeys) => {
        const merged = discoverStatusKeys(prevKeys, currentStatuses);
        if (merged.length === prevKeys.length) return prevKeys;

        const prevKeySet = new Set(prevKeys);
        const newlyAdded = currentStatuses.filter((status) => status && status.key && !prevKeySet.has(status.key));
        if (newlyAdded.length > 0) {
          setNewlyDiscovered((prev) => [...prev, ...newlyAdded]);
        }

        if (currentUser) {
          saveDiscoveredStatuses(currentUser.uid, merged).catch((err) => {
            console.error("発見済みステータスの保存に失敗しました:", err);
          });
        }
        return merged;
      });
    },
    [currentUser],
  );

  const clearNewlyDiscovered = useCallback(() => setNewlyDiscovered([]), []);

  return { discoveredKeys, isLoaded, recordDiscoveries, newlyDiscovered, clearNewlyDiscovered };
}

export interface Streak {
  current: number;
  longest: number;
}

// 連続達成日数（ストリーク）表示用：users/{uid}.streakCurrent / streakLongest を取得する。
// タスク完了直後は再取得を待たず、completeTask()が返す最新値をそのまま反映できるよう
// applyStreak を公開する（services/task-service.ts の completeTask 内のトランザクションで既に計算済みのため）。
export function useStreak() {
  const { currentUser } = useAuth();
  const [streak, setStreak] = useState<Streak>({ current: 0, longest: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) {
          setStreak({ current: 0, longest: 0 });
          setIsLoading(false);
        }
        return;
      }

      try {
        const userData = await fetchUserData(currentUser.uid);
        if (!isCancelled) {
          setStreak({
            current: Number(userData?.streakCurrent) || 0,
            longest: Number(userData?.streakLongest) || 0,
          });
        }
      } catch (err) {
        console.error("連続達成日数の取得に失敗しました:", err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [currentUser]);

  const applyStreak = useCallback((nextStreak: Streak | null | undefined) => {
    if (!nextStreak) return;
    setStreak({ current: nextStreak.current || 0, longest: nextStreak.longest || 0 });
  }, []);

  return { streak, isLoading, applyStreak };
}
