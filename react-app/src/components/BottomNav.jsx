// 既存アプリの .bottom-nav を見た目だけ再現したもの。
// React Router 未接続のためリンク先はダミー（href="#"）で、実際の画面遷移はしない。
const NAV_ITEMS = [
  { key: "home", icon: "🏠", label: "Home" },
  { key: "list", icon: "📋", label: "List" },
  { key: "later", icon: "🕒", label: "あとで" },
  { key: "setting", icon: "⚙️", label: "Setting" },
];

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((item) => (
        <a key={item.key} href="#">
          <span className="icon">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

export default BottomNav;
