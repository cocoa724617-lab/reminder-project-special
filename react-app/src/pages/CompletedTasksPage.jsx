import { useMemo, useState } from "react";
import { useCompletedTasks, useLabelNames } from "../hooks/useTasks.js";
import { TASK_LABELS, getTaskLabel } from "../utils/taskLabels.js";
import { toDate, isSameDay, startOfWeek } from "../utils/dateUtils.js";
import TaskCard from "../components/TaskCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

// 既存 completed-tasks.html の matchesPeriod と同じ実装。
function matchesPeriod(task, period) {
  if (period === "all") return true;
  const completedAt = toDate(task.deletedAt);
  if (!completedAt) return false;

  const now = new Date();
  if (period === "today") return isSameDay(completedAt, now);
  if (period === "week") return completedAt >= startOfWeek(now);
  if (period === "month") {
    return completedAt.getFullYear() === now.getFullYear() && completedAt.getMonth() === now.getMonth();
  }
  return true;
}

function CompletedTasksPage() {
  const { completedTasks, isLoading, error, removeCompletedTask } = useCompletedTasks();
  const labelNames = useLabelNames();
  const [labelFilter, setLabelFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  const filteredTasks = useMemo(() => {
    return completedTasks
      .filter((task) => labelFilter === "all" || (task.color || "none") === labelFilter)
      .filter((task) => matchesPeriod(task, periodFilter))
      .sort((a, b) => {
        const dateA = toDate(a.deletedAt);
        const dateB = toDate(b.deletedAt);
        if (!dateA || !dateB) return 0;
        return dateB - dateA;
      });
  }, [completedTasks, labelFilter, periodFilter]);

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
        <p className="error-message">完了済みタスクの取得に失敗しました。時間をおいて再度お試しください。</p>
      </section>
    );
  }

  async function handleDelete(task) {
    if (!window.confirm("この完了済みタスクを削除しますか？この操作は取り消せません。")) return;
    try {
      await removeCompletedTask(task.id);
    } catch (err) {
      console.error("完了済みタスクの削除に失敗しました:", err);
      alert("削除に失敗しました。時間をおいて再度お試しください。");
    }
  }

  return (
    <section id="completed-tasks-screen">
      <div className="filter-bar">
        <select
          aria-label="ラベルで絞り込む"
          value={labelFilter}
          onChange={(event) => setLabelFilter(event.target.value)}
        >
          <option value="all">すべてのラベル</option>
          {Object.keys(TASK_LABELS).map((key) => (
            <option key={key} value={key}>
              {getTaskLabel(key, labelNames).name}
            </option>
          ))}
        </select>

        <select
          aria-label="期間で絞り込む"
          value={periodFilter}
          onChange={(event) => setPeriodFilter(event.target.value)}
        >
          <option value="all">すべての期間</option>
          <option value="today">今日</option>
          <option value="week">今週</option>
          <option value="month">今月</option>
        </select>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState>条件に合う完了済みタスクはありません。</EmptyState>
      ) : (
        <div id="completed-task-list">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="completed"
              compact
              labelNames={labelNames}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default CompletedTasksPage;
