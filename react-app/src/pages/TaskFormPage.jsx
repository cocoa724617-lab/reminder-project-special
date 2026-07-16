import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/useAuth.js";
import { useTask, useLabelNames } from "../hooks/useTasks.js";
import { useFcmToken } from "../hooks/useFcmToken.js";
import { saveTask, deleteTask } from "../services/taskService.js";
import { TASK_LABELS, getTaskLabel, normalizeImportance, normalizeUrgency } from "../utils/taskLabels.js";
import CalendarDatePicker from "../components/CalendarDatePicker.jsx";
import TimeSelect from "../components/TimeSelect.jsx";

// 「必ず通知する時間」の選択肢：期限からの相対オフセット（分/時間/日/週前）。
const FIXED_REMINDER_GROUPS = [
  { unit: "minutes", label: "分前", values: [1, 2, 3, 4, 5, 10, 15, 30] },
  { unit: "hours", label: "時間前", values: [1, 2, 3, 4, 8, 12] },
  { unit: "days", label: "日前", values: [1, 2, 3, 4, 5, 6] },
  { unit: "weeks", label: "週間前", values: [1, 2, 3, 4] },
];
const FIXED_REMINDER_UNITS = new Set(FIXED_REMINDER_GROUPS.map((group) => group.unit));

// 期限からの相対オフセットとして計算できない古い形式（絶対日時 {date, time}）のデータは無視する。
function sanitizeFixedReminders(value) {
  return Array.isArray(value)
    ? value.filter((r) => r && FIXED_REMINDER_UNITS.has(r.unit) && Number.isFinite(Number(r.value)))
    : [];
}

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
  dueTimeEnabled: false,
  dueTime: "18:00",
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
    dueTimeEnabled: !!existingTask.dueTime,
    dueTime: existingTask.dueTime || "18:00",
    repeatEnabled: !!existingTask.repeat && existingTask.repeat !== "none",
    repeatFrequency: existingTask.repeat && existingTask.repeat !== "none" ? existingTask.repeat : "weekly",
    notifyEnabled: existingTask.enabled !== false,
    frequencyUnit: existingTask.frequencyUnit || existingTask.randomFrequencyUnit || "day",
    frequencyCount: clampFrequencyCount(existingTask.frequencyCount || existingTask.randomFrequencyCount || fallbackCount),
    fixedReminders: sanitizeFixedReminders(existingTask.fixedReminders),
  };
}

function TaskFormPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { task: existingTask, isLoading, error } = useTask(editId);
  const labelNames = useLabelNames();
  // 通知トークンをFirestoreへ同期する副作用だけが目的（許可済みなら静かに再取得・保存する）。
  // 通知の送信自体はCloud Functions側がusers/{uid}.fcmTokenを読みに行うので、戻り値はここでは使わない。
  useFcmToken();

  const [form, setForm] = useState(emptyFormState);
  const [isSaving, setIsSaving] = useState(false);
  // 直近でフォームに反映した既存タスクのidを覚えておき、非同期取得が終わって
  // existingTask が変化した瞬間だけ1回フォームへ反映する（レンダー中に条件付きでsetStateする公式パターン）。
  const [hydratedTaskId, setHydratedTaskId] = useState(null);
  // 通知回数・固定通知時刻は普段は畳んでおく（新規作成時のデフォルトのまま使う人が大半のため）。
  // 既存タスクに固定通知時刻が設定済みの場合だけ、編集時に見失わないよう開いた状態にする。
  const [isNotifyDetailsOpen, setIsNotifyDetailsOpen] = useState(false);

  if (existingTask && existingTask.id !== hydratedTaskId) {
    setHydratedTaskId(existingTask.id);
    setForm(buildFormFromTask(existingTask));
    setIsNotifyDetailsOpen(sanitizeFixedReminders(existingTask.fixedReminders).length > 0);
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

  // オフセットは期限（日付+時刻）を基準に計算するため、両方揃っていないと選べない。
  const canUseFixedReminders = !!form.dueDate && form.dueTimeEnabled;

  // 選択済みなら外し、未選択なら追加する（複数選択可）。
  function toggleFixedReminderOption(unit, value) {
    setForm((prev) => {
      const isSelected = prev.fixedReminders.some((r) => r.unit === unit && r.value === value);
      const fixedReminders = isSelected
        ? prev.fixedReminders.filter((r) => !(r.unit === unit && r.value === value))
        : [...prev.fixedReminders, { unit, value }];
      return { ...prev, fixedReminders };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      alert("以下の項目を確認してください：\n\n・タスク名を入力してください");
      return;
    }

    const frequency = form.notifyEnabled ? legacyFrequencyFromCount(form.frequencyCount) : "none";

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
      dueTime: form.dueTimeEnabled ? form.dueTime : null,
      repeat: form.repeatEnabled ? form.repeatFrequency : "none",
      // 実際のリマインダー予約（reminders コレクション）はCloud Functions側(onTaskWritten)が
      // このdueDate/dueTimeとfixedRemindersから計算して作り直す。繰り返しタスクが次の期限へ
      // 進んだ時も、タスク更新のたびに呼ばれる同じ仕組みで自動的に再スケジュールされる。
      fixedReminders: canUseFixedReminders ? form.fixedReminders : [],
    };

    setIsSaving(true);
    try {
      await saveTask(currentUser.uid, taskObj);
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

        <div className="modal-field form-section-divider">
          <span className="modal-field-label">期限</span>
          <div className="due-date-row">
            <button type="button" className="due-side-button" aria-label="前日" onClick={() => shiftDueDate(-1)}>
              ‹
            </button>
            <span className="due-date-value">{form.dueDate || "未設定"}</span>
            <button type="button" className="due-side-button" aria-label="翌日" onClick={() => shiftDueDate(1)}>
              ›
            </button>
          </div>
          <CalendarDatePicker value={form.dueDate} onChange={(dateStr) => updateField("dueDate", dateStr)} />

          <div className="modal-field-row due-time-toggle-row">
            <span className="modal-field-label">時刻を指定する</span>
            <label className="ios-toggle">
              <input
                type="checkbox"
                checked={form.dueTimeEnabled}
                onChange={(event) => updateField("dueTimeEnabled", event.target.checked)}
              />
              <span className="ios-toggle-track">
                <span className="ios-toggle-thumb"></span>
              </span>
            </label>
          </div>
          {form.dueTimeEnabled && (
            <TimeSelect value={form.dueTime} onChange={(timeStr) => updateField("dueTime", timeStr)} />
          )}
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

        <div className="modal-field modal-field-row form-section-divider">
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

        {form.notifyEnabled && (
          <div className="modal-field">
            <button
              type="button"
              className={`field-disclosure-toggle${isNotifyDetailsOpen ? " is-expanded" : ""}`}
              aria-expanded={isNotifyDetailsOpen}
              onClick={() => setIsNotifyDetailsOpen((prev) => !prev)}
            >
              <span>
                通知の詳細設定
                <span className="field-disclosure-summary">
                  （
                  {form.frequencyUnit === "week"
                    ? `1週間に${form.frequencyCount}回`
                    : `1日に${form.frequencyCount}回`}
                  {form.fixedReminders.length > 0 && ` ・固定${form.fixedReminders.length}件`}
                  ）
                </span>
              </span>
              <span className="field-disclosure-icon" aria-hidden="true">
                ▾
              </span>
            </button>

            <div className={`field-disclosure-panel${isNotifyDetailsOpen ? " is-expanded" : ""}`}>
              <div className="field-disclosure-panel-inner">
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
                  <span className="modal-field-label">必ず通知する時間</span>
                  {!canUseFixedReminders ? (
                    <p className="fixed-reminder-disabled-note">期限の日付と時刻を設定すると選べるようになります。</p>
                  ) : (
                    <div className="fixed-reminder-groups">
                      {FIXED_REMINDER_GROUPS.map((group) => (
                        <div className="fixed-reminder-group" key={group.unit}>
                          <span className="fixed-reminder-group-label">{group.label}</span>
                          <div className="fixed-reminder-option-row">
                            {group.values.map((value) => {
                              const isSelected = form.fixedReminders.some(
                                (r) => r.unit === group.unit && r.value === value,
                              );
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={`fixed-reminder-option${isSelected ? " is-selected" : ""}`}
                                  aria-pressed={isSelected}
                                  onClick={() => toggleFixedReminderOption(group.unit, value)}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

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
