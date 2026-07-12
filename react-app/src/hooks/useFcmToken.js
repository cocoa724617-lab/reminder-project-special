import { useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/useAuth.js";
import { isPushSupported } from "./usePwaEnvironment.js";
import { registerFcmServiceWorker, fetchFcmToken } from "../services/fcmService.js";
import { saveFcmToken } from "../services/userService.js";

// FCM登録処理を1か所にまとめたフック。
// 既存 index.html / task-form.html / notification-settings.html にそれぞれコピペされていた
// 「Service Worker登録→Messaging初期化→getToken→Firestore保存」の一連の処理をここへ集約し、
// window.currentFcmToken のようなグローバル変数は使わずReact stateで持つ。
//
// 許可要求(Notification.requestPermission)はユーザー操作からの requestPermission() 呼び出し時のみ行う。
// 一方、すでに許可済み(granted)の場合は、トークンをFirestoreへ同期しておくために
// マウント時・ユーザー切り替え時に許可ダイアログを出さずトークンだけ静かに取得し直す
// （grantedな状態でgetTokenを呼んでも再度許可を尋ねられることはない）。
export function useFcmToken() {
  const { currentUser } = useAuth();
  const supported = isPushSupported();

  const [permission, setPermission] = useState(() => (supported ? Notification.permission : "unsupported"));
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);

  // 非同期処理の完了時に「その処理を開始した時点のユーザーが今も最新か」を確認するための最新値ref。
  // ログアウト後に別ユーザーのトークンとして誤保存されるのを防ぐ。refへの書き込みはレンダー中ではなく
  // 専用のeffect内でのみ行う（レンダー中にrefを書き換えないルールに合わせるため）。
  const currentUidRef = useRef(currentUser ? currentUser.uid : null);
  useEffect(() => {
    currentUidRef.current = currentUser ? currentUser.uid : null;
  });

  // currentUserが無いときはtokenステートを明示的にクリアしない（effect内での同期的setStateを避けるため）。
  // 代わりにフックの戻り値側でマスクする。
  const effectiveToken = currentUser ? token : null;

  useEffect(() => {
    if (!currentUser) return;
    if (!supported || Notification.permission !== "granted") return;

    let isCancelled = false;
    const uidAtRequestTime = currentUser.uid;

    (async () => {
      try {
        const swRegistration = await registerFcmServiceWorker();
        const nextToken = await fetchFcmToken(swRegistration);
        if (isCancelled) return;

        if (nextToken) {
          setToken(nextToken);
          if (currentUidRef.current === uidAtRequestTime) {
            await saveFcmToken(uidAtRequestTime, nextToken);
          }
        }
      } catch (err) {
        // トークン取得に失敗しても通常機能（タスク登録など）は止めない。詳細はコンソールにのみ残す。
        console.error("FCMトークンの取得に失敗しました:", err);
        if (!isCancelled) setError(err);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [currentUser, supported]);

  async function requestPermission() {
    if (!currentUser || !supported || isRequesting) return;

    setIsRequesting(true);
    setError(null);
    const uidAtRequestTime = currentUser.uid;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") return;

      const swRegistration = await registerFcmServiceWorker();
      const nextToken = await fetchFcmToken(swRegistration);

      if (!nextToken) {
        setError(new Error("トークンの取得に失敗しました。時間をおいて再度お試しください。"));
        return;
      }

      if (currentUidRef.current === uidAtRequestTime) {
        setToken(nextToken);
        await saveFcmToken(uidAtRequestTime, nextToken);
      }
    } catch (err) {
      console.error("通知許可またはトークン取得でエラー:", err);
      setError(err);
    } finally {
      setIsRequesting(false);
    }
  }

  return { isSupported: supported, permission, token: effectiveToken, error, isRequesting, requestPermission };
}
