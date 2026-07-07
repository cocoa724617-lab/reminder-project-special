const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// 頻度ごとの「1日あたり平均何回か」の目安。連鎖式では厳密な回数ではなく平均間隔として使う。
const FREQUENCY_AVERAGE_PER_DAY = {
  small: 1.5,
  medium: 3.5,
  large: 6
};

function normalizeFrequencyCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return null;
  return Math.min(10, count);
}

function getFrequencySpec(task) {
  const count = normalizeFrequencyCount(task.frequencyCount || task.randomFrequencyCount);
  if (count) {
    return {
      unit: task.frequencyUnit === "week" || task.randomFrequencyUnit === "week" ? "week" : "day",
      count
    };
  }

  return {
    unit: "day",
    count: FREQUENCY_AVERAGE_PER_DAY[task.frequency] || FREQUENCY_AVERAGE_PER_DAY.medium
  };
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function timeStringToMinutes(timeStr) {
  const [h, m] = String(timeStr || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// start < end の通常区間、start > end の日またぎ区間の両方に対応した範囲判定
function isInRange(minutes, start, end) {
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

function isExcluded(minutes, excludeTimes) {
  return (excludeTimes || []).some((range) => {
    if (!range.start || !range.end) return false;
    return isInRange(minutes, timeStringToMinutes(range.start), timeStringToMinutes(range.end));
  });
}

function isMinuteAllowed(minuteOfDay, startMinutes, endMinutes, excludeTimes) {
  return isInRange(minuteOfDay, startMinutes, endMinutes) && !isExcluded(minuteOfDay, excludeTimes);
}

function getJstMinuteOfDay(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour").value) % 24;
  const m = Number(parts.find((p) => p.type === "minute").value);
  return h * 60 + m;
}

// candidateが許可時間帯外なら、1分刻みで次に許可される瞬間まで進める（最大24時間分）
function snapToAllowedInstant(candidate, startMinutes, endMinutes, excludeTimes) {
  const d = new Date(candidate.getTime());
  for (let i = 0; i < 1440; i++) {
    if (isMinuteAllowed(getJstMinuteOfDay(d), startMinutes, endMinutes, excludeTimes)) {
      return d;
    }
    d.setTime(d.getTime() + 60000);
  }
  return null;
}

function computeNextRemindAt(now, task, settings) {
  const startMinutes = timeStringToMinutes(settings.startTime || "09:00");
  const endMinutes = timeStringToMinutes(settings.endTime || "21:00");
  if (startMinutes === endMinutes) return null;

  let windowMinutes = endMinutes - startMinutes;
  if (windowMinutes <= 0) windowMinutes += 1440;

  const frequencySpec = getFrequencySpec(task);
  const avgIntervalMinutes = frequencySpec.unit === "week"
    ? (7 * 24 * 60) / frequencySpec.count
    : windowMinutes / frequencySpec.count;
  const intervalMinutes = randomFloat(avgIntervalMinutes * 0.5, avgIntervalMinutes * 1.5);

  const candidate = new Date(now.getTime() + intervalMinutes * 60000);
  return snapToAllowedInstant(candidate, startMinutes, endMinutes, settings.excludeTimes);
}

function reminderChainDocId(uid, taskId) {
  return `${uid}_${taskId}`;
}

function isChainableTask(task) {
  const hasCountFrequency = normalizeFrequencyCount(task?.frequencyCount || task?.randomFrequencyCount);
  const hasLegacyFrequency = !!task?.frequency && task.frequency !== "none";
  return !!task && task.status !== "完了" && (hasCountFrequency || hasLegacyFrequency) && task.enabled !== false;
}

async function scheduleNextReminder(uid, taskId, task, userData, afterDate) {
  if (!userData || !userData.fcmToken) return;
  if (!isChainableTask(task)) return;

  const settings = userData.notificationSettings || {};
  if (settings.enabled === false) return;

  const remindAt = computeNextRemindAt(afterDate, task, settings);
  if (!remindAt) {
    console.log(`許可時間帯が見つからずスケジュールをスキップ: uid=${uid}, taskId=${taskId}`);
    return;
  }

  await db.collection("reminders").doc(reminderChainDocId(uid, taskId)).set({
    uid,
    taskId,
    title: task.title || task.name || "リマインダー",
    body: "リマインダーの時間です",
    remindAt: admin.firestore.Timestamp.fromDate(remindAt),
    fcmToken: userData.fcmToken,
    notified: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// タスクの作成・更新・削除のたびに、連鎖予約を作り直す
exports.onTaskWritten = onDocumentWritten("users/{uid}/tasks/{taskId}", async (event) => {
  const { uid, taskId } = event.params;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const chainDocId = reminderChainDocId(uid, taskId);

  if (!isChainableTask(after)) {
    // タスクが削除・完了・無効化・単発通知(頻度なし)になった場合は、連鎖予約と古い単発予約の両方を止める
    const stale = await db
      .collection("reminders")
      .where("uid", "==", uid)
      .where("taskId", "==", taskId)
      .where("notified", "==", false)
      .get();
    await Promise.all(stale.docs.map((d) => d.ref.delete()));
    return;
  }

  // 頻度なし→頻度ありに切り替わった場合に、古い単発予約が残らないようにする
  // ただし「この日時に必ず通知する」個別リマインダー(kind === "fixed")は、
  // タスク保存時にクライアント側(saveFixedReminders)で作り直す意図的な予約なので消さない
  const staleOneOff = await db
    .collection("reminders")
    .where("uid", "==", uid)
    .where("taskId", "==", taskId)
    .where("notified", "==", false)
    .get();
  await Promise.all(
    staleOneOff.docs
      .filter((d) => d.id !== chainDocId && d.data().kind !== "fixed")
      .map((d) => d.ref.delete())
  );

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;
  await scheduleNextReminder(uid, taskId, after, userData, new Date());
});

exports.sendReminderNotifications = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Tokyo"
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection("reminders")
      .where("notified", "==", false)
      .where("remindAt", "<=", now)
      .limit(20)
      .get();

    if (snapshot.empty) return;

    const promises = snapshot.docs.map(async (doc) => {
      const data = doc.data();
      const isChainSlot = doc.id === reminderChainDocId(data.uid, data.taskId);

      const taskRef = db.collection("users").doc(data.uid).collection("tasks").doc(data.taskId);
      const taskSnap = await taskRef.get();
      const task = taskSnap.exists ? taskSnap.data() : null;

      if (!taskSnap.exists || task.status === "完了") {
        console.log("タスクが完了済み/削除済み。通知をキャンセルして削除。", doc.id);
        await doc.ref.delete();
        return;
      }

      if (data.fcmToken) {
        const notificationTitle = task.title || task.name || data.title || "リマインダー";
        try {
          // notificationフィールドを使うとブラウザが自動表示し、SW側のonBackgroundMessageでの
          // 手動表示と重複して二重通知になるため、dataのみで送りSW側の表示に一本化する
          await admin.messaging().send({
            data: {
              title: notificationTitle,
              body: data.body || "リマインダーの時間です"
            },
            token: data.fcmToken
          });
          console.log("通知送信成功:", doc.id);
        } catch (error) {
          console.error("通知送信失敗:", doc.id, "error:", error.message);
        }
      } else {
        console.log("fcmTokenがない。送信スキップ:", doc.id);
      }

      if (!isChainSlot) {
        // 単発通知（頻度なし）は1回きりなので削除して終わり
        await doc.ref.delete();
        return;
      }

      // 頻度ありタスクの連鎖予約は、次の1件を計算して同じdocを上書きする
      const userSnap = await db.collection("users").doc(data.uid).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      await scheduleNextReminder(data.uid, data.taskId, task, userData, new Date());
    });

    await Promise.all(promises);
  }
);
