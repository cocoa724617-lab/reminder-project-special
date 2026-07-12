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
  "/completed": "完了済みタスク",
  "/stats": "実績・記録",
  "/postpone": "あとでやる",
  "/postponed": "あとでやる",
  "/settings/notifications": "通知設定",
};

// /postpone/:taskId のような動的セグメントはPAGE_TITLESの完全一致では拾えないため、前方一致で補う
// （"/postponed" は上のPAGE_TITLESで完全一致するため、ここでは "/postpone/" 配下だけを対象にする）。
function getPageTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/postpone/")) return "あとでやる";
  return "リマインダー";
}

// TopBar・NavDrawer・BottomNav をまとめた共通レイアウト。
// 各ページはこの中の <Outlet /> の位置に描画される。
function Layout() {
  const { pathname } = useLocation();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="has-fixed-header">
      <TopBar
        title={getPageTitle(pathname)}
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
