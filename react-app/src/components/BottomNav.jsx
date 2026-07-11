import { NavLink } from "react-router-dom";

// 既存アプリの .bottom-nav を見た目だけ再現したもの。
// ページが用意できているものだけ実際にリンクし、現在のパスに応じて is-active が自動で切り替わる。
// あとで／Setting はまだページ未作成のため、押しても遷移しない非活性表示にしている。
const NAV_LINKS = [
  { key: "home", icon: "🏠", label: "Home", to: "/", end: true },
  { key: "list", icon: "📋", label: "List", to: "/tasks" },
];

const NAV_DISABLED = [
  { key: "later", icon: "🕒", label: "あとで" },
  { key: "setting", icon: "⚙️", label: "Setting" },
];

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_LINKS.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? "is-active" : undefined)}
        >
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
      {NAV_DISABLED.map((item) => (
        <span key={item.key} className="bottom-nav-disabled" aria-disabled="true">
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </span>
      ))}
    </nav>
  );
}

export default BottomNav;
