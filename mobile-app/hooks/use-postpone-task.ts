import { useState } from "react";
import { useAuth } from "../contexts/auth-context";
import { useTask } from "./use-tasks";
import { delayTaskWithLaterTime, setTaskStatus } from "../services/task-service";

// 既存 react-app/src/hooks/usePostponeTask.js の移植。
// 既存 atodeyaru.html の POSTPONE_LIMIT と同じ値：
// この回数以上「あとでやる」を選ぶと、確認モーダル（postpone-limit-modal相当）を挟む。
export const POSTPONE_LIMIT = 3;

// PostponeScreen 用：対象タスクの取得と、あとでやる／今やるの更新をまとめて扱うフック。
// useTask はユーザー自身の tasks サブコレクションだけを見るため、他ユーザーのタスクIDを渡しても
// 何も返らない（＝URLを書き換えても他ユーザーのタスクは操作できない）。
export function usePostponeTask(taskId?: string | null) {
  const { currentUser } = useAuth();
  const { task, isLoading, error } = useTask(taskId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  async function postpone(laterTime: string) {
    if (!currentUser || !taskId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await delayTaskWithLaterTime(currentUser.uid, taskId, laterTime);
    } catch (err) {
      console.error("タスクの後回しに失敗しました:", err);
      setSaveError(err as Error);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  async function doNow() {
    if (!currentUser || !taskId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await setTaskStatus(currentUser.uid, taskId, "未完了");
    } catch (err) {
      console.error("タスク状態の更新に失敗しました:", err);
      setSaveError(err as Error);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return { task, isLoading, error, isSaving, saveError, postpone, doNow };
}
