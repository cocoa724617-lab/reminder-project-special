import { useState } from "react";
import { useAuth } from "../contexts/useAuth.js";
import { useTask } from "./useTasks.js";
import { delayTaskWithLaterTime, setTaskStatus } from "../services/taskService.js";

// 既存 atodeyaru.html の POSTPONE_LIMIT と同じ値：
// この回数以上「あとでやる」を選ぶと、確認モーダル（postpone-limit-modal相当）を挟む。
export const POSTPONE_LIMIT = 3;

// PostponePage 用：対象タスクの取得と、あとでやる／今やるの更新をまとめて扱うフック。
// useTask はユーザー自身の tasks サブコレクションだけを見るため、他ユーザーのタスクIDを渡しても
// 何も返らない（＝URLを書き換えても他ユーザーのタスクは操作できない）。
export function usePostponeTask(taskId) {
  const { currentUser } = useAuth();
  const { task, isLoading, error } = useTask(taskId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  async function postpone(laterTime) {
    if (!currentUser || !taskId || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await delayTaskWithLaterTime(currentUser.uid, taskId, laterTime);
    } catch (err) {
      console.error("タスクの後回しに失敗しました:", err);
      setSaveError(err);
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
      setSaveError(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return { task, isLoading, error, isSaving, saveError, postpone, doNow };
}
