importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

// 通知のクイックアクション（「完了」「1時間後」ボタンをアプリを開かずに処理する）用。
// 読み込みに失敗しても、通知の受信・表示や下部の静的アセットキャッシュなど他の機能を
// 巻き込んで壊さないよう、ここだけtry/catchする。
let quickActionSdkAvailable = true;
try {
  importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-auth-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-functions-compat.js");
} catch (error) {
  quickActionSdkAvailable = false;
  console.error("クイックアクション用SDKの読み込みに失敗しました:", error);
}

// 既存 firebase-init.js / react-app/src/services/firebase.js と同じ設定値。
firebase.initializeApp({
  apiKey: "AIzaSyDjcQkCw9YSqw2a-VC-jQgM1xxrE-IucB8",
  authDomain: "reminder-project-individual.firebaseapp.com",
  projectId: "reminder-project-individual",
  storageBucket: "reminder-project-individual.firebasestorage.app",
  messagingSenderId: "468795170434",
  appId: "1:468795170434:web:f7a1f644eca28ee5bcde9b",
  measurementId: "G-PZX19T6TTD",
});

const messaging = firebase.messaging();

// 通知の受信処理・表示内容は既存 firebase-messaging-sw.js から変更していない。
// taskIdが含まれる通知（タスクに紐付くリマインダー）だけ、「完了」「1時間後」のクイックアクション
// ボタンを付ける（うっかり防止リマインダー(kind: "daily")のようにタスクに紐付かない通知には出さない）。
messaging.onBackgroundMessage((payload) => {
  console.log("バックグラウンドメッセージ受信:", payload);

  const notificationTitle = payload.data?.title || "リマインダー";
  const taskId = payload.data?.taskId || null;
  // この通知の元になったremindersドキュメントのID。「完了」アクションの二重実行防止
  // （quickCompleteTaskのreminderIdガード）のために、クリック時までそのまま持ち回す。
  const reminderId = payload.data?.reminderId || null;
  // タスクの期限（functions/index.jsのcomputeDeadlineDateが作るミリ秒epoch文字列）。
  // 期限の文言自体はbodyに既に含まれているため、ここはtimestampへの反映のみに使う
  // （対応ブラウザ/OSでは通知タイトル横の時刻表示がこの期限になる。非対応環境では単に無視される）。
  const dueAt = payload.data?.dueAt ? Number(payload.data.dueAt) : null;

  const notificationOptions = {
    body: payload.data?.body || "通知があります",
    data: { taskId, reminderId },
  };

  if (dueAt && Number.isFinite(dueAt)) {
    notificationOptions.timestamp = dueAt;
  }

  if (taskId && quickActionSdkAvailable) {
    notificationOptions.actions = [
      { action: "complete", title: "✅ 完了" },
      { action: "postpone_1h", title: "🕒 1時間後" },
    ];
  }

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Service Workerは初回起動のたびFirebase Authの永続化セッション(IndexedDB)を読み直す必要があるため、
// onAuthStateChangedが一度発火してcurrentUserが確定するまで待つ。タイムアウトはFCMの
// バックグラウンド処理が長時間ブロックされないよう控えめに設定している。
function waitForAuthUser(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error("認証状態の取得がタイムアウトしました"));
    }, timeoutMs);

    const unsubscribe = firebase.auth().onAuthStateChanged(
      (user) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        if (user) resolve(user);
        else reject(new Error("サインインしていません"));
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        unsubscribe();
        reject(error);
      },
    );
  });
}

// 操作に失敗したときだけ、原因が分かる通知を新たに出す
// （成功時は通知を消すだけにして、アプリを開かず完結する体験を優先する）。
function showQuickActionFailureNotification(action) {
  const label = action === "complete" ? "完了" : "1時間後に通知";
  return self.registration.showNotification("操作に失敗しました", {
    body: `「${label}」を反映できませんでした。アプリを開いて操作してください。`,
  });
}

// 通知のアクションボタン用：Cloud FunctionsのquickCompleteTask/quickPostponeTaskを、
// アプリを開かずService Worker内から直接呼ぶ。
// reminderIdは常にquickCompleteTaskへ渡す（quickPostponeTask側は今のところ使わず無視するだけ）。
// 通知の二度押しや、通信不調によるこの呼び出し自体の再送があっても、
// 同じreminderIdを渡す限りquickCompleteTask側で二重完了を防げる。
async function handleQuickAction(action, taskId, reminderId) {
  if (!taskId) return;
  if (!quickActionSdkAvailable) {
    await showQuickActionFailureNotification(action);
    return;
  }

  try {
    await waitForAuthUser();
    const functionName = action === "complete" ? "quickCompleteTask" : "quickPostponeTask";
    const response = await firebase.functions().httpsCallable(functionName)({ taskId, reminderId });
    if (!response || !response.data || response.data.ok !== true) {
      await showQuickActionFailureNotification(action);
    }
  } catch (error) {
    console.error("クイックアクションの実行に失敗しました:", error);
    await showQuickActionFailureNotification(action);
  }
}

// 通知クリック時の遷移先のみ、旧HTML(task-list.html)からReact Routerのパス(/tasks)へ変更している。
// フォーカス済みウィンドウを探して遷移させる／無ければ新規ウィンドウを開く挙動自体は既存のまま。
// アクションボタン（「完了」「1時間後」）がタップされた場合だけ、アプリを開かずhandleQuickActionで完結する。
self.addEventListener("notificationclick", (event) => {
  const { action, notification } = event;
  const taskId = notification.data && notification.data.taskId;
  const reminderId = notification.data && notification.data.reminderId;

  notification.close();

  if (action === "complete" || action === "postpone_1h") {
    event.waitUntil(handleQuickAction(action, taskId, reminderId));
    return;
  }

  const targetUrl = new URL("/tasks", self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl).catch(() => {});
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});

// ==== ここから静的アセットのキャッシュ処理（通知処理とは独立・無関係） ====
// 既存 firebase-messaging-sw.js と同じキャッシュファースト方式。
// react-app/public 配下に実在するファイルだけを対象にしている
// （旧アプリ側の icons/ や manifest.webmanifest はこのビルドには含まれないため対象外）。
const STATIC_CACHE_NAME = "static-assets-v1";
const PRECACHE_URLS = [
  "/assets/status/self_management_master.png",
  "/assets/status/routine_master.png",
  "/assets/status/lazy_person.png",
  "/assets/status/procrastination_demon.png",
  "/assets/status/forgetful_alien.png",
  "/assets/status/too_busy_person.png",
  "/assets/status/vacation_mode.png",
];
const PRECACHE_PATHS = new Set(PRECACHE_URLS.map((path) => new URL(path, self.location.href).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((error) => console.error("静的アセットのプリキャッシュに失敗:", error)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!PRECACHE_PATHS.has(url.pathname)) return;

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
