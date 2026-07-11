// 既存 stats.html の .top-bar（ハンバーガー＋タイトル）を見た目だけ再現したもの。
// ドロワー機能は未接続のため、ハンバーガーボタンは装飾表示のみ。
function TopBar({ title }) {
  return (
    <header className="top-bar">
      <button
        className="hamburger-button"
        type="button"
        aria-label="メニューを開く"
        aria-expanded="false"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
      <h1>{title}</h1>
    </header>
  );
}

export default TopBar;
