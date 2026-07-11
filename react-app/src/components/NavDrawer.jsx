import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

// 既存アプリの .nav-drawer を見た目・開閉動作だけ再現したもの。
// まだページが無い項目は、元アプリの data-disabled="true" + soon-badge の表現をそのまま踏襲する。
function NavDrawer({ isOpen, onClose }) {
  const { logout } = useAuth();

  function handleDisabledClick(event) {
    event.preventDefault();
    onClose();
  }

  async function handleLogout(event) {
    event.preventDefault();
    onClose();
    await logout();
  }

  return (
    <>
      <div
        className={`nav-drawer-backdrop${isOpen ? " is-visible" : ""}`}
        onClick={onClose}
      />
      <nav className={`nav-drawer${isOpen ? " is-open" : ""}`} aria-hidden={!isOpen}>
        <div className="nav-drawer-header">
          <span className="nav-drawer-title">メニュー</span>
        </div>
        <ul className="nav-drawer-list">
          <li>
            <a href="#" data-disabled="true" onClick={handleDisabledClick}>
              完了済みタスク
              <span className="soon-badge">準備中</span>
            </a>
          </li>
          <li>
            <Link to="/stats" onClick={onClose}>
              実績・記録
            </Link>
          </li>
          <li>
            <Link to="/tasks/new" onClick={onClose}>
              タスク追加
            </Link>
          </li>
          <li>
            <a href="#" className="is-logout" onClick={handleLogout}>
              ログアウト
            </a>
          </li>
        </ul>
      </nav>
    </>
  );
}

export default NavDrawer;
