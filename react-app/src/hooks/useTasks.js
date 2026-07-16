import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../contexts/useAuth.js";
import {
  fetchRecentCompletedTasks,
  fetchTasks,
  fetchTask,
  fetchCompletedTasks,
  completeTask as completeTaskInFirestore,
  deleteTask as deleteTaskInFirestore,
  deleteCompletedTask as deleteCompletedTaskInFirestore,
  fetchUserLabelNames,
} from "../services/taskService.js";
import { fetchDiscoveredStatuses, saveDiscoveredStatuses } from "../services/userService.js";
import { discoverStatusKeys } from "../utils/userStatusUtils.js";

// ログイン中ユーザーの直近 days 日分の完了済みタスクを取得するフック。
// uid は AuthContext から取る。ProtectedRoute の内側で使う前提のため
// currentUser が無い場合は空配列のまま何もしない（ログアウト直後の一瞬などの保険）。
export function useRecentCompletedTasks(days = 14) {
  const { currentUser } = useAuth();
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setError(err);
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

  async function removeCompletedTask(completedTaskId) {
    await deleteCompletedTaskInFirestore(currentUser.uid, completedTaskId);
    setCompletedTasks((prev) => prev.filter((t) => t.id !== completedTaskId));
  }

  return { completedTasks, isLoading, error, removeCompletedTask };
}

// ログイン中ユーザーの未完了タスク一覧を取得するフック。
// removeTask、および completeTask の通常タスクは、Firestore を更新したあとローカルの一覧からも
// 該当タスクを取り除く（既存 task-list.html の tasks.splice(...); render(); と同じ、再取得しない楽観更新）。
// completeTask の繰り返しタスクは Firestore 上で消えないため、一覧からは取り除かず更新後の内容に差し替える。
export function useTasks() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setError(err);
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
  async function completeTask(task) {
    const { completedEntry, updatedTask } = await completeTaskInFirestore(currentUser.uid, task);
    setTasks((prev) =>
      updatedTask ? prev.map((t) => (t.id === task.id ? updatedTask : t)) : prev.filter((t) => t.id !== task.id),
    );
    return completedEntry;
  }

  async function removeTask(taskId) {
    await deleteTaskInFirestore(currentUser.uid, taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  return { tasks, isLoading, error, completeTask, removeTask };
}

// ログイン中ユーザーの完了済みタスク全履歴を取得するフック（期間フィルタは呼び出し側で行う）。
export function useCompletedTasks() {
  const { currentUser } = useAuth();
  const [completedTasks, setCompletedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setError(err);
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

  async function removeCompletedTask(completedTaskId) {
    await deleteCompletedTaskInFirestore(currentUser.uid, completedTaskId);
    setCompletedTasks((prev) => prev.filter((t) => t.id !== completedTaskId));
  }

  return { completedTasks, isLoading, error, removeCompletedTask };
}

// ユーザーが設定画面で付け替えたラベル名。取得に失敗しても致命的ではないため、
// エラーはコンソールに残すだけでページ全体は落とさず、デフォルト（空オブジェクト）にフォールバックする。
export function useLabelNames() {
  const { currentUser } = useAuth();
  const [labelNames, setLabelNames] = useState({});

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) setLabelNames({});
        return;
      }

      try {
        const names = await fetchUserLabelNames(currentUser.uid);
        if (!isCancelled) setLabelNames(names || {});
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

// ステータス発見度用：これまでに発見済みのステータスキー一覧を users/{uid}.discoveredStatuses から取得し、
// 新たに該当したステータスをマージして永続化する。currentStatuses（今まさに該当しているものだけ）とは違い、
// 過去に該当して今は該当しなくなったステータスも発見数から消えないようにするための蓄積。
export function useDiscoveredStatuses() {
  const { currentUser } = useAuth();
  const [discoveredKeys, setDiscoveredKeys] = useState([]);
  // Firestoreからの初回読み込みが終わったuidを記録する。currentUserのuidと一致するまでは
  // discoveredKeysがまだ空のプレースホルダーの可能性があるため、一致前に recordDiscoveries を呼ぶと
  // 「既に発見済みのステータス」まで新規発見と誤判定してしまう（保存時に過去の発見分も上書き消去してしまう）。
  const [loadedForUid, setLoadedForUid] = useState(undefined);
  // 今回のマージで新たに発見されたステータス（演出表示用）。表示側で消費したら clearNewlyDiscovered で空にする。
  const [newlyDiscovered, setNewlyDiscovered] = useState([]);

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
        if (!isCancelled) setDiscoveredKeys(keys);
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
  // useCallback で参照を固定し、呼び出し側（HomePage の useEffect）の依存配列に安全に含められるようにする。
  const recordDiscoveries = useCallback(
    (currentStatuses) => {
      setDiscoveredKeys((prevKeys) => {
        const merged = discoverStatusKeys(prevKeys, currentStatuses);
        if (merged.length === prevKeys.length) return prevKeys;

        const prevKeySet = new Set(prevKeys);
        const newlyAdded = (Array.isArray(currentStatuses) ? currentStatuses : []).filter(
          (status) => status && status.key && !prevKeySet.has(status.key),
        );
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

// タスク登録・編集フォーム用：taskId が指定されている間だけ既存タスクを1件取得する
// （新規作成時は taskId が無いので何もしない＝isLoading は false のまま）。
export function useTask(taskId) {
  const { currentUser } = useAuth();
  const [task, setTask] = useState(null);
  const [isLoading, setIsLoading] = useState(!!taskId);
  const [error, setError] = useState(null);

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
          setError(err);
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
