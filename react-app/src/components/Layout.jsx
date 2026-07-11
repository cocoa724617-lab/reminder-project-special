import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import TopBar from "./TopBar.jsx";
import BottomNav from "./BottomNav.jsx";
import NavDrawer from "./NavDrawer.jsx";

// パスごとの画面タイトル。既存アプリの各 HTML の <h1> に相当する。
const PAGE_TITLES = {
  "/": "ホーム",
  "/tasks": "タスク一覧",
  "/tasks/new": "タスク登録 / 編集",
  "/stats": "実績・記録",
};

// TopBar・NavDrawer・BottomNav をまとめた共通レイアウト。
// 各ページはこの中の <Outlet /> の位置に描画される。
function Layout() {
  const { pathname } = useLocation();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="has-fixed-header">
      <TopBar
        title={PAGE_TITLES[pathname] || "リマインダー"}
        isDrawerOpen={isDrawerOpen}
        onMenuClick={() => setDrawerOpen(true)}
      />
      <NavDrawer isOpen={isDrawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="page-main">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}

export default Layout;
