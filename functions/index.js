const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const FREQUENCY_RANGES = {
  small: [1, 2],
  medium: [3, 4],
  large: [5, 7]
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function todayJstDateString(now) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

function timeStringToMinutes(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

function buildJstDate(dateStr, minutesFromMidnight) {
  const h = String(Math.floor(minutesFromMidnight / 60)).padStart(2, "0");
  const m = String(minutesFromMidnight % 60).padStart(2, "0");
  return new Date(`${dateStr}T${h}:${m}:00+09:00`);
}

function isExcluded(minutes, excludeTimes) {
  return (excludeTimes || []).some((range) => {
    if (!range.start || !range.end) return false;
    return minutes >= timeStringToMinutes(range.start) && minutes < timeStringToMinutes(range.end);
  });
}

function generateRandomMinutes(startMinutes, endMinutes, excludeTimes, count) {
  const results = [];
  let attempts = 0;
  const maxAttempts = count * 20;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    const candidate = randomInt(startMinutes, endMinutes);
    if (isExcluded(candidate, excludeTimes)) continue;
    results.push(candidate);
  }

  return results;
}

exports.generateDailyReminders = onSchedule(
  {
    schedule: "0 5 * * *",
    timeZone: "Asia/Tokyo"
  },
  async () => {
    console.log("=== 毎日のランダム通知生成開始 ===");

    const tasksSnapshot = await db.collectionGroup("tasks").get();
    const activeTasks = tasksSnapshot.docs.filter((taskDoc) => {
      const data = taskDoc.data();
      return data.status !== "完了" && data.frequency && data.frequency !== "none" && data.enabled !== false;
    });

    console.log("対象タスク件数:", activeTasks.length);

    if (activeTasks.length === 0) {
      console.log("対象タスクなし。終了。");
      return;
    }

    const dateStr = todayJstDateString(new Date());
    const userCache = new Map();
    const writes = [];

    for (const taskDoc of activeTasks) {
      const task = taskDoc.data();
      const uid = taskDoc.ref.parent.parent.id;

      if (!userCache.has(uid)) {
        const userSnap = await db.collection("users").doc(uid).get();
        userCache.set(uid, userSnap.exists ? userSnap.data() : null);
      }
      const userData = userCache.get(uid);

      if (!userData || !userData.fcmToken) {
        console.log("fcmTokenなし。スキップ:", uid);
        continue;
      }

      const settings = userData.notificationSettings || {};
      if (settings.enabled === false) continue;

      const startMinutes = timeStringToMinutes(settings.startTime || "09:00");
      const endMinutes = timeStringToMinutes(settings.endTime || "21:00");
      if (endMinutes <= startMinutes) continue;

      const [min, max] = FREQUENCY_RANGES[task.frequency] || FREQUENCY_RANGES.medium;
      const count = randomInt(min, max);
      const minutesList = generateRandomMinutes(startMinutes, endMinutes, settings.excludeTimes, count);

      minutesList.forEach((minutes) => {
        const remindAt = buildJstDate(dateStr, minutes);
        writes.push(
          db.collection("reminders").add({
            uid,
            taskId: taskDoc.id,
            title: task.title || task.name || "リマインダー",
            body: "リマインダーの時間です",
            remindAt: admin.firestore.Timestamp.fromDate(remindAt),
            fcmToken: userData.fcmToken,
            notified: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
      });

      console.log(`タスク${taskDoc.id}: ${minutesList.length}件の通知を生成`);
    }

    await Promise.all(writes);
    console.log("=== 毎日のランダム通知生成終了 ===");
  }
);

exports.sendReminderNotifications = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Tokyo",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();
    console.log("=== リマインダー確認開始 ===");
    console.log("現在時刻:", now.toDate().toISOString());

    const snapshot = await db
      .collection("reminders")
      .where("notified", "==", false)
      .where("remindAt", "<=", now)
      .limit(20)
      .get();

    console.log("通知対象件数:", snapshot.size);

    if (snapshot.empty) {
      console.log("通知対象なし。終了。");
      return;
    }

    const promises = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const remindAtDate = data.remindAt.toDate();
      console.log("---");
      console.log("タスクID:", doc.id);
      console.log("title:", data.title);
      console.log("remindAt:", remindAtDate.toISOString());
      console.log("fcmToken:", data.fcmToken ? "あり" : "なし");

      if (data.uid && data.taskId) {
        const taskSnap = await db
          .collection("users")
          .doc(data.uid)
          .collection("tasks")
          .doc(data.taskId)
          .get();

        if (!taskSnap.exists || taskSnap.data().status === "完了") {
          console.log("タスクが完了済み/削除済み。通知をキャンセルして削除。");
          await doc.ref.delete();
          return;
        }
      }

      if (!data.fcmToken) {
        console.log("fcmToken がない。スキップ。");
        return;
      }

      const message = {
        notification: {
          title: data.title || "リマインダー",
          body: data.body || "リマインダーの時間です",
        },
        token: data.fcmToken,
      };

      try {
        const response = await admin.messaging().send(message);
        console.log("通知送信成功:", doc.id, "response:", response);

        await doc.ref.delete();
        console.log("Firestoreから削除成功:", doc.id);
      } catch (error) {
        console.error("通知送信失敗:", doc.id, "error:", error.message);
      }
    });

    await Promise.all(promises);
    console.log("=== リマインダー確認終了 ===");
  }
);
