import { useNavigate } from "react-router-dom";
import { useTasks, useLabelNames } from "../hooks/useTasks.js";
import { celebrateCompletion } from "../utils/celebrate.js";
import TaskCard from "../components/TaskCard.jsx";
import EmptyState from "../components/EmptyState.jsx";

// 既存 atodeyaru.html のidなしモード（一覧モード）のReact版。
// useTasks() はログイン中ユーザー自身の tasks サブコレクションしか取得しないため、
// 他ユーザーのタスクが混ざることはない。並び順も既存同様、取得順のまま特別なソートは行わない。
function PostponedTasksPage() {
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
    try {
      await completeTask(task);
      celebrateCompletion();
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

  function handleEdit(task) {
    navigate(`/tasks/new?id=${task.id}`);
  }

  function handlePostpone(task) {
    navigate(`/postpone/${task.id}`);
  }

  // 不正な日付や欠損データがあってもcrashしないよう、statusの取り出し自体もString化してから比較する。
  const postponedTasks = tasks.filter((task) => String((task && task.status) || "").trim() === "後でやる");

  return (
    <section id="postponed-tasks-screen">
      {postponedTasks.length === 0 ? (
        <EmptyState>今「あとでやる」に入っているタスクはありません。</EmptyState>
      ) : (
        <div id="postponed-task-list">
          {postponedTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="postponed"
              labelNames={labelNames}
              onComplete={handleComplete}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onPostpone={handlePostpone}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default PostponedTasksPage;
