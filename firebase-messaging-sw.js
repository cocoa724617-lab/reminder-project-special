importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCHf5uiktc7MJIQ2oWopYoMTYyfS7CwkIw",
  authDomain: "reminder-project-4b576.firebaseapp.com",
  projectId: "reminder-project-4b576",
  storageBucket: "reminder-project-4b576.firebasestorage.app",
  messagingSenderId: "590449260772",
  appId: "1:590449260772:web:c3b859071d04abdcaf94f1",
  measurementId: "G-2364V1ENYR"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("バックグラウンドメッセージ受信:", payload);

  const notificationTitle = payload.data?.title || "リマインダー";
  const notificationOptions = {
    body: payload.data?.body || "通知があります"
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL("task-list.html", self.location.origin).href;

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
    })
  );
});

// ==== ここから静的アセットのキャッシュ処理（通知処理とは独立・無関係） ====
// 画像/アイコン/manifestはほぼ更新されないためキャッシュファーストで配信する。
// HTML/JS/CSSやFirestore・FCM・認証など他オリジンへの通信は一切傍受せず、常に今まで通りネットワークへ流す。
const STATIC_CACHE_NAME = "static-assets-v1";
const PRECACHE_URLS = [
  "icons/icon-192.png",
  "icons/icon-512.png",
  "manifest.webmanifest",
  "assets/status/self_management_master.png",
  "assets/status/routine_master.png",
  "assets/status/lazy_person.png",
  "assets/status/procrastination_demon.png",
  "assets/status/forgetful_alien.png",
  "assets/status/too_busy_person.png",
  "assets/status/vacation_mode.png"
];
const PRECACHE_PATHS = new Set(
  PRECACHE_URLS.map((path) => new URL(path, self.location.href).pathname)
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((error) => console.error("静的アセットのプリキャッシュに失敗:", error))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== STATIC_CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!PRECACHE_PATHS.has(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
