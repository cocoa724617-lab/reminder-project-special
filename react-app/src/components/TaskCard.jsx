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

// TaskListPage / CompletedTasksPage / PostponedTasksPage で共用するタスクカード。
// variant="active"    : 既存 task-list.html のカード（完了・後でやる・編集・削除ボタン付き）
// variant="completed" : 既存 completed-tasks.html のカード（完了日・削除ボタンのみ）
// variant="postponed" : 既存 atodeyaru.html 一覧モードのカードを拡張したもの
//                        （元の期限・あとでやるにした時間・後回し回数・最後に後回しにした日を追加表示。
//                        アクションはactiveと同じ完了/後でやる/編集/削除の4つ）
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
  if (!task) return null;

  const labelMeta = getTaskLabel(task.color, labelNames);
  const cardClassName = compact ? "task-card task-card-compact" : "task-card";
  const cardStyle = { borderLeft: `4px solid ${labelMeta.color}` };

  if (variant === "completed") {
    const memo = task.memo || task.description || "";

    return (
      <div className={cardClassName} style={cardStyle}>
        <div className="task-info">
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
          {onDelete && (
            <div className="task-actions">
              <button type="button" onClick={() => onDelete(task)}>
                削除
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const later = String(task.status || "").trim() === "後でやる";
  const memo = task.memo || task.description || "";
  const isPostponed = variant === "postponed";

  return (
    <div className={cardClassName} style={cardStyle}>
      <div className="task-info">
        <h3>
          <span className="color-dot task-title-dot" style={{ background: labelMeta.color }}></span>
          {getTaskTitle(task, "(無題)")}
        </h3>

        {isPostponed ? (
          <>
            <p className="task-remind">
              元の期限：{task.dueDate || task.date || "未設定"}
              {task.dueTime ? ` ${task.dueTime}` : ""}
            </p>
            <MetaPillRow task={task} labelNames={labelNames} />
            <p className="task-memo">メモ：{memo || "なし"}</p>
            <p className="task-memo">あとでやるにした時間：{task.laterTime || "未設定"}</p>
            <p className="task-memo">後回しにした回数：{task.laterCount || 0}回</p>
            <p className="task-memo">最後に後回しにした日：{formatDate(task.lastPostponedAt, "記録なし")}</p>
          </>
        ) : (
          <>
            <p className="task-remind">{getReminderLabel(task)}</p>
            <MetaPillRow task={task} labelNames={labelNames} />
            <p className="task-memo">メモ：{memo || "なし"}</p>
            {cycleStatus ? (
              <span className="status-pill status-cycle-done">
                今回分は完了済み・次回：{formatDateTimeJa(cycleStatus.nextDueDate)}
              </span>
            ) : (
              <span className={`status-pill ${later ? "status-later" : "status-pending"}`}>
                {later ? "後でやる" : "未完了"}
              </span>
            )}
          </>
        )}
      </div>
      <div className="task-actions">
        <button
          type="button"
          onClick={() => onComplete(task)}
          disabled={!!cycleStatus}
          title={cycleStatus ? `次回（${formatDateTimeJa(cycleStatus.nextDueDate)}）まで完了済みです` : undefined}
        >
          完了
        </button>
        <button type="button" onClick={() => onPostpone(task)}>
          後でやる
        </button>
        <button type="button" onClick={() => onEdit(task)}>
          編集
        </button>
        <button type="button" onClick={() => onDelete(task)}>
          削除
        </button>
      </div>
    </div>
  );
}

export default TaskCard;
