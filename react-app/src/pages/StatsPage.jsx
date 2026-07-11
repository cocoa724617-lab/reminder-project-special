// 既存 stats.html の見た目を再現するための仮データ。
// Firebase / stats.js には未接続で、実データは扱わない。
const dummyStats = {
  todayCount: 3,
  weekCount: 12,
  fromLaterCount: 4,
  bestWeekdays: ["火", "木"],
};

function StatsPage() {
  const weekdayText =
    dummyStats.bestWeekdays.length > 0
      ? dummyStats.bestWeekdays.map((day) => `${day}曜日`).join("・")
      : "まだデータがありません";

  return (
    <section id="stats-screen">
      <div className="stat-tile-grid">
        <div className="stat-tile">
          <span className="stat-tile-value">{dummyStats.todayCount}</span>
          <span className="stat-tile-label">今日の完了</span>
        </div>
        <div className="stat-tile">
          <span className="stat-tile-value">{dummyStats.weekCount}</span>
          <span className="stat-tile-label">今週の完了</span>
        </div>
        <div className="stat-tile stat-tile-accent">
          <span className="stat-tile-value">{dummyStats.fromLaterCount}</span>
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
