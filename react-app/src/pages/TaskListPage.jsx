import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTasks, useLabelNames, useRecentCompletedTasks } from "../hooks/useTasks.js";
import { celebrateCompletion } from "../utils/celebrate.js";
import { getRepeatCycleStatus } from "../utils/taskLabels.js";
import TaskCard from "../components/TaskCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

// 既存 task-list.html と同じ並び順：後でやる状態のタスクを後ろへ回す（安定ソート）。
// 「完了」状態のタスクは tasks コレクションに存在しないため、ここでは考慮不要。
function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const laterA = String(a.status || "").trim() === "後でやる" ? 1 : 0;
    const laterB = String(b.status || "").trim() === "後でやる" ? 1 : 0;
    return laterA - laterB;
  });
}

function TaskListPage() {
  const { tasks, isLoading, error, completeTask, removeTask } = useTasks();
  const labelNames = useLabelNames();
  const navigate = useNavigate();
  // 通常タスクの完了履歴（完了済みセクション用）。繰り返しタスクの「今回分完了済みか」は
  // tasks側のlastCompletedAt/dueDateだけで判定できるためここでは使わない。
  const {
    completedTasks: completedFromServer,
    isLoading: completedLoading,
    removeCompletedTask,
  } = useRecentCompletedTasks(14);
  // 通常タスクを完了した直後、再取得を待たずその場で完了済みセクションへ反映するための楽観的な追加分
  // （繰り返しタスクはtasks一覧側がそのまま更新されるのでここには積まない）。
  const [optimisticCompletions, setOptimisticCompletions] = useState([]);
  const completedTasks = [...optimisticCompletions, ...completedFromServer];

  if (isLoading || completedLoading) {
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
    try {
      const completedEntry = await completeTask(task);
      celebrateCompletion();
      if (completedEntry) {
        setOptimisticCompletions((prev) => [completedEntry, ...prev]);
      }
    } catch (err) {
      console.error("タスクの完了に失敗しました:", err);
      alert("タスクの完了に失敗しました。時間をおいて再度お試しください。");
    }
  }

  // 削除確認ダイアログはTaskCard側(削除アイコン押下時)で表示済みのため、ここでは実行するだけ。
  async function handleDelete(task) {
    try {
      await removeTask(task.id);
    } catch (err) {
      console.error("タスクの削除に失敗しました:", err);
      alert("タスクの削除に失敗しました。時間をおいて再度お試しください。");
    }
  }

  async function handleDeleteCompleted(entry) {
    try {
      await removeCompletedTask(entry.id);
      setOptimisticCompletions((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (err) {
      console.error("完了済みタスクの削除に失敗しました:", err);
      alert("削除に失敗しました。時間をおいて再度お試しください。");
    }
  }

  function handleEdit(task) {
    navigate(`/tasks/new?id=${task.id}`);
  }

  function handlePostpone(task) {
    navigate(`/postpone/${task.id}`);
  }

  // 未完了：繰り返しタスクで「今回分」を完了済み（次のdueDateがまだ来ていない）のものは除く。
  const pendingTasks = sortTasks(tasks.filter((task) => !getRepeatCycleStatus(task)));

  // 完了済み①：繰り返しタスクで今回分を完了済みのもの（tasksコレクションに残ったまま、次回情報を表示）。
  const cycleCompletedTasks = tasks
    .map((task) => ({ task, cycleStatus: getRepeatCycleStatus(task) }))
    .filter((entry) => entry.cycleStatus);

  // 完了済み②：通常タスクの完了履歴（繰り返しタスクの分は①と二重表示になるため除く）。
  const cycleCompletedTaskIds = new Set(cycleCompletedTasks.map(({ task }) => task.id));
  const standaloneCompletedEntries = completedTasks.filter(
    (entry) => !cycleCompletedTaskIds.has(entry.originalTaskId),
  );

  const hasCompletedSection = cycleCompletedTasks.length > 0 || standaloneCompletedEntries.length > 0;

  return (
    <section id="task-list-screen">
      <h2 className="home-section-title">未完了</h2>
      {pendingTasks.length === 0 ? (
        <EmptyState>まだタスクがありません。＋ボタンから追加できます。</EmptyState>
      ) : (
        <div id="task-list">
          {pendingTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="active"
              labelNames={labelNames}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPostpone={handlePostpone}
            />
          ))}
        </div>
      )}

      {hasCompletedSection && (
        <>
          <h2 className="home-section-title task-list-completed-title">完了済み</h2>
          <div id="task-list-completed">
            {cycleCompletedTasks.map(({ task, cycleStatus }) => (
              <TaskCard
                key={task.id}
                task={task}
                variant="active"
                labelNames={labelNames}
                cycleStatus={cycleStatus}
                onComplete={handleComplete}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onPostpone={handlePostpone}
              />
            ))}
            {standaloneCompletedEntries.map((entry) => (
              <TaskCard
                key={entry.id}
                task={entry}
                variant="completed"
                labelNames={labelNames}
                onDelete={handleDeleteCompleted}
              />
            ))}
          </div>
        </>
      )}

      <Link to="/tasks/new" className="fab-button" aria-label="タスクを追加">
        +
      </Link>
    </section>
  );
}

export default TaskListPage;
