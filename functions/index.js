const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// 頻度ごとの「1日あたり平均何回か」の目安（回数指定がない旧frequencyのタスク用）
const FREQUENCY_AVERAGE_PER_DAY = {
  small: 1.5,
  medium: 3.5,
  large: 6
};

// 通知同士を最低これだけ離す
const MIN_GAP_MINUTES = 60;

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

// 平均回数(3.5回など)を、その期間の実際の回数(3回or4回)に確率的に丸める
function resolveOccurrenceCount(avgCount) {
  const floor = Math.floor(avgCount);
  const frac = avgCount - floor;
  const bonus = Math.random() < frac ? 1 : 0;
  return Math.max(1, floor + bonus);
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

// JSTは常にUTC+9(サマータイムなし)なので、暦日+分オフセットから直接UTCのDateを作れる
function jstCalendarMinuteToUtcDate(y, m, d, minuteOfDay) {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - 9 * 60 * 60000 + minuteOfDay * 60000);
}

function getJstDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return {
    y: Number(parts.find((p) => p.type === "year").value),
    m: Number(parts.find((p) => p.type === "month").value),
    d: Number(parts.find((p) => p.type === "day").value)
  };
}

// 月曜=0, 日曜=6
function getJstMondayIndex(date) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(date);
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday];
}

// 指定日(JST)が属する週の月曜日を求める(年月日はカレンダー上のラベルとして扱うのでUTC演算でよい)
function getJstWeekStartParts(date) {
  const { y, m, d } = getJstDateParts(date);
  const mondayUtcMs = Date.UTC(y, m - 1, d) - getJstMondayIndex(date) * 86400000;
  const monday = new Date(mondayUtcMs);
  return { y: monday.getUTCFullYear(), m: monday.getUTCMonth() + 1, d: monday.getUTCDate() };
}

