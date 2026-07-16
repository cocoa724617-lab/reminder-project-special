import { useState } from "react";
import { getTaskLabel } from "../utils/taskLabels.js";
import { formatDate, formatDateTimeJa } from "../utils/dateUtils.js";
import MetaPillRow from "./MetaPillRow.jsx";

// 既存 task-list.html / index.html の getReminderLabel と同じ実装。
function getReminderLabel(task) {
  if (task.notifyDate) {
    return `通知日時：${task.notifyDate}${task.time ? " " + task.time : ""}`;
  }
  if (task.frequency && task.frequency !== "none") {
    if (task.frequencyCount) {
      const unitLabel = task.frequencyUnit === "week" ? "1週間" : "1日";
      return `${unitLabel}に${task.frequencyCount}回くらいランダム通知`;
    }
    const freqLabel = {
      small: "少なめ（1〜2回/日）",
      medium: "普通（3〜4回/日）",
      large: "多め（5〜7回/日）",
    }[task.frequency] || task.frequency;
    return `ランダム通知・${freqLabel}`;
  }
  if (task.dueDate || task.date) {
    return `期限：${task.dueDate || task.date}${task.dueTime ? " " + task.dueTime : ""}`;
  }
  return "日時未設定";
}

function getTaskTitle(task, fallback) {
  return task.title || task.name || fallback;
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m-6.5 0 .6 9.4A1.5 1.5 0 0 0 7.6 17h4.8a1.5 1.5 0 0 0 1.5-1.6L14.5 6m-6 3v5m3-5v5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// TaskListPage / CompletedTasksPage / PostponedTasksPage で共用するタスクカード。
// variant="active"    : 既存 task-list.html のカード（完了円・あとでやるピル・削除アイコン付き。タップで編集へ）
// variant="completed" : 既存 completed-tasks.html のカード（チェック済み円・削除アイコンのみ。タップ編集なし）
// variant="postponed" : 既存 atodeyaru.html 一覧モードのカードを拡張したもの
//                        （元の期限・あとでやるにした時間・後回し回数・最後に後回しにした日を追加表示。
//                        アクションはactiveと同じ完了/あとでやる/編集/削除）
// compact             : 既存 .task-card-compact 相当（completed-tasks.html は常に compact）
function TaskCard({
  task,
  variant = "active",
  compact = false,
  labelNames,
  cycleStatus = null,
  onComplete,
  onDelete,
  onEdit,
  onPostpone,
}) {
  const [isCompleting, setIsCompleting] = useState(false);
  // 重要度・予定・メモなどの副次情報はデフォルトで畳んでおき、タップした人にだけ見せる
  // （常時全部表示すると管理画面のように見えてしまうため）。
  const [isExpanded, setIsExpanded] = useState(false);

  if (!task) return null;

  const labelMeta = getTaskLabel(task.color, labelNames);
  const cardClassName = compact ? "task-card task-card-compact" : "task-card";
  const cardStyle = { borderLeft: `4px solid ${labelMeta.color}` };

  // 完了ボタンを押せなくする・あとでやるpiiを隠す条件：completed variant、または繰り返しタスクの「今回分」完了済み。
  const isArchived = variant === "completed";
  const isDone = isArchived || !!cycleStatus;
  const canEdit = typeof onEdit === "function";

  function handleCardActivate() {
    if (!canEdit) return;
    onEdit(task);
  }

  function handleCardKeyDown(event) {
    if (!canEdit) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onEdit(task);
    }
  }

  async function handleCompleteClick(event) {
    event.stopPropagation();
    if (isDone || isCompleting || typeof onComplete !== "function") return;
    setIsCompleting(true);
    try {
      await onComplete(task);
    } finally {
      setIsCompleting(false);
    }
  }

  function handleDeleteClick(event) {
    event.stopPropagation();
    if (typeof onDelete !== "function") return;
    onDelete(task);
  }

  function handlePostponeClick(event) {
    event.stopPropagation();
    if (typeof onPostpone !== "function") return;
    onPostpone(task);
  }

  function handleToggleExpand(event) {
    event.stopPropagation();
    setIsExpanded((prev) => !prev);
  }

  const detailsToggle = (
    <button
      type="button"
      className={`task-details-toggle${isExpanded ? " is-expanded" : ""}`}
      aria-expanded={isExpanded}
      onClick={handleToggleExpand}
    >
      {isExpanded ? "詳細を閉じる" : "詳細を見る"}
      <span className="task-details-toggle-icon" aria-hidden="true">
        ▾
      </span>
    </button>
  );

  const completeButton = (
    <button
      type="button"
      className={`task-complete-circle${isArchived ? " is-done" : ""}`}
      aria-label={isArchived ? "完了済み" : cycleStatus ? "次回まで完了済み" : "タスクを完了にする"}
      aria-pressed={isArchived}
      disabled={isDone || isCompleting}
      title={cycleStatus ? `次回（${formatDateTimeJa(cycleStatus.nextDueDate)}）まで完了済みです` : undefined}
      onClick={handleCompleteClick}
    >
      {isArchived && <span aria-hidden="true">✓</span>}
    </button>
  );

  const deleteButton = onDelete && (
    <button type="button" className="task-delete-icon" aria-label="タスクを削除" onClick={handleDeleteClick}>
      <TrashIcon />
    </button>
  );

  if (variant === "completed") {
    const memo = task.memo || task.description || "";

    return (
      <div className={cardClassName} style={cardStyle}>
        <div
          className="task-card-main"
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          onClick={canEdit ? handleCardActivate : undefined}
          onKeyDown={canEdit ? handleCardKeyDown : undefined}
        >
          {completeButton}
          <div className="task-info is-done">
            <h3>{getTaskTitle(task, "無題のタスク")}</h3>
            <p className="task-remind">完了日：{formatDate(task.deletedAt)}</p>
            {task.color && task.color !== "none" && (
              <span className="meta-pill meta-pill-label" style={{ "--label-color": labelMeta.color }}>
                {labelMeta.name}
              </span>
            )}
            {memo && <p className="task-memo">{memo}</p>}
            {(task.laterCount || 0) > 0 && (
              <p className="task-memo">あとでやるから完了（{task.laterCount}回後回し）</p>
            )}
          </div>
        </div>
        {deleteButton && <div className="task-card-footer">{deleteButton}</div>}
      </div>
    );
  }

  const later = String(task.status || "").trim() === "後でやる";
  const memo = task.memo || task.description || "";
  const isPostponed = variant === "postponed";

  return (
    <div className={cardClassName} style={cardStyle}>
      <div
        className="task-card-main"
        role={canEdit ? "button" : undefined}
        tabIndex={canEdit ? 0 : undefined}
        onClick={canEdit ? handleCardActivate : undefined}
        onKeyDown={canEdit ? handleCardKeyDown : undefined}
      >
        {completeButton}
        <div className="task-info">
          <h3>
            <span className="color-dot task-title-dot" style={{ background: labelMeta.color }}></span>
            {getTaskTitle(task, "(無題)")}
          </h3>

          {isPostponed ? (
            <>
              <p className="task-remind">
                📅 元の期限：{task.dueDate || task.date || "未設定"}
                {task.dueTime ? ` ${task.dueTime}` : ""}
              </p>
              {detailsToggle}
              <div className={`task-details${isExpanded ? " is-expanded" : ""}`}>
                <div className="task-details-inner">
                  <MetaPillRow task={task} labelNames={labelNames} />
                  <p className="task-memo">メモ：{memo || "なし"}</p>
                  <p className="task-memo">あとでやるにした時間：{task.laterTime || "未設定"}</p>
                  <p className="task-memo">後回しにした回数：{task.laterCount || 0}回</p>
                  <p className="task-memo">最後に後回しにした日：{formatDate(task.lastPostponedAt, "記録なし")}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="task-remind">📅 {getReminderLabel(task)}</p>
              {cycleStatus ? (
                <span className="status-pill status-cycle-done">
                  次回：{formatDateTimeJa(cycleStatus.nextDueDate)}
                </span>
              ) : (
                <span className={`status-pill ${later ? "status-later" : "status-pending"}`}>
                  {later ? "後でやる" : "未完了"}
                </span>
              )}
              {detailsToggle}
              <div className={`task-details${isExpanded ? " is-expanded" : ""}`}>
                <div className="task-details-inner">
                  <MetaPillRow task={task} labelNames={labelNames} />
                  <p className="task-memo">メモ：{memo || "なし"}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {!isDone && (
        <div className="task-card-footer">
          <button type="button" className="task-postpone-pill" onClick={handlePostponeClick}>
            🕒 あとでやる
          </button>
          {deleteButton}
        </div>
      )}
      {isDone && deleteButton && <div className="task-card-footer">{deleteButton}</div>}
    </div>
  );
}

export default TaskCard;
