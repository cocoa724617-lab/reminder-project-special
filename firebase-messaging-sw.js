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