function computeScheduleKey(unit, referenceDate) {
  const { y, m, d } = unit === "week" ? getJstWeekStartParts(referenceDate) : getJstDateParts(referenceDate);
  const prefix = unit === "week" ? "week" : "day";
  return `${prefix}-${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// 指定した暦日(JST)の許可時間帯に入る1分刻みの候補時刻を列挙する
function buildAllowedInstantsForJstDate(y, m, d, startMinutes, endMinutes, excludeTimes, afterDate) {
  const instants = [];
  for (let minute = 0; minute < 1440; minute++) {
    if (!isMinuteAllowed(minute, startMinutes, endMinutes, excludeTimes)) continue;
    const instant = jstCalendarMinuteToUtcDate(y, m, d, minute);
    if (afterDate && instant <= afterDate) continue;
    instants.push(instant);
  }
  return instants;
}

// 頻度の単位(日/週)に応じて、対象期間の許可時間帯の候補時刻をすべて集める
function buildScheduleCandidates(unit, referenceDate, startMinutes, endMinutes, excludeTimes, afterDate) {
  if (unit === "week") {
    const { y, m, d } = getJstWeekStartParts(referenceDate);
    let candidates = [];
    for (let offset = 0; offset < 7; offset++) {
      const dayDate = new Date(Date.UTC(y, m - 1, d) + offset * 86400000);
      candidates = candidates.concat(
        buildAllowedInstantsForJstDate(
          dayDate.getUTCFullYear(),
          dayDate.getUTCMonth() + 1,
          dayDate.getUTCDate(),
          startMinutes,
          endMinutes,
          excludeTimes,
          afterDate
        )
      );
    }
    return candidates;
  }

  const { y, m, d } = getJstDateParts(referenceDate);
  return buildAllowedInstantsForJstDate(y, m, d, startMinutes, endMinutes, excludeTimes, afterDate);
}

// 候補の中からn個を、間隔がなるべく均等になるようバケット分割してランダムに選び、
// 最低間隔(MIN_GAP_MINUTES)を下回る場合は後ろにずらす
function pickSpreadTimes(candidates, n) {
  if (candidates.length === 0 || n <= 0) return [];
  const count = Math.min(n, candidates.length);
  const bucketSize = candidates.length / count;
  const picks = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.floor((i + 1) * bucketSize);
    const idx = Math.min(start + Math.floor(Math.random() * Math.max(1, end - start)), candidates.length - 1);
    picks.push(candidates[idx]);
  }
  picks.sort((a, b) => a.getTime() - b.getTime());
  for (let i = 1; i < picks.length; i++) {
    const minNext = picks[i - 1].getTime() + MIN_GAP_MINUTES * 60000;
    if (picks[i].getTime() < minNext) picks[i] = new Date(minNext);
  }
  return picks;
}

function isChainableTask(task) {
  const hasCountFrequency = normalizeFrequencyCount(task?.frequencyCount || task?.randomFrequencyCount);
  const hasLegacyFrequency = !!task?.frequency && task.frequency !== "none";
  return !!task && task.status !== "完了" && (hasCountFrequency || hasLegacyFrequency) && task.enabled !== false;
}

// タスクと通知設定から、対象期間(日/週)にばら撒く通知時刻の一覧を計算する
function computeBatchSchedule(task, settings, referenceDate, afterDate) {
  const startMinutes = timeStringToMinutes(settings.startTime || "09:00");
  const endMinutes = timeStringToMinutes(settings.endTime || "21:00");
  if (startMinutes === endMinutes) return { scheduleKey: null, times: [] };

  const frequencySpec = getFrequencySpec(task);
  const occurrences = resolveOccurrenceCount(frequencySpec.count);
  const scheduleKey = computeScheduleKey(frequencySpec.unit, referenceDate);
  const candidates = buildScheduleCandidates(
    frequencySpec.unit,
    referenceDate,
    startMinutes,
    endMinutes,
    settings.excludeTimes,
    afterDate
  );

  return { scheduleKey, times: pickSpreadTimes(candidates, occurrences) };
}

// 対象タスクの未通知バッチ予約をすべて作り直す(タスク編集時、および毎日/毎週の再生成時に呼ぶ)
async function regenerateTaskBatch(uid, taskId, task, userData, now) {
  if (!userData || !userData.fcmToken) return;
  if (!isChainableTask(task)) return;

  const settings = userData.notificationSettings || {};
  if (settings.enabled === false) return;

  const { scheduleKey, times } = computeBatchSchedule(task, settings, now, now);

  const existing = await db
    .collection("reminders")
    .where("uid", "==", uid)
    .where("taskId", "==", taskId)
    .where("kind", "==", "batch")
    .where("notified", "==", false)
    .get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  if (!scheduleKey || times.length === 0) {
    console.log(`許可時間帯が見つからずスケジュールをスキップ: uid=${uid}, taskId=${taskId}`);
    return;
  }

  const title = task.title || task.name || "リマインダー";
  await Promise.all(
    times.map((remindAt) =>
      db.collection("reminders").add({
        uid,
        taskId,
        kind: "batch",
        scheduleKey,
        title,
        body: "リマインダーの時間です",
        remindAt: admin.firestore.Timestamp.fromDate(remindAt),
        fcmToken: userData.fcmToken,
        notified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    )
  );
}

// タスクの作成・更新・削除のたびに、そのタスクのバッチ予約を作り直す
exports.onTaskWritten = onDocumentWritten("users/{uid}/tasks/{taskId}", async (event) => {
  const { uid, taskId } = event.params;
  const after = event.data.after.exists ? event.data.after.data() : null;

  if (!isChainableTask(after)) {
    // タスクが削除・完了・無効化・単発通知(頻度なし)になった場合は、未通知のバッチ予約を止める
    // 「この日時に必ず通知する」個別リマインダー(kind === "fixed")はここでは消さない
    const stale = await db
      .collection("reminders")
      .where("uid", "==", uid)
      .where("taskId", "==", taskId)
      .where("kind", "==", "batch")
      .where("notified", "==", false)
      .get();
    await Promise.all(stale.docs.map((d) => d.ref.delete()));
    return;
  }

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;
  await regenerateTaskBatch(uid, taskId, after, userData, new Date());
});

// 毎日0:05(JST)に、日単位タスクは当日分、週単位タスクは月曜のみ週全体分のバッチ予約を作り直す
exports.regenerateReminderSchedules = onSchedule(
  {
    schedule: "5 0 * * *",
    timeZone: "Asia/Tokyo"
  },
  async () => {
    const now = new Date();
    const isMonday = getJstMondayIndex(now) === 0;

    const tasksSnap = await db.collectionGroup("tasks").get();
    const userDataCache = new Map();

    const promises = tasksSnap.docs.map(async (taskDoc) => {
      const task = taskDoc.data();
      if (!isChainableTask(task)) return;

      const frequencySpec = getFrequencySpec(task);
      if (frequencySpec.unit === "week" && !isMonday) return;

      const uid = taskDoc.ref.parent.parent.id;
      if (!userDataCache.has(uid)) {
        const userSnap = await db.collection("users").doc(uid).get();
        userDataCache.set(uid, userSnap.exists ? userSnap.data() : null);
      }

      await regenerateTaskBatch(uid, taskDoc.id, task, userDataCache.get(uid), now);
    });

    await Promise.all(promises);
  }
);

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

      // バッチ予約は日/週ぶんまとめて事前に作成済みなので、送信後はこの1件を消すだけでよい
      await doc.ref.delete();
    });

    await Promise.all(promises);
  }
);
