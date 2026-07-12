import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth.js";
import { useTask, useLabelNames } from "../hooks/useTasks.js";
import { useFcmToken } from "../hooks/useFcmToken.js";
import { saveTask, deleteTask, saveFixedReminders, clearFixedReminders } from "../services/taskService.js";
import { TASK_LABELS, getTaskLabel, normalizeImportance, normalizeUrgency } from "../utils/taskLabels.js";

function clampFrequencyCount(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(10, Math.max(1, parsed));
}

// 既存 task-form.html の legacyFrequencyFromCount と同じ仕様：
// 新しい「回数」入力を、通知バックエンドが今も参照する旧 small/medium/large 表現に変換する。
function legacyFrequencyFromCount(count) {
  if (count <= 3) return "small";
  if (count <= 7) return "medium";
  return "large";
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const emptyFormState = {
  name: "",
  color: "none",
  priority: "medium",
  urgency: "today",
  description: "",
  dueDate: "",
  repeatEnabled: false,
  repeatFrequency: "weekly",
  notifyEnabled: true,
  frequencyUnit: "day",
  frequencyCount: 3,
  fixedReminders: [],
};

// 既存 task-form.html の populateForm と同じフォールバック仕様で、編集対象タスクをフォームの初期値へ変換する。
function buildFormFromTask(existingTask) {
  const freq = existingTask.frequency || "medium";
  const fallbackCount = freq === "small" ? 1 : freq === "large" ? 6 : 3;

  return {
    name: existingTask.name || existingTask.title || "",
    color: existingTask.color || "none",
    priority: normalizeImportance(existingTask.priority || existingTask.importance || existingTask.priorityLevel || "medium"),
    urgency: normalizeUrgency(existingTask.urgency),
    description: existingTask.description || existingTask.memo || "",
    dueDate: existingTask.dueDate || existingTask.date || "",
    repeatEnabled: !!existingTask.repeat && existingTask.repeat !== "none",
    repeatFrequency: existingTask.repeat && existingTask.repeat !== "none" ? existingTask.repeat : "weekly",
    notifyEnabled: existingTask.enabled !== false,
    frequencyUnit: existingTask.frequencyUnit || existingTask.randomFrequencyUnit || "day",
    frequencyCount: clampFrequencyCount(existingTask.frequencyCount || existingTask.randomFrequencyCount || fallbackCount),
    fixedReminders: existingTask.fixedReminders || [],
  };
}

function TaskFormPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { task: existingTask, isLoading, error } = useTask(editId);
  const labelNames = useLabelNames();
  // 既にブラウザ通知が許可済みなら、ここではユーザーに新たな許可を求めずトークンだけ受け取って使う
  // （まだ未許可の場合は token が null のまま。通知設定画面で許可すれば以降このページでも使えるようになる）。
  const { token: fcmToken } = useFcmToken();

  const [form, setForm] = useState(emptyFormState);
  const [isSaving, setIsSaving] = useState(false);
  // 直近でフォームに反映した既存タスクのidを覚えておき、非同期取得が終わって
  // existingTask が変化した瞬間だけ1回フォームへ反映する（レンダー中に条件付きでsetStateする公式パターン）。
  const [hydratedTaskId, setHydratedTaskId] = useState(null);

  if (existingTask && existingTask.id !== hydratedTaskId) {
    setHydratedTaskId(existingTask.id);
    setForm(buildFormFromTask(existingTask));
  }

  if (editId && isLoading) {
    return (
      <section className="page-placeholder">
        <p>読み込み中</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-placeholder">
        <p className="error-message">タスクの取得に失敗しました。時間をおいて再度お試しください。</p>
      </section>
    );
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function shiftDueDate(days) {
    const base = form.dueDate ? new Date(`${form.dueDate}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    updateField("dueDate", toDateStr(base));
  }

  function addFixedReminder() {
    setForm((prev) => ({ ...prev, fixedReminders: [...prev.fixedReminders, { date: "", time: "" }] }));
  }

  function updateFixedReminder(index, key, value) {
    setForm((prev) => ({
      ...prev,
      fixedReminders: prev.fixedReminders.map((reminder, i) => (i === index ? { ...reminder, [key]: value } : reminder)),
    }));
  }

  function removeFixedReminder(index) {
    setForm((prev) => ({ ...prev, fixedReminders: prev.fixedReminders.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("以下の項目を確認してください：\n\n・タスク名を入力してください");
      return;
    }

    const frequency = form.notifyEnabled ? legacyFrequencyFromCount(form.frequencyCount) : "none";
    const completeFixedReminders = form.fixedReminders.filter((reminder) => reminder.date && reminder.time);

    const taskObj = {
      ...(existingTask || {}),
      id: editId || null,
      name: form.name,
      title: form.name,
      description: form.description,
      memo: form.description,
      enabled: form.notifyEnabled,
      status: (existingTask && existingTask.status) || "未完了",
      frequency,
      frequencyUnit: form.frequencyUnit,
      frequencyCount: form.frequencyCount,
      priority: form.priority,
      urgency: form.urgency,
      color: form.color,
      dueDate: form.dueDate || null,
      repeat: form.repeatEnabled ? form.repeatFrequency : "none",
      fixedReminders: completeFixedReminders,
    };

    setIsSaving(true);
    try {
      const savedId = await saveTask(currentUser.uid, taskObj);

      if (form.notifyEnabled && completeFixedReminders.length > 0) {
        await saveFixedReminders(currentUser.uid, savedId, form.name, fcmToken, completeFixedReminders);
      } else {
        await clearFixedReminders(currentUser.uid, savedId);
      }

      alert("保存しました");
      navigate("/tasks");
    } catch (err) {
      console.error("タスクの保存に失敗しました:", err);
      alert("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("このタスクを削除しますか？この操作は取り消せません。")) return;
    try {
      await deleteTask(currentUser.uid, editId);
      navigate("/tasks");
    } catch (err) {
      console.error("タスクの削除に失敗しました:", err);
      alert("削除に失敗しました。時間をおいて再度お試しください。");
    }
  }

  function handleCancel() {
    navigate("/tasks");
  }

  return (
    <section id="task-form-screen">
      <div className="card">
        <div className="modal-field">
          <input
            className="modal-name-input"
            type="text"
            placeholder="タスク名を入力"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </div>

        <div className="modal-field">
          <span className="modal-field-label">色ラベル</span>
          <div className="color-picker">
            {Object.entries(TASK_LABELS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                className={`color-swatch${form.color === key ? " is-selected" : ""}`}
                style={{ "--swatch-color": meta.color }}
                aria-label={labelNames[key] || meta.name}
                onClick={() => updateField("color", key)}
              >
                <span className="color-check">✓</span>
              </button>
            ))}
          </div>
          <p className="color-label-text">{getTaskLabel(form.color, labelNames).name}</p>
        </div>

        <div className="modal-field">
          <span className="modal-field-label">重要度</span>
          <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
            <option value="low">低</option>
            <option value="medium">中</option>
            <option value="high">高</option>
          </select>
        </div>

        <div className="modal-field">
          <span className="modal-field-label">優先度</span>
          <select value={form.urgency} onChange={(event) => updateField("urgency", event.target.value)}>
            <option value="today">今日やる</option>
            <option value="thisWeek">今週中</option>
            <option value="whenFree">余裕があれば</option>
          </select>
        </div>

        <div className="modal-field">
          <span className="modal-field-label">メモ</span>
          <textarea
            rows={3}
            placeholder="補足があれば自由に書けます"
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
          />
        </div>

        <div className="modal-field">
          <span className="modal-field-label">期限</span>
          <div className="due-date-row">
            <button type="button" className="due-side-button" aria-label="前日" onClick={() => shiftDueDate(-1)}>
              ‹
            </button>
            <input
              type="date"
              className="due-date-button"
              value={form.dueDate}
              onChange={(event) => updateField("dueDate", event.target.value)}
            />
            <button type="button" className="due-side-button" aria-label="翌日" onClick={() => shiftDueDate(1)}>
              ›
            </button>
          </div>
        </div>

        <div className="modal-field modal-field-row">
          <span className="modal-field-label">繰り返す</span>
          <label className="ios-toggle">
            <input
              type="checkbox"
              checked={form.repeatEnabled}
              onChange={(event) => updateField("repeatEnabled", event.target.checked)}
            />
            <span className="ios-toggle-track">
              <span className="ios-toggle-thumb"></span>
            </span>
          </label>
        </div>

        {form.repeatEnabled && (
          <div className="modal-field">
            <span className="modal-field-label">繰り返す頻度</span>
            <select value={form.repeatFrequency} onChange={(event) => updateField("repeatFrequency", event.target.value)}>
              <option value="daily">毎日</option>
              <option value="weekly">毎週</option>
              <option value="monthly">毎月</option>
              <option value="yearly">毎年</option>
            </select>
          </div>
        )}

        <div className="modal-field modal-field-row">
          <span className="modal-field-label">通知する</span>
          <label className="ios-toggle">
            <input
              type="checkbox"
              checked={form.notifyEnabled}
              onChange={(event) => updateField("notifyEnabled", event.target.checked)}
            />
            <span className="ios-toggle-track">
              <span className="ios-toggle-thumb"></span>
            </span>
          </label>
        </div>

        <div className="modal-field notification-frequency-field">
          <span className="modal-field-label">ランダム通知の回数</span>
          <div className="frequency-unit-toggle" aria-label="通知回数の単位">
            <button
              type="button"
              className={`frequency-unit-button${form.frequencyUnit === "day" ? " is-selected" : ""}`}
              onClick={() => updateField("frequencyUnit", "day")}
            >
              1日
            </button>
            <button
              type="button"
              className={`frequency-unit-button${form.frequencyUnit === "week" ? " is-selected" : ""}`}
              onClick={() => updateField("frequencyUnit", "week")}
            >
              1週間
            </button>
          </div>
          <div className="frequency-count-row">
            <input
              type="range"
              className="frequency-slider"
              min="1"
              max="10"
              step="1"
              value={form.frequencyCount}
              onChange={(event) => updateField("frequencyCount", clampFrequencyCount(event.target.value))}
            />
            <span className="frequency-value-label">{form.frequencyCount}回</span>
          </div>
          <p className="frequency-summary">
            {form.frequencyUnit === "week"
              ? `1週間に${form.frequencyCount}回くらいランダム通知`
              : `1日に${form.frequencyCount}回くらいランダム通知`}
          </p>
        </div>

        <div className="modal-field">
          <span className="modal-field-label">この日時に必ず通知する</span>
          <div className="fixed-reminder-list">
            {form.fixedReminders.map((reminder, index) => (
              <div className="fixed-reminder-row" key={index}>
                <input
                  type="date"
                  value={reminder.date}
                  onChange={(event) => updateFixedReminder(index, "date", event.target.value)}
                />
                <input
                  type="time"
                  value={reminder.time}
                  onChange={(event) => updateFixedReminder(index, "time", event.target.value)}
                />
                <button
                  type="button"
                  className="fixed-reminder-remove"
                  aria-label="この日時を削除"
                  onClick={() => removeFixedReminder(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="add-fixed-reminder-button" onClick={addFixedReminder}>
            ＋ 日時を追加
          </button>
        </div>

        <button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "保存中…" : "保存する"}
        </button>
        <button type="button" className="btn-secondary" onClick={handleCancel}>
          キャンセル
        </button>
        {editId && (
          <button type="button" className="delete-task-button" onClick={handleDelete}>
            設定を削除
          </button>
        )}
      </div>
    </section>
  );
}

export default TaskFormPage;
