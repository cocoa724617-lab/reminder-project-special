import { useState } from "react";
import { Link } from "react-router-dom";
import { useTasks, useRecentCompletedTasks, useLabelNames } from "../hooks/useTasks.js";
import { computeCompletionStats } from "../utils/statsUtils.js";
import { computeUserStatusStats, getUserStatusesFromStats, computeWeeklyProgress } from "../utils/userStatusUtils.js";
import { normalizeImportance } from "../utils/taskLabels.js";
import { celebrateCompletion } from "../utils/celebrate.js";
import MetaPillRow from "../components/MetaPillRow.jsx";

// 既存 index.html の getReminderLabel と同じ実装。
function getReminderLabel(task) {
  if (task.notifyDate) {
    return `通知日時：${task.notifyDate}${task.time ? " " + task.time : ""}`;
  }
  if (task.frequency && task.frequency !== "none") {
    if (task.frequencyCount) {
      const unitLabel = task.frequencyUnit === "week" ? "1週間" : "1日";
      return `${unitLabel}に${task.frequencyCount}回くらいランダム通知`;
    }
    const freqLabel =
      {
        small: "少なめ（1〜2回/日）",
        medium: "普通（3〜4回/日）",
        large: "多め（5〜7回/日）",
      }[task.frequency] || task.frequency;
    return `ランダム通知・${freqLabel}`;
  }
  if (task.dueDate || task.date) {
    return `期限：${task.dueDate || task.date}`;
  }
  return "日時未設定";
}

function getTaskTitle(task, fallback) {
  return task.title || task.name || fallback;
}

function getTaskDueDate(task) {
  return task.dueDate || task.date || "";
}

function getLocalTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

// 既存 index.html の isTodayTask と同じ実装：urgency未設定の既存タスクを一律「今日やる」扱いにしない。
function isTodayTask(task) {
  return normalizeDateValue(getTaskDueDate(task)) === getLocalTodayString() || task.urgency === "today";
}

function isActiveTask(task) {
  const status = String(task.status || "").trim();
  return status !== "完了" && status !== "後でやる";
}

const IMPORTANCE_RANK = { high: 0, medium: 1, low: 2 };

// 既存 index.html の pickNextTask と同じ実装：今日やるタスクの中から重要度→期限の順で1件選ぶ。
function pickNextTask(activeTasks) {
  const todaysActive = activeTasks.filter(isTodayTask);
  const pool = todaysActive.length > 0 ? todaysActive : activeTasks;

  return (
    pool.slice().sort((a, b) => {
      const rankA = IMPORTANCE_RANK[normalizeImportance(a.priority || a.importance)];
      const rankB = IMPORTANCE_RANK[normalizeImportance(b.priority || b.importance)];
      if (rankA !== rankB) return rankA - rankB;

      const dueA = getTaskDueDate(a) || "9999-99-99";
      const dueB = getTaskDueDate(b) || "9999-99-99";
      return dueA.localeCompare(dueB);
    })[0] || null
  );
}

function formatPercentText(value, emptyText = "集計対象なし") {
  if (value === null || value === undefined) return emptyText;
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) * 100)));
  return Number.isFinite(percent) ? `${percent}%` : emptyText;
}

function formatBestWeekdays(bestWeekdays) {
  if (!Array.isArray(bestWeekdays) || bestWeekdays.length === 0) return "まだ集計中";
  return bestWeekdays.map((day) => `${day}曜日`).join(" / ");
}

function getUserStatusMessage(stats) {
  if (stats.todayCompletedCount === 0) {
    return "今日はまだ完了タスクがありません。まずは1つ進めてみましょう。";
  }
  if (stats.postponedCompletedCount > 0) {
    return "あとでにしたタスクも、最終的に完了できています。";
  }
  return "少しずつ進めていきましょう。";
}

