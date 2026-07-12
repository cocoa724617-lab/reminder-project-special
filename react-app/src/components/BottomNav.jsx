import { NavLink } from "react-router-dom";

// 既存アプリの .bottom-nav を見た目だけ再現したもの。
// 「あとで」は /postponed（旧 atodeyaru.html の一覧モード）に接続済み。
const NAV_LINKS = [
  { key: "home", icon: "🏠", label: "Home", to: "/", end: true },
  { key: "list", icon: "📋", label: "List", to: "/tasks" },
  { key: "later", icon: "🕒", label: "あとで", to: "/postponed" },
  { key: "setting", icon: "⚙️", label: "Setting", to: "/settings/notifications" },
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
    </nav>
  );
}

export default BottomNav;
