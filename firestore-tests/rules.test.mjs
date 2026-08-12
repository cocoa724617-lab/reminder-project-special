import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(__dirname, "../firestore.rules");

const ALICE = "alice-uid";
const BOB = "bob-uid";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-reminder-rules-test",
    firestore: {
      rules: readFileSync(rulesPath, "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function dbAs(uid) {
  return uid ? testEnv.authenticatedContext(uid).firestore() : testEnv.unauthenticatedContext().firestore();
}

// セキュリティルールを無視して事前データを仕込むためのヘルパー（テスト対象はルールそのものではなく、
// 「既にこのデータがある状態で、次の操作は許可/拒否されるか」なので、仕込み自体はルールの影響を受けない）。
async function seed(callback) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await callback(context.firestore());
  });
}

describe("users/{uid}", () => {
  it("未ログインユーザーは読み書きできない", async () => {
    const db = dbAs(null);
    await assertFails(getDoc(doc(db, "users", ALICE)));
    await assertFails(setDoc(doc(db, "users", ALICE), { fcmToken: "x" }));
  });

  it("自分のユーザードキュメントは読み書きできる", async () => {
    const db = dbAs(ALICE);
    await assertSucceeds(setDoc(doc(db, "users", ALICE), { labelNames: { urgent: "緊急" } }, { merge: true }));
    await assertSucceeds(getDoc(doc(db, "users", ALICE)));
  });

  it("他人のユーザードキュメントは読み書きできない", async () => {
    await seed((db) => setDoc(doc(db, "users", BOB), { fcmToken: "bob-token" }));
    const db = dbAs(ALICE);
    await assertFails(getDoc(doc(db, "users", BOB)));
    await assertFails(setDoc(doc(db, "users", BOB), { fcmToken: "hijacked" }, { merge: true }));
  });

  it("fcmTokenが文字列/nullでなければ書き込めない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE), { fcmToken: 12345 }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, "users", ALICE), { fcmToken: null }, { merge: true }));
  });

  it("notificationSettingsがmapでなければ書き込めない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE), { notificationSettings: "invalid" }, { merge: true }));
    await assertSucceeds(
      setDoc(doc(db, "users", ALICE), { notificationSettings: { startTime: "09:00", endTime: "21:00" } }, { merge: true }),
    );
  });

  it("streakLastDateがYYYY-MM-DD形式でなければ書き込めない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE), { streakLastDate: "2026/08/12" }, { merge: true }));
    await assertSucceeds(setDoc(doc(db, "users", ALICE), { streakLastDate: "2026-08-12", streakCurrent: 3 }, { merge: true }));
  });
});

describe("users/{uid}/tasks/{taskId}", () => {
  it("自分のtasksはCRUDできる", async () => {
    const db = dbAs(ALICE);
    const ref = doc(db, "users", ALICE, "tasks", "t1");
    await assertSucceeds(setDoc(ref, { title: "テスト", status: "未完了" }));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(updateDoc(ref, { status: "後でやる" }));
    await assertSucceeds(deleteDoc(ref));
  });

  it("他人のtasksはCRUDできない", async () => {
    await seed((db) => setDoc(doc(db, "users", BOB, "tasks", "t1"), { title: "bobのタスク" }));
    const db = dbAs(ALICE);
    const ref = doc(db, "users", BOB, "tasks", "t1");
    await assertFails(setDoc(doc(db, "users", BOB, "tasks", "t2"), { title: "作成できないはず" }));
    await assertFails(getDoc(ref));
    await assertFails(updateDoc(ref, { status: "完了" }));
    await assertFails(deleteDoc(ref));
  });

  it("他人のtasks一覧は取得できない", async () => {
    await seed((db) => setDoc(doc(db, "users", BOB, "tasks", "t1"), { title: "bob" }));
    const db = dbAs(ALICE);
    await assertFails(getDocs(collection(db, "users", BOB, "tasks")));
  });

  it("name/titleのどちらも無いタスクは作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE, "tasks", "t1"), { status: "未完了" }));
  });

  it("statusが決められた値以外なら作成・更新できない", async () => {
    const db = dbAs(ALICE);
    const ref = doc(db, "users", ALICE, "tasks", "t1");
    await assertFails(setDoc(ref, { title: "テスト", status: "完了" }));
    await assertSucceeds(setDoc(ref, { title: "テスト", status: "未完了" }));
    await assertFails(updateDoc(ref, { status: "done" }));
  });

  it("repeatが決められた値以外なら作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE, "tasks", "t1"), { title: "テスト", repeat: "everyday" }));
    await assertSucceeds(setDoc(doc(db, "users", ALICE, "tasks", "t1"), { title: "テスト", repeat: "daily" }));
  });

  it("dueDateがYYYY-MM-DD形式（またはnull）でなければ作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE, "tasks", "t1"), { title: "テスト", dueDate: "2026/08/12" }));
    await assertSucceeds(setDoc(doc(db, "users", ALICE, "tasks", "t1"), { title: "テスト", dueDate: "2026-08-12" }));
    await assertSucceeds(setDoc(doc(db, "users", ALICE, "tasks", "t2"), { title: "テスト", dueDate: null }));
  });

  it("fixedRemindersが配列でなければ作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "users", ALICE, "tasks", "t1"), { title: "テスト", fixedReminders: "invalid" }));
    await assertSucceeds(
      setDoc(doc(db, "users", ALICE, "tasks", "t1"), { title: "テスト", fixedReminders: [{ unit: "hours", value: 1 }] }),
    );
  });
});