function HomePage() {
  const { tasks, isLoading: tasksLoading, error: tasksError, completeTask } = useTasks();
  const { completedTasks: recentCompletedFromServer, isLoading: completedLoading } = useRecentCompletedTasks();
  const labelNames = useLabelNames();
  // タスク完了直後は再取得を待たず、その場ですぐ集計へ反映するための楽観的な追加分。
  const [optimisticCompletions, setOptimisticCompletions] = useState([]);
  const recentCompleted = [...optimisticCompletions, ...recentCompletedFromServer];

  if (tasksLoading || completedLoading) {
    return (
      <section className="page-placeholder">
        <p>読み込み中</p>
      </section>
    );
  }

  if (tasksError) {
    return (
      <section className="page-placeholder">
        <p className="error-message">タスクの取得に失敗しました。時間をおいて再度お試しください。</p>
      </section>
    );
  }

  async function handleComplete(task) {
    if (!window.confirm("このタスクを完了にしますか？")) return;
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

  const activeTasks = tasks.filter(isActiveTask);
  const nextTask = pickNextTask(activeTasks);
  const todaysActive = activeTasks.filter(isTodayTask).filter((task) => !nextTask || task.id !== nextTask.id);

  const completionStats = computeCompletionStats(recentCompleted);
  // バッジ判定用：直近7日の移動窓（月曜になっても急にリセットされない）。
  const userStatusStats = computeUserStatusStats(tasks, recentCompleted);
  const currentStatuses = getUserStatusesFromStats(userStatusStats);
  // 「今週の進み具合」カード表示用：月曜0時起点の暦週で、実際に毎週リセットされる。
  const weeklyProgress = computeWeeklyProgress(tasks, recentCompleted);
  const completionRateText =
    weeklyProgress.completionTargetCount > 0 ? formatPercentText(weeklyProgress.completionRate) : "集計対象なし";
  const postponeRateText = formatPercentText(weeklyProgress.postponeRate, "0%");

  return (
    <section id="home-screen" className="home-screen">
      <section className="home-section" id="current-status-section">
        <h2 className="home-section-title">あなたの現在のステータス</h2>
        <div className="current-status-list" aria-live="polite">
          {currentStatuses.length === 0 ? (
            <p className="current-status-empty">ステータスはまだ集計中です。少しずつタスクを進めていきましょう。</p>
          ) : (
            currentStatuses.map((status) => (
              <article className="current-status-card" key={status.key}>
                {status.image && (
                  <img
                    className="current-status-image"
                    src={status.image}
                    alt={status.name || "ステータス画像"}
                    loading="lazy"
                    onError={(event) => event.target.remove()}
                  />
                )}
                <div className="current-status-body">
                  <h3 className="current-status-name">{status.name || "現在のステータス"}</h3>
                  <p className="current-status-description">{status.description || "今日も少しずつ進めていきましょう。"}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {nextTask && (
        <section className="home-section" id="next-task-section">
          <h2 className="home-section-title">次にやるタスク</h2>
          <div className="task-card next-task-card">
            <div className="task-info">
              <h3>{getTaskTitle(nextTask, "無題のタスク")}</h3>
              <p className="task-remind">{getReminderLabel(nextTask)}</p>
              <MetaPillRow task={nextTask} labelNames={labelNames} />
            </div>
            <div className="task-actions">
              <button type="button" onClick={() => handleComplete(nextTask)}>
                完了
              </button>
              <Link to={`/postpone/${nextTask.id}`} className="button-link btn-secondary home-later-button">
                あとでやる
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="home-section">
        <h2 className="home-section-title">今日やるべきタスク</h2>
        <div id="today-task-list">
          {todaysActive.length === 0 ? (
            <p className="task-list-empty">今日やるべきタスクはありません。のんびりいきましょう。</p>
          ) : (
            todaysActive.map((task) => (
              <div className="task-card task-card-compact" key={task.id}>
                <input
                  type="checkbox"
                  className="task-checkbox"
                  aria-label="完了にする"
                  checked={false}
                  onChange={() => handleComplete(task)}
                />
                <div className="task-info">
                  <h3>{getTaskTitle(task, "無題のタスク")}</h3>
                  <p className="task-remind">{getReminderLabel(task)}</p>
                  <MetaPillRow task={task} labelNames={labelNames} />
                </div>
                <Link to={`/postpone/${task.id}`} className="home-later-link">
                  あとで
                </Link>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="home-section" id="user-status-section">
        <h2 className="home-section-title">今週の進み具合</h2>
        <div className="user-status-card" aria-live="polite">
          <div className="user-status-grid">
            <div className="user-status-item">
              <span className="user-status-value">{weeklyProgress.todayCompletedCount}</span>
              <span className="user-status-label">今日の完了</span>
              <span className="user-status-unit">個</span>
            </div>
            <div className="user-status-item">
              <span className="user-status-value">{weeklyProgress.weeklyCompletedCount}</span>
              <span className="user-status-label">今週の完了</span>
              <span className="user-status-unit">個</span>
            </div>
            <div className="user-status-item">
              <span className="user-status-value">{weeklyProgress.postponedCompletedCount}</span>
              <span className="user-status-label">あとでから完了</span>
              <span className="user-status-unit">個</span>
            </div>
            <div className="user-status-item user-status-item-wide">
              <span className="user-status-label">よくできた曜日</span>
              <span className="user-status-text">{formatBestWeekdays(weeklyProgress.bestWeekdays)}</span>
            </div>
            <div className="user-status-item">
              <span className="user-status-value">{completionRateText}</span>
              <span className="user-status-label">達成率</span>
            </div>
            <div className="user-status-item">
              <span className="user-status-value">{postponeRateText}</span>
              <span className="user-status-label">後でやる使用率</span>
            </div>
          </div>
          <p className="user-status-message">{getUserStatusMessage(weeklyProgress)}</p>
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section-title">成果の確認</h2>
        <div className="stat-tile-grid">
          <div className="stat-tile">
            <span className="stat-tile-value">{completionStats.todayCount}</span>
            <span className="stat-tile-label">今日の完了</span>
          </div>
          <div className="stat-tile">
            <span className="stat-tile-value">{completionStats.weekCount}</span>
            <span className="stat-tile-label">今週の完了</span>
          </div>
          <div className="stat-tile stat-tile-accent">
            <span className="stat-tile-value">{completionStats.fromLaterCount}</span>
            <span className="stat-tile-label">あとでから完了</span>
          </div>
        </div>
        <Link to="/stats" className="home-stats-link">
          実績をもっと見る ›
        </Link>
      </section>

      <Link to="/tasks/new" className="fab-button" aria-label="タスクを追加">
        +
      </Link>
    </section>
  );
}

export default HomePage;
