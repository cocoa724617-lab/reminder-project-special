import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { usePostponeTask, POSTPONE_LIMIT } from "../hooks/usePostponeTask.js";
import { useNotificationSettings } from "../hooks/useNotificationSettings.js";
import { pickPostponeMessage } from "../utils/postponeMessages.js";
import PostponeMessage from "../components/PostponeMessage.jsx";
import PostponeTimeSelector from "../components/PostponeTimeSelector.jsx";

function getTaskTitle(task) {
  return (task && (task.title || task.name)) || "無題のタスク";
}

// 既存 atodeyaru.html の個別モード（?id=付き）のReact版。
// ルートは /postpone/:taskId が基本だが、旧 atodeyaru.html?id=... 形式のリンクとの互換のため
// クエリパラメータの id も読む。
function PostponePage() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const taskId = params.taskId || searchParams.get("id");
  const navigate = useNavigate();

  const { task, isLoading, error, isSaving, postpone, doNow } = usePostponeTask(taskId);
  const { settings, isLoading: settingsLoading } = useNotificationSettings();

  const [selectedValue, setSelectedValue] = useState(null);
  const [pendingLaterTime, setPendingLaterTime] = useState(null);
  const [isLimitModalOpen, setIsLimitModalOpen] = useState(false);
  // 「後でやる」を押したときのメッセージは、通知設定の読み込みが終わった時点で1回だけ抽選する
  // （既存 atodeyaru.html の showLaterMessage() と同じく、表示中に選び直さない）。
  const [pickedMessage, setPickedMessage] = useState(null);

  const messageType = (settings && settings.messageType) || "normal";
  if (!settingsLoading && pickedMessage === null) {
    setPickedMessage(pickPostponeMessage(messageType));
  }

  if (!taskId) {
    return (
      <section className="page-placeholder">
        <p className="error-message">対象のタスクが指定されていません。</p>
        <div className="actions">
          <Link to="/tasks" className="button-link">
            タスク一覧へ戻る
          </Link>
        </div>
      </section>
    );
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
        <p className="error-message">タスクの取得に失敗しました。時間をおいて再度お試しください。</p>
      </section>
    );
  }

  if (!task) {
    return (
      <section className="page-placeholder">
        <p className="error-message">
          対象のタスクが見つかりませんでした。すでに完了・削除されているか、URLが正しくない可能性があります。
        </p>
        <div className="actions">
          <Link to="/tasks" className="button-link">
            タスク一覧へ戻る
          </Link>
        </div>
      </section>
    );
  }

  async function commitPostpone(laterTime) {
    try {
      await postpone(laterTime);
      navigate("/tasks");
    } catch {
      alert("後でやる設定の保存に失敗しました。時間をおいて再度お試しください。");
    }
  }

  async function handleSelect(laterTime) {
    if (isSaving) return;
    setSelectedValue(laterTime);

    if ((task.laterCount || 0) >= POSTPONE_LIMIT) {
      setPendingLaterTime(laterTime);
      setIsLimitModalOpen(true);
      return;
    }

    await commitPostpone(laterTime);
  }

  async function handleDoNow() {
    if (isSaving) return;
    try {
      await doNow();
      navigate("/tasks");
    } catch {
      alert("更新に失敗しました。時間をおいて再度お試しください。");
    }
  }

  function handleEditDue() {
    navigate(`/tasks/new?id=${taskId}`);
  }

  async function handleConfirmPostpone() {
    setIsLimitModalOpen(false);
    if (pendingLaterTime) await commitPostpone(pendingLaterTime);
  }

  function handleCancel() {
    navigate("/tasks");
  }

  return (
    <section id="postpone-screen" className="atodeyaru-main">
      <PostponeMessage taskTitle={getTaskTitle(task)} message={pickedMessage} />

      <PostponeTimeSelector selectedValue={selectedValue} onSelect={handleSelect} disabled={isSaving} />

      <div className="actions">
        <button type="button" className="btn-secondary" onClick={handleCancel} disabled={isSaving}>
          キャンセルして一覧へ戻る
        </button>
      </div>

      {isLimitModalOpen && (
        <div className="mini-modal-overlay is-visible" aria-hidden="false">
          <div className="mini-modal-card">
            <div className="mini-modal-header">
              <h2>ちょっと待って</h2>
            </div>
            <p>このタスクはすでに{task.laterCount || 0}回後回しにしています。どうしますか？</p>
            <button type="button" onClick={handleDoNow} disabled={isSaving}>
              今やる
            </button>
            <button type="button" className="btn-secondary" onClick={handleEditDue} disabled={isSaving}>
              期限を変更する
            </button>
            <button type="button" className="btn-secondary" onClick={handleConfirmPostpone} disabled={isSaving}>
              本当に後でやる
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default PostponePage;
