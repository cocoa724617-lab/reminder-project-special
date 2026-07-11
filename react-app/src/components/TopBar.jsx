// 既存 stats.html の .top-bar（ハンバーガー＋タイトル）を見た目だけ再現したもの。
// ハンバーガーボタンは NavDrawer の開閉を親（Layout）に委譲する。
function TopBar({ title, isDrawerOpen, onMenuClick }) {
  return (
    <header className="top-bar">
      <button
        className="hamburger-button"
        type="button"
        aria-label="メニューを開く"
        aria-expanded={isDrawerOpen ? "true" : "false"}
        onClick={onMenuClick}
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
