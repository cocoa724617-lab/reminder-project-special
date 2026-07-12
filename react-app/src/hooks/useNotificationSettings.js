import { useEffect, useState } from "react";
import { useAuth } from "../contexts/useAuth.js";
import { fetchUserData, saveNotificationSettings, saveLabelNames } from "../services/userService.js";

// 通知設定画面（および後でやる画面のメッセージタイプ参照）で使う、
// users/{uid} の notificationSettings / labelNames をまとめて読み書きするフック。
// 既存 user-data.js の loadUserData / saveNotificationSettings / saveLabelNames と同じFirestore構造を前提にする。
export function useNotificationSettings() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState(null);
  const [labelNames, setLabelNames] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      if (!currentUser) {
        if (!isCancelled) {
          setSettings(null);
          setLabelNames({});
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const userData = await fetchUserData(currentUser.uid);
        if (!isCancelled) {
          setSettings((userData && userData.notificationSettings) || null);
          setLabelNames((userData && userData.labelNames) || {});
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("通知設定の取得に失敗しました:", err);
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

  // 保存ボタン連打時は isSaving で弾く（二重送信防止）。
  async function save(nextSettings, nextLabelNames) {
    if (!currentUser || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      await saveNotificationSettings(currentUser.uid, nextSettings);
      await saveLabelNames(currentUser.uid, nextLabelNames);
      setSettings(nextSettings);
      setLabelNames(nextLabelNames);
      setSaveSuccess(true);
    } catch (err) {
      console.error("通知設定の保存に失敗しました:", err);
      setSaveError(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  return { settings, labelNames, isLoading, error, isSaving, saveError, saveSuccess, save };
}