describe("users/{uid}/completedTasks/{completedTaskId}", () => {
  it("自分のcompletedTasksは読み書きできる", async () => {
    const db = dbAs(ALICE);
    const ref = doc(db, "users", ALICE, "completedTasks", "c1");
    await assertSucceeds(setDoc(ref, { title: "終わった" }));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(deleteDoc(ref));
  });

  it("他人のcompletedTasksは読み書きできない", async () => {
    await seed((db) => setDoc(doc(db, "users", BOB, "completedTasks", "c1"), { title: "bob" }));
    const db = dbAs(ALICE);
    const ref = doc(db, "users", BOB, "completedTasks", "c1");
    await assertFails(getDoc(ref));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(doc(db, "users", BOB, "completedTasks", "c2"), { title: "x" }));
  });

  it("removedFromHistoryが真偽値でなければ更新できない", async () => {
    const db = dbAs(ALICE);
    const ref = doc(db, "users", ALICE, "completedTasks", "c1");
    await assertSucceeds(setDoc(ref, { title: "終わった", originalTaskId: "t1" }));
    await assertFails(updateDoc(ref, { removedFromHistory: "yes" }));
    await assertSucceeds(updateDoc(ref, { removedFromHistory: true }));
  });
});

describe("reminders", () => {
  it("未ログインでは一覧取得できない", async () => {
    const db = dbAs(null);
    const q = query(collection(db, "reminders"), where("uid", "==", ALICE));
    await assertFails(getDocs(q));
  });

  it("自分のuid・fcmToken無しのリマインダーは作成できる", async () => {
    const db = dbAs(ALICE);
    await assertSucceeds(
      addDoc(collection(db, "reminders"), {
        uid: ALICE,
        taskId: "t1",
        title: "テスト",
        body: "本文",
        fcmToken: null,
        kind: "fixed",
        notified: false,
      }),
    );
  });

  it("他人のuidを騙ったリマインダーは作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(
      addDoc(collection(db, "reminders"), {
        uid: BOB,
        taskId: "t1",
        fcmToken: null,
        notified: false,
      }),
    );
  });

  it("本人のusers/{uid}.fcmTokenと一致する値でのみリマインダーを作成できる（他人のトークンなりすまし対策）", async () => {
    await seed((db) => setDoc(doc(db, "users", ALICE), { fcmToken: "alice-real-token" }));
    const db = dbAs(ALICE);

    await assertSucceeds(
      addDoc(collection(db, "reminders"), {
        uid: ALICE,
        taskId: "t1",
        fcmToken: "alice-real-token",
        notified: false,
      }),
    );

    await assertFails(
      addDoc(collection(db, "reminders"), {
        uid: ALICE,
        taskId: "t1",
        fcmToken: "stolen-bob-token",
        notified: false,
      }),
    );
  });

  it("自分のuidでの一覧取得はできるが、他人のuidを指定した一覧取得はできない", async () => {
    await seed((db) =>
      Promise.all([
        setDoc(doc(db, "reminders", "r1"), { uid: ALICE, taskId: "t1", notified: false }),
        setDoc(doc(db, "reminders", "r2"), { uid: BOB, taskId: "t1", notified: false }),
      ]),
    );
    const db = dbAs(ALICE);
    await assertSucceeds(getDocs(query(collection(db, "reminders"), where("uid", "==", ALICE))));
    await assertFails(getDocs(query(collection(db, "reminders"), where("uid", "==", BOB))));
  });

  it("他人のリマインダーは直接IDを指定しても取得できない", async () => {
    await seed((db) => setDoc(doc(db, "reminders", "r2"), { uid: BOB, taskId: "t1", notified: false }));
    const db = dbAs(ALICE);
    await assertFails(getDoc(doc(db, "reminders", "r2")));
  });

  it("自分のリマインダーは削除できるが、他人のリマインダーは削除できない", async () => {
    await seed((db) =>
      Promise.all([
        setDoc(doc(db, "reminders", "r1"), { uid: ALICE, taskId: "t1", notified: false }),
        setDoc(doc(db, "reminders", "r2"), { uid: BOB, taskId: "t1", notified: false }),
      ]),
    );
    const db = dbAs(ALICE);
    await assertSucceeds(deleteDoc(doc(db, "reminders", "r1")));
    await assertFails(deleteDoc(doc(db, "reminders", "r2")));
  });

  it("リマインダーは自分のものでも更新できない（作り直す設計のため）", async () => {
    await seed((db) => setDoc(doc(db, "reminders", "r1"), { uid: ALICE, taskId: "t1", notified: false }));
    const db = dbAs(ALICE);
    await assertFails(updateDoc(doc(db, "reminders", "r1"), { notified: true }));
  });

  it("kindが決められた値以外なら作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(addDoc(collection(db, "reminders"), { uid: ALICE, taskId: "t1", kind: "invalid", notified: false }));
    await assertSucceeds(addDoc(collection(db, "reminders"), { uid: ALICE, taskId: "t1", kind: "fixed", notified: false }));
  });

  it("notified: trueで新規作成はできない（通知済みを最初から名乗れないように）", async () => {
    const db = dbAs(ALICE);
    await assertFails(addDoc(collection(db, "reminders"), { uid: ALICE, taskId: "t1", notified: true }));
  });

  it("taskIdが文字列でなければ作成できない", async () => {
    const db = dbAs(ALICE);
    await assertFails(addDoc(collection(db, "reminders"), { uid: ALICE, taskId: 123, notified: false }));
  });
});
