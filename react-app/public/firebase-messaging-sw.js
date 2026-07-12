importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

// 既存 firebase-init.js / react-app/src/services/firebase.js と同じ設定値。
firebase.initializeApp({
  apiKey: "AIzaSyCHf5uiktc7MJIQ2oWopYoMTYyfS7CwkIw",
  authDomain: "reminder-project-4b576.firebaseapp.com",
  projectId: "reminder-project-4b576",
  storageBucket: "reminder-project-4b576.firebasestorage.app",
  messagingSenderId: "590449260772",
  appId: "1:590449260772:web:c3b859071d04abdcaf94f1",
  measurementId: "G-2364V1ENYR",
});

const messaging = firebase.messaging();

// 通知の受信処理・表示内容は既存 firebase-messaging-sw.js から変更していない。
messaging.onBackgroundMessage((payload) => {
  console.log("バックグラウンドメッセージ受信:", payload);

  const notificationTitle = payload.data?.title || "リマインダー";
  const notificationOptions = {
    body: payload.data?.body || "通知があります",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// 通知クリック時の遷移先のみ、旧HTML(task-list.html)からReact Routerのパス(/tasks)へ変更している。
// フォーカス済みウィンドウを探して遷移させる／無ければ新規ウィンドウを開く挙動自体は既存のまま。
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

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
