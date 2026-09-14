const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
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

// 「うっかり防止リマインダー」：1日1回、この中からランダムに1つ選んで送る。
// 特定のタスクに紐付かないため、reminders コレクションでは kind: "daily" として扱う。
const DAILY_REMINDER_MESSAGES = [
  "LINEの返信はした？",
  "上司への返信、もう送った？",
  "あの予定、忘れてない？",
  "メールの返信、後回しにしてない？",
  "今日が締め切りの課題、大丈夫？",
  "明日の持ち物、準備した？",
  "提出するファイル、間違ってない？",
  "予約の時間、確認した？",
  "友達との約束、何時からだっけ？",
  "今日中に連絡するって言ってなかった？",
  "買い忘れているものはない？",
  "洗濯物、干したままじゃない？",
  "ゴミを出すの、忘れてない？",
  "スマホの充電、大丈夫？",
  "財布と鍵、ちゃんと持った？",
  "薬を飲む時間じゃない？",
  "水分、ちゃんと取ってる？",
  "そろそろ休憩したほうがよくない？",
  "今日の予定、もう一度確認した？",
  "会議の資料、準備できてる？",
  "あの人へのお礼、伝えた？",
  "折り返しの電話、まだしてなくない？",
  "シフトの提出、今日までじゃない？",
  "支払い期限、過ぎてない？",
  "レポート、保存しただけで満足してない？",
  "先生への連絡、送った？",
  "返信しようと思って、そのまま忘れてない？",
  "明日の予定、カレンダーに入れた？",
  "やろうとしていたこと、何か忘れてない？",
  "「後でやる」って言ってから、どれくらいたった？"
];

function pickRandomDailyReminderMessage() {
  return DAILY_REMINDER_MESSAGES[Math.floor(Math.random() * DAILY_REMINDER_MESSAGES.length)];
}

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

// 「必ず通知する時間」(期限からの相対オフセット)が除外時間帯(「通知を辞めてほしい時間」)に
// かぶっていたら、その除外時間帯が終わる時刻までずらす。①の「ランダムに実行していい時間帯」は
// ランダム通知(computeBatchSchedule)専用のスコープなので、ここでは意図的に見ない。
// 除外時間帯が連続/重複していても、もう除外時間でなくなるまで繰り返しずらす(念のため上限20回)。
function shiftPastExcludeTimes(date, excludeTimes) {
  if (!Array.isArray(excludeTimes) || excludeTimes.length === 0) return date;

  let current = date;
  for (let i = 0; i < 20; i++) {
    const { y, m, d } = getJstDateParts(current);
    const dayStart = jstCalendarMinuteToUtcDate(y, m, d, 0);
    const minuteOfDay = Math.round((current.getTime() - dayStart.getTime()) / 60000);

    const hit = excludeTimes.find((range) => {
      if (!range.start || !range.end) return false;
      return isInRange(minuteOfDay, timeStringToMinutes(range.start), timeStringToMinutes(range.end));
    });
    if (!hit) return current;

    const startMinutes = timeStringToMinutes(hit.start);
    const endMinutes = timeStringToMinutes(hit.end);
    // 日またぎ(start > end)の除外時間帯で、かつ今いるのが夜側(start以降)の場合だけ、
    // 終了時刻は「翌日」の分になる(朝側=end未満にいる場合は終了時刻はその日のうち)。
    const dayOffset = startMinutes > endMinutes && minuteOfDay >= startMinutes ? 1 : 0;
    const endDayUtcMs = Date.UTC(y, m - 1, d) + dayOffset * 86400000;
    const endDayDate = new Date(endDayUtcMs);
    const { y: ey, m: em, d: ed } = getJstDateParts(endDayDate);
    current = jstCalendarMinuteToUtcDate(ey, em, ed, endMinutes);
  }
  return current;
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

// 「必ず通知する時間」(kind: "fixed")用：期限からの相対オフセット。
const FIXED_REMINDER_UNIT_MS = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000
};

function shouldScheduleFixedReminders(task) {
  return (
    !!task &&
    task.status !== "完了" &&
    task.enabled !== false &&
    Array.isArray(task.fixedReminders) &&
    task.fixedReminders.length > 0 &&
    !!task.dueDate &&
    !!task.dueTime
  );
}

