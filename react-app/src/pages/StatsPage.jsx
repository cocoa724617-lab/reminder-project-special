import { useRecentCompletedTasks } from "../hooks/useTasks.js";
import { computeCompletionStats } from "../utils/statsUtils.js";

function StatsPage() {
  const { completedTasks, isLoading, error } = useRecentCompletedTasks();

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
        <p className="error-message">
          実績の取得に失敗しました。時間をおいて再度お試しください。
        </p>
      </section>
    );
  }

  const stats = computeCompletionStats(completedTasks);
  const weekdayText =
    stats.bestWeekdays.length > 0
      ? stats.bestWeekdays.map((day) => `${day}曜日`).join("・")
      : "まだデータがありません";

  return (
    <section id="stats-screen">
      <div className="stat-tile-grid">
        <div className="stat-tile">
          <span className="stat-tile-value">{stats.todayCount}</span>
          <span className="stat-tile-label">今日の完了</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value">{stats.weekCount}</span>
          <span className="stat-tile-label">今週の完了</span>
        </div>
        <div className="stat-tile stat-tile-accent">
          <span className="stat-tile-value">{stats.fromLaterCount}</span>
          <span className="stat-tile-label">あとでから完了</span>
        </div>
      </div>

      <div className="card stat-weekday-card">
        <h2>よくできた曜日</h2>
        <p>{weekdayText}</p>
      </div>

      <p className="stat-footnote">
        「あとでから完了」は、一度でも後回しにしたタスクを最後までやり切れた数です。先延ばしからの巻き返しも、ちゃんと成果としてカウントします。
      </p>
    </section>
  );
}

export default StatsPage;
