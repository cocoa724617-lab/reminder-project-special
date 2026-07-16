import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth.js";
import { useNotificationSettings } from "../hooks/useNotificationSettings.js";
import NotificationPermissionCard from "../components/NotificationPermissionCard.jsx";
import NotificationTimeSettings from "../components/NotificationTimeSettings.jsx";
import QuietHoursSettings from "../components/QuietHoursSettings.jsx";
import MessageTypeSelector from "../components/MessageTypeSelector.jsx";
import LabelNameSettings from "../components/LabelNameSettings.jsx";
import { normalizeLabelNames } from "../utils/taskLabels.js";

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "21:00";

// 既存 notification-settings.html のReact版。
// Firestoreの users/{uid} ドキュメント構造（notificationSettings / labelNames）は既存のまま変更しない。
function NotificationSettingsPage() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const { settings, labelNames, isLoading, error, isSaving, saveError, save } = useNotificationSettings();

  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [endTime, setEndTime] = useState(DEFAULT_END_TIME);
  const [excludeTimes, setExcludeTimes] = useState([]);
  const [notificationTypes, setNotificationTypes] = useState(["browser"]);
  const [messageType, setMessageType] = useState("normal");
  const [enabled, setEnabled] = useState(true);
  const [labelNamesForm, setLabelNamesForm] = useState({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  // 既存 populateSettingsForm と同じフォールバック仕様で、取得完了時に1回だけフォームへ反映する。
  if (!isLoading && !hasHydrated) {
    setHasHydrated(true);
    if (settings) {
      setStartTime(settings.startTime || DEFAULT_START_TIME);
      setEndTime(settings.endTime || DEFAULT_END_TIME);
      setExcludeTimes(Array.isArray(settings.excludeTimes) ? settings.excludeTimes : []);
      setNotificationTypes(Array.isArray(settings.notificationTypes) ? settings.notificationTypes : ["browser"]);
      if (settings.messageType) setMessageType(settings.messageType);
      if (typeof settings.enabled === "boolean") setEnabled(settings.enabled);
    }
    setLabelNamesForm(labelNames || {});
  }

  if (isLoading) {
    return (
      <section className="page-placeholder">
        <p>読み込み中</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="page-placeholder">
        <p className="error-message">通知設定の取得に失敗しました。時間をおいて再度お試しください。</p>
      </section>
    );
  }

  function toggleNotificationType(value) {
    setNotificationTypes((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSaving) return;

    // 既存 collectExcludeTimes と同じく、開始・終了が両方揃っている行だけを対象にする。
    const completeExcludeTimes = excludeTimes.filter((range) => range.start && range.end);

    const errors = [];
    if (startTime && endTime && startTime >= endTime) {
      errors.push("・「通知していい時間帯」は開始時刻より終了時刻を後にしてください（日をまたぐ設定には対応していません）");
    }
    completeExcludeTimes.forEach((range, index) => {
      if (range.start >= range.end) {
        errors.push(
          `・「通知を止めたい時間」${index + 1}件目は開始時刻より終了時刻を後にしてください（日をまたぐ設定には対応していません）`,
        );
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    const nextSettings = {
      startTime,
      endTime,
      excludeTimes: completeExcludeTimes,
      notificationTypes,
      messageType,
      enabled,
    };

    try {
      await save(nextSettings, normalizeLabelNames(labelNamesForm));
      alert("保存しました");
    } catch {
      alert("保存に失敗しました。時間をおいて再度お試しください。");
    }
  }

  return (
    <section id="notification-settings-screen">
      {currentUser && (
        <section className="user-info">
          {currentUser.photoURL && <img src={currentUser.photoURL} alt="" />}
          <div>
            <div className="user-name">{currentUser.displayName || "ユーザー"}</div>
            <div className="user-email">{currentUser.email || ""}</div>
          </div>
        </section>
      )}
      <div className="actions">
        <button type="button" className="btn-secondary" onClick={() => logout()}>
          ログアウト
        </button>
      </div>

      <NotificationPermissionCard />

      <form onSubmit={handleSubmit}>
        <NotificationTimeSettings
          startTime={startTime}
          endTime={endTime}
          onChangeStartTime={setStartTime}
          onChangeEndTime={setEndTime}
        />

        <QuietHoursSettings excludeTimes={excludeTimes} onChange={setExcludeTimes} />

        <h2>通知タイプ（デフォルト）</h2>
        <p>ここで設定した通知タイプはタスク側で個別に上書きできます。</p>
        <div className="modal-field-row">
          <span className="modal-field-label">ブラウザ通知</span>
          <label className="ios-toggle">
            <input
              type="checkbox"
              checked={notificationTypes.includes("browser")}
              onChange={() => toggleNotificationType("browser")}
            />
            <span className="ios-toggle-track">
              <span className="ios-toggle-thumb"></span>
            </span>
          </label>
        </div>

        <MessageTypeSelector value={messageType} onChange={setMessageType} />

        <LabelNameSettings labelNames={labelNamesForm} onChange={setLabelNamesForm} />

        <h2>その他</h2>
        <div className="modal-field-row">
          <span className="modal-field-label">通知を有効にする</span>
          <label className="ios-toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            <span className="ios-toggle-track">
              <span className="ios-toggle-thumb"></span>
            </span>
          </label>
        </div>

        {validationErrors.length > 0 && (
          <p className="error-message">
            保存できませんでした：
            <br />
            {validationErrors.map((message, index) => (
              <span key={index}>
                {message}
                <br />
              </span>
            ))}
          </p>
        )}
        {saveError && <p className="error-message">保存に失敗しました。時間をおいて再度お試しください。</p>}

        <div style={{ marginTop: 20 }}>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "保存中…" : "保存"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
            戻る
          </button>
        </div>
      </form>
    </section>
  );
}

export default NotificationSettingsPage;