// JSTは常にUTC+9のため、日付文字列+時刻文字列からそのままUTC Dateを組み立てられる。
function computeDueDateTime(task) {
  const date = new Date(`${task.dueDate}T${task.dueTime}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 通知本文に差し込む「期限：〜」表示用テキストを作る。dueDate（既存タスクではdate）を
// 持たないタスク（頻度指定のみのタスクなど、特定の期限を持たないもの）はnullを返す。
// クライアント側 getReminderLabel の「期限：」表示と同じ dueDate||date のフォールバックに揃えている。
function formatDeadlineJa(dueDateStr, dueTimeStr) {
  const dateMatch = String(dueDateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const [, y, m, d] = dateMatch;
  const datePart = `${y}年${Number(m)}月${Number(d)}日`;

  const timeMatch = String(dueTimeStr || "").match(/^(\d{1,2}):(\d{1,2})$/);
  if (!timeMatch) return datePart;
  return `${datePart} ${timeMatch[1].padStart(2, "0")}:${timeMatch[2].padStart(2, "0")}`;
}

// 上と同じ入力から、通知の timestamp（対応ブラウザ/OSではタイトル横の時刻表示に使われる）用のDateを作る。
// 時刻未設定のタスクは0:00とみなす（日付だけでも「その日が期限」であることは示せるため）。
function computeDeadlineDate(dueDateStr, dueTimeStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dueDateStr || ""))) return null;
  const timePart = /^\d{1,2}:\d{1,2}$/.test(String(dueTimeStr || "")) ? dueTimeStr : "00:00";
  const date = new Date(`${dueDateStr}T${timePart}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 期限から各オフセット分だけ遡った通知時刻を計算する。計算結果が既に過去のものはスキップする
// （期限まで3日しかないのに「1週間前」を選んだ場合など、保存直後に即時通知が飛ぶのを防ぐ）。
// 除外時間帯(「通知を辞めてほしい時間」)にかぶる場合は、その除外時間帯が終わる時刻までずらす。
function computeFixedReminderTimes(task, now, excludeTimes) {
  const dueDateTime = computeDueDateTime(task);
  if (!dueDateTime) return [];

  return task.fixedReminders
    .map((offset) => {
      const unitMs = FIXED_REMINDER_UNIT_MS[offset && offset.unit];
      const value = Number(offset && offset.value);
      if (!unitMs || !Number.isFinite(value) || value <= 0) return null;
      const remindAt = new Date(dueDateTime.getTime() - unitMs * value);
      return shiftPastExcludeTimes(remindAt, excludeTimes);
    })
    .filter((remindAt) => remindAt && remindAt.getTime() > now.getTime());
}

// 「必ず通知する時間」の未通知予約をすべて作り直す（タスク編集のたび、繰り返しタスクの次回期限への
// 更新のたびに呼ばれる。batch予約と同じく、書き込みのたびに全消し→計算し直しの単純な方式にすることで、
// 繰り返しタスクが次の周回に進んでも自動的に新しい期限基準で再スケジュールされるようにする）。
async function regenerateFixedReminders(uid, taskId, task, userData, now) {
  const existing = await db
    .collection("reminders")
    .where("uid", "==", uid)
    .where("taskId", "==", taskId)
    .where("kind", "==", "fixed")
    .where("notified", "==", false)
    .get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  if (!userData || !userData.fcmToken) return;

  const excludeTimes = (userData.notificationSettings && userData.notificationSettings.excludeTimes) || [];
  const remindTimes = computeFixedReminderTimes(task, now, excludeTimes);
  if (remindTimes.length === 0) return;

  const title = task.title || task.name || "リマインダー";
  await Promise.all(
    remindTimes.map((remindAt) =>
      db.collection("reminders").add({
        uid,
        taskId,
        kind: "fixed",
        title,
        body: "指定した日時のお知らせです",
        remindAt: admin.firestore.Timestamp.fromDate(remindAt),
        fcmToken: userData.fcmToken,
        notified: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    )
  );
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

// うっかり防止リマインダー用：通知設定(①の許可時間帯・②の除外時間帯)に従って、
// 当日ぶん1件だけランダムな時刻を選ぶ。タスクのバッチ予約(computeBatchSchedule)と同じ
// 時間帯ロジックを流用するが、頻度は常に1日1回固定でよいのでunitは"day"に固定する。
function computeDailyReminderSchedule(settings, referenceDate) {
  const startMinutes = timeStringToMinutes(settings.startTime || "09:00");
  const endMinutes = timeStringToMinutes(settings.endTime || "21:00");
  if (startMinutes === endMinutes) return { scheduleKey: null, time: null };

  const scheduleKey = computeScheduleKey("day", referenceDate);
  const candidates = buildScheduleCandidates("day", referenceDate, startMinutes, endMinutes, settings.excludeTimes, null);
  if (candidates.length === 0) return { scheduleKey, time: null };

  const time = candidates[Math.floor(Math.random() * candidates.length)];
  return { scheduleKey, time };
}

// ユーザー単位のうっかり防止リマインダーの未通知予約を作り直す(毎日0:05の再生成時に呼ぶ)。
// タスクに紐付かないため kind: "daily" とし、taskIdは持たない
// (sendReminderNotifications側もkind: "daily"はタスクの存在チェックをスキップする)。
async function regenerateDailyReminder(uid, userData, now) {
  const existing = await db
    .collection("reminders")
    .where("uid", "==", uid)
    .where("kind", "==", "daily")
    .where("notified", "==", false)
    .get();
  await Promise.all(existing.docs.map((d) => d.ref.delete()));

  if (!userData || !userData.fcmToken) return;

  const settings = userData.notificationSettings || {};
  if (settings.enabled === false) return;

  const { scheduleKey, time } = computeDailyReminderSchedule(settings, now);
  if (!scheduleKey || !time) {
    console.log(`許可時間帯が見つからずうっかり防止リマインダーをスキップ: uid=${uid}`);
    return;
  }

  await db.collection("reminders").add({
    uid,
    kind: "daily",
    scheduleKey,
    title: pickRandomDailyReminderMessage(),
    body: "うっかり防止リマインダー",
    remindAt: admin.firestore.Timestamp.fromDate(time),
    fcmToken: userData.fcmToken,
    notified: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// タスクの作成・更新・削除のたびに、そのタスクのバッチ予約・固定リマインダー予約を作り直す。
// 両者は独立した条件（頻度指定の有無／fixedReminders設定の有無）で判定するため、それぞれ個別に
// 「対象なら作り直す、対象外になったなら未通知分を消す」を行う。
exports.onTaskWritten = onDocumentWritten("users/{uid}/tasks/{taskId}", async (event) => {
  const { uid, taskId } = event.params;
  const after = event.data.after.exists ? event.data.after.data() : null;
  const now = new Date();

  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() : null;

  if (isChainableTask(after)) {
    await regenerateTaskBatch(uid, taskId, after, userData, now);
  } else {
    // タスクが削除・完了・無効化・単発通知(頻度なし)になった場合は、未通知のバッチ予約を止める
    const staleBatch = await db
      .collection("reminders")
      .where("uid", "==", uid)
      .where("taskId", "==", taskId)
      .where("kind", "==", "batch")
      .where("notified", "==", false)
      .get();
    await Promise.all(staleBatch.docs.map((d) => d.ref.delete()));
  }

  if (shouldScheduleFixedReminders(after)) {
    await regenerateFixedReminders(uid, taskId, after, userData, now);
  } else {
    // タスクが削除・完了・無効化になった、またはfixedRemindersが空になった場合は未通知分を止める
    const staleFixed = await db
      .collection("reminders")
      .where("uid", "==", uid)
      .where("taskId", "==", taskId)
      .where("kind", "==", "fixed")
      .where("notified", "==", false)
      .get();
    await Promise.all(staleFixed.docs.map((d) => d.ref.delete()));
  }
});

// 毎日0:05(JST)に、日単位タスクは当日分、週単位タスクは月曜のみ週全体分のバッチ予約を作り直す。
// うっかり防止リマインダー(kind: "daily")もタスクとは独立に、全ユーザーぶん同じタイミングで作り直す。
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

    const taskPromises = tasksSnap.docs.map(async (taskDoc) => {
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

    const usersSnap = await db.collection("users").get();
    const dailyReminderPromises = usersSnap.docs.map((userDoc) =>
      regenerateDailyReminder(userDoc.id, userDoc.data(), now)
    );

    await Promise.all([...taskPromises, ...dailyReminderPromises]);
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
      let notificationTitle = data.title || "リマインダー";
      // 期限（dueDate/dueTime）はタスクに紐付く通知(kind !== "daily")だけが対象。
      // うっかり防止リマインダーはタスクを持たないため常にnullのまま。
      let deadlineText = null;
      let deadlineDate = null;

      // うっかり防止リマインダー(kind: "daily")はタスクに紐付かないため、タスクの存在・完了チェックは行わない。
      if (data.kind !== "daily") {
        const taskRef = db.collection("users").doc(data.uid).collection("tasks").doc(data.taskId);
        const taskSnap = await taskRef.get();
        const task = taskSnap.exists ? taskSnap.data() : null;

        if (!taskSnap.exists || task.status === "完了") {
          console.log("タスクが完了済み/削除済み。通知をキャンセルして削除。", doc.id);
          await doc.ref.delete();
          return;
        }

        notificationTitle = task.title || task.name || data.title || "リマインダー";
        const dueDateStr = task.dueDate || task.date;
        deadlineText = formatDeadlineJa(dueDateStr, task.dueTime);
        deadlineDate = computeDeadlineDate(dueDateStr, task.dueTime);
      }

      if (data.fcmToken) {
        try {
          // notificationフィールドを使うとブラウザが自動表示し、SW側のonBackgroundMessageでの
          // 手動表示と重複して二重通知になるため、dataのみで送りSW側の表示に一本化する。
          // taskIdを含めるのは、SW側で「完了」「1時間後」のクイックアクションボタンを出すため
          // （kind: "daily" のうっかり防止リマインダーはタスクに紐付かないため含めない）。
          // reminderId（このremindersドキュメント自身のID）も併せて含める。
          // quickCompleteTaskが「この通知からの完了操作は既に処理済みか」を判定するための
          // 手がかりとして使う（二重タップ・SWからの再送で同じ完了が2回走るのを防ぐため）。
          const baseBody = data.body || "リマインダーの時間です";
          const messagePayload = {
            title: notificationTitle,
            // 期限があるタスクは本文の先頭に「期限：〜」を差し込む。dueDate自体が無いタスク
            // （頻度指定のみなど）はdeadlineTextがnullのままなので、元のbodyだけになる。
            body: deadlineText ? `期限：${deadlineText}\n${baseBody}` : baseBody
          };
          if (deadlineDate) {
            // SW側でNotificationのtimestampに使う（対応ブラウザ/OSではタイトル横の時刻表示に反映される）。
            // FCMのdataペイロードは文字列のみのため、Dateはミリ秒のepoch文字列にして渡す。
            messagePayload.dueAt = String(deadlineDate.getTime());
          }
          if (data.kind !== "daily" && data.taskId) {
            messagePayload.taskId = data.taskId;
            messagePayload.reminderId = doc.id;
          }

          await admin.messaging().send({
            data: messagePayload,
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

// ===== 通知のクイックアクション（プッシュ通知のアクションボタンから、アプリを開かずに実行する） =====
// Service Worker（firebase-messaging-sw.js）がonCall経由でこれらを呼ぶ。呼び出し元はSW内で
// 復元したFirebase Authセッションのidトークンで認証されるため、request.auth.uidだけを信頼して
// そのユーザー自身のタスクだけを操作する（クライアントから渡されるuidは受け取らない）。
//
// completeTask / delayTaskWithLaterTime（react-app/src/services/taskService.js）と同じ処理内容を
// Admin SDK側で再実装したもの。挙動を変える場合は両方を揃えること。

// react-app/src/utils/dateUtils.js の toDateKey と同じ仕様だが、JSTで統一する必要があるため
// （Cloud Functionsの実行環境はJSTとは限らないが、ストリークは「JSTユーザーの日付感覚」に
// 合わせる必要がある）、getJstDateParts を使って組み立てる。
function toDateKeyJst(date) {
  const { y, m, d } = getJstDateParts(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// taskService.js の computeNextStreak と同じロジック（変更する場合は両方揃えること）。
function computeNextStreak({ lastDateKey, todayKey, yesterdayKey, currentStreak, longestStreak }) {
  if (lastDateKey === todayKey) {
    return { current: currentStreak, longest: longestStreak, changed: false };
  }

  const current = lastDateKey === yesterdayKey ? currentStreak + 1 : 1;
  const longest = Math.max(longestStreak, current);
  return { current, longest, changed: true };
}

// taskService.js の updateStreakOnCompletion と同じロジック（Admin SDK版）。
async function updateStreakOnCompletion(uid, now) {
  const todayKey = toDateKeyJst(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKeyJst(yesterday);

  const userRef = db.collection("users").doc(uid);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(userRef);
    const data = snap.exists ? snap.data() : {};
    const result = computeNextStreak({
      lastDateKey: data.streakLastDate || null,
      todayKey,
      yesterdayKey,
      currentStreak: Number(data.streakCurrent) || 0,
      longestStreak: Number(data.streakLongest) || 0
    });

    if (result.changed) {
      transaction.set(
        userRef,
        { streakCurrent: result.current, streakLongest: result.longest, streakLastDate: todayKey },
        { merge: true }
      );
    }
  });
}

// taskService.js の computeNextDueDate と同じ仕様（文字列→文字列の変換のみで「今」を参照しないため、
// 実行環境のタイムゾーンに依存せず安全に流用できる）。
function computeNextDueDate(dueDateStr, repeat) {
  const base = dueDateStr ? new Date(`${dueDateStr}T00:00:00`) : new Date();
  if (repeat === "daily") base.setDate(base.getDate() + 1);
  else if (repeat === "weekly") base.setDate(base.getDate() + 7);
  else if (repeat === "monthly") base.setMonth(base.getMonth() + 1);
  else if (repeat === "yearly") base.setFullYear(base.getFullYear() + 1);

  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// taskService.js の cancelPendingReminders と同じ仕様：そのタスクの未通知リマインダー
// （batch・fixed両方、taskIdで一致する分すべて）を取り消す。
async function cancelAllPendingRemindersForTask(uid, taskId) {
  const snap = await db
    .collection("reminders")
    .where("uid", "==", uid)
    .where("taskId", "==", taskId)
    .where("notified", "==", false)
    .get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

// 通知の「完了」ボタン用：taskService.js の completeTask と同じ処理（ストリーク更新も含む）。
//
// 二重完了防止について：
// もともと `task.status === "完了"` を見るガードがあったが、実際には status に "完了" が
// 書き込まれる経路が存在しない（繰り返しタスクは完了のたびに "未完了" へ戻すし、繰り返しでない
// タスクは完了と同時にドキュメントごと削除される）ため、このガードは常に false で素通りしていた。
// 結果、通知のアクションボタンの二度押しや、Service Workerからの呼び出しがネットワーク不調で
// 再送された場合に、繰り返しタスクの dueDate が1サイクルではなく2サイクル分進んだり、
// completedTasks に重複した履歴が残ったりしていた。
//
// 修正：呼び出し元（Service Worker）に、その完了操作の元になった通知（reminders ドキュメント）の
// IDを reminderId として渡してもらい、「同じ reminderId で既に完了処理済みか」を判定する。
// これなら dueDate が既に次のサイクルへ進んでいても、"あの通知はもう処理済み" と正しく判定できる
// （dueDateだけを見る方法だと、進んだ後のdueDateが「たまたま今回のサイクルと一致するか」しか
// 判断できず、二重タップと次サイクルの正常な完了を区別できない）。
// また読み取り→判定→書き込みをトランザクションにすることで、ほぼ同時に2回呼ばれた場合も
// 片方は書き込み衝突でリトライされ、リトライ後に再読込した最新状態（＝もう片方が書いた
// lastActionedReminderId）を見て正しく「既に完了済み」と判定できるようにしている。
exports.quickCompleteTask = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "ログインが必要です");

  const uid = request.auth.uid;
  const taskId = request.data && request.data.taskId;
  if (!taskId) throw new HttpsError("invalid-argument", "taskIdが必要です");
  // 古いService Worker（この修正より前にキャッシュされたもの）はreminderIdを渡してこない。
  // その場合は二重完了ガードを判定できないので、これまで通りフェイルオープンにする。
  const reminderId = (request.data && request.data.reminderId) || null;

  const taskRef = db.collection("users").doc(uid).collection("tasks").doc(taskId);
  const completedId = `${taskId}_${Date.now()}`;
  const completedAt = new Date();

  const result = await db.runTransaction(async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists) {
      return { ok: false, reason: "already-gone" };
    }

    const task = taskSnap.data();
    if (reminderId && task.lastActionedReminderId === reminderId) {
      return { ok: false, reason: "already-completed" };
    }

    transaction.set(db.collection("users").doc(uid).collection("completedTasks").doc(completedId), {
      ...task,
      originalTaskId: taskId,
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const isRepeating = !!task.repeat && task.repeat !== "none";
    if (isRepeating) {
      transaction.update(taskRef, {
        status: "未完了",
        dueDate: computeNextDueDate(task.dueDate, task.repeat),
        laterCount: 0,
        lastPostponedAt: null,
        laterTime: null,
        lastCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActionedReminderId: reminderId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      transaction.delete(taskRef);
    }

    return { ok: true };
  });

  if (!result.ok) return result;

  await cancelAllPendingRemindersForTask(uid, taskId);
  await updateStreakOnCompletion(uid, completedAt);

  return { ok: true };
});

// 通知の「1時間後」ボタン用：taskService.js の delayTaskWithLaterTime と同じ処理
// （通知からのクイック操作なので、時間帯の選択肢は出さず固定で1時間後扱いにする）。
exports.quickPostponeTask = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "ログインが必要です");

  const uid = request.auth.uid;
  const taskId = request.data && request.data.taskId;
  if (!taskId) throw new HttpsError("invalid-argument", "taskIdが必要です");

  const taskRef = db.collection("users").doc(uid).collection("tasks").doc(taskId);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists) {
    return { ok: false, reason: "already-gone" };
  }

  await taskRef.update({
    status: "後でやる",
    laterTime: "通知から1時間後",
    laterCount: admin.firestore.FieldValue.increment(1),
    lastPostponedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ok: true };
});
