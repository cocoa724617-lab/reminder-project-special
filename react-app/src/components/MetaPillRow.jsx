import {
  getTaskLabel,
  normalizeImportance,
  IMPORTANCE_LABELS,
  normalizeUrgency,
  URGENCY_LABELS,
  REPEAT_LABELS,
  isRepeatingTask,
} from "../utils/taskLabels.js";

// 既存 task-list.html / index.html の buildMetaPills をコンポーネント化したもの。
// 重要度・優先度・色ラベル・繰り返し設定のピルをまとめて表示する（通常タスク用）。
function MetaPillRow({ task, labelNames }) {
  const importance = normalizeImportance(task.priority || task.importance || task.priorityLevel);
  const urgency = normalizeUrgency(task.urgency);
  const labelMeta = getTaskLabel(task.color, labelNames);

  return (
    <div className="meta-pill-row">
      <span className={`meta-pill meta-pill-importance-${importance}`}>
        重要度：{IMPORTANCE_LABELS[importance]}
      </span>
      <span className="meta-pill">予定：{URGENCY_LABELS[urgency]}</span>
      {task.color && task.color !== "none" && (
        <span className="meta-pill meta-pill-label" style={{ "--label-color": labelMeta.color }}>
          {labelMeta.name}
        </span>
      )}
      {isRepeatingTask(task) && (
        <span className="meta-pill">🔁 {REPEAT_LABELS[task.repeat] || task.repeat}</span>
      )}
    </div>
  );
}

export default MetaPillRow;
