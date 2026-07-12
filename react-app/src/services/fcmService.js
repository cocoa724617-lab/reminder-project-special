import { getMessaging, getToken } from "firebase/messaging";
import { app } from "./firebase.js";
import { VAPID_KEY } from "./fcmConfig.js";

// 既存 index.html / task-form.html / notification-settings.html で重複していた
// `navigator.serviceWorker.register("firebase-messaging-sw.js")` を1か所にまとめたもの。
export const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";

export async function registerFcmServiceWorker() {
  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  await navigator.serviceWorker.ready;
  return registration;
}

// 既存の VAPID_KEY を使った getToken 呼び出しと同じ仕様。
export async function fetchFcmToken(swRegistration) {
  const messaging = getMessaging(app);
  return getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swRegistration });
}
