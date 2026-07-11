import { useNavigate } from "react-router-dom";
import { useTasks, useLabelNames } from "../hooks/useTasks.js";
import { celebrateCompletion } from "../utils/celebrate.js";
import TaskCard from "../components/TaskCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

// 既存 task-list.html と同じ並び順：完了/後でやる状態のタスクを後ろへ回す（安定ソート）。
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const statusA = String(a.status || "").trim();
    const statusB = String(b.status || "").trim();
    const doneA = statusA === "完了" || statusA === "後でやる" ? 1 : 0;
    const doneB = statusB === "完了" || statusB === "後でやる" ? 1 : 0;
    return doneA - doneB;
  });
}

function TaskListPage() {
  const { tasks, isLoading, error, completeTask, removeTask } = useTasks();
  const labelNames = useLabelNames();
  const navigate = useNavigate();

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

  async function handleComplete(task) {
    if (!window.confirm("このタスクを完了にしますか？")) return;
    try {
      await completeTask(task);
      celebrateCompletion();
    } catch (err) {
      console.error("タスクの完了に失敗しました:", err);
      alert("タスクの完了に失敗しました。時間をおいて再度お試しください。");
    }
  }

  async function handleDelete(task) {
    if (!window.confirm("このタスクを削除しますか？この操作は取り消せません。")) return;
    try {
      await removeTask(task.id);
    } catch (err) {
      console.error("タスクの削除に失敗しました:", err);
      alert("タスクの削除に失敗しました。時間をおいて再度お試しください。");
    }
  }

  function handleEdit(task) {
    navigate(`/tasks/new?id=${task.id}`);
  }

  const sortedTasks = sortTasks(tasks);

  return (
    <section id="task-list-screen">
      {sortedTasks.length === 0 ? (
        <EmptyState>まだタスクがありません。＋ボタンから追加できます。</EmptyState>
      ) : (
        <div id="task-list">
          {sortedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="active"
              labelNames={labelNames}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default TaskListPage;
