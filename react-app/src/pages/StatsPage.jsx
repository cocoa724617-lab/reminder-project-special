import { useTasks, useRecentCompletedTasks } from "../hooks/useTasks.js";
import { computeCompletionStats } from "../utils/statsUtils.js";
import { computeMonthlyProgress } from "../utils/userStatusUtils.js";
import { formatDate } from "../utils/dateUtils.js";

const MONTHLY_RANGE_DAYS = 30;

function formatPercentText(value, emptyText = "集計対象なし") {
  if (value === null || value === undefined) return emptyText;
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) * 100)));
  return Number.isFinite(percent) ? `${percent}%` : emptyText;
}

function StatsPage() {
  const { tasks, isLoading: tasksLoading, error: tasksError } = useTasks();
  const {
    completedTasks,
    isLoading: completedLoading,
    error: completedError,
  } = useRecentCompletedTasks(MONTHLY_RANGE_DAYS);

  if (tasksLoading || completedLoading) {
    return (
      <section className="page-placeholder">
        <p>読み込み中</p>
      </section>
    );
  }

  if (tasksError || completedError) {
    return (
      <section className="page-placeholder">
        <p className="error-message">実績の取得に失敗しました。時間をおいて再度お試しください。</p>
      </section>
    );
  }

  const stats = computeCompletionStats(completedTasks);
  const weekdayText =
    stats.bestWeekdays.length > 0 ? stats.bestWeekdays.map((day) => `${day}曜日`).join("・") : "まだデータがありません";

  // 直近30日（約1か月）分の達成率・完了数・完了タスク名一覧。
  // 達成率・完了数はremovedFromHistory（完了済み一覧からの削除）の影響を受けないが、
  // 名前一覧はここで除外し、一覧から消す操作をこの画面でも反映する。
  const monthlyStats = computeMonthlyProgress(tasks, completedTasks, new Date(), MONTHLY_RANGE_DAYS);
  const visibleMonthlyCompletedTasks = monthlyStats.completedTasks.filter((task) => !task.removedFromHistory);
  const monthlyCompletionRateText =
    monthlyStats.completionTargetCount > 0 ? formatPercentText(monthlyStats.completionRate) : "集計対象なし";

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

      <div className="card stat-monthly-card">
        <h2>直近{MONTHLY_RANGE_DAYS}日の実績</h2>
        <div className="stat-tile-grid">
          <div className="stat-tile">
            <span className="stat-tile-value">{monthlyStats.monthlyCompletedCount}</span>
            <span className="stat-tile-label">完了タスク数</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{monthlyCompletionRateText}</span>
            <span className="stat-tile-label">達成率</span>
          </div>
        </div>

        {visibleMonthlyCompletedTasks.length === 0 ? (
          <p className="task-list-empty">まだ完了したタスクがありません。</p>
        ) : (
          <ul className="stat-history-list">
            {visibleMonthlyCompletedTasks.map((task) => (
              <li className="stat-history-item" key={task.id}>
                <span className="stat-history-name">{task.name}</span>
                <span className="stat-history-date">
                  {formatDate(task.completedAt)}
                  {task.isFromLater ? "・あとでから完了" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="stat-footnote">
        「あとでから完了」は、一度でも後回しにしたタスクを最後までやり切れた数です。先延ばしからの巻き返しも、ちゃんと成果としてカウントします。
      </p>
    </section>
  );
}

export default StatsPage;
