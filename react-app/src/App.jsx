import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./contexts/useAuth.js";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";

// ホーム・ログイン以外のページは初回表示に必須ではないため、ページ単位で遅延読み込みする
// （挙動は変えず、バンドルを分割してビルド時の500kB超過警告を抑えるための対応）。
const TaskListPage = lazy(() => import("./pages/TaskListPage.jsx"));
const TaskFormPage = lazy(() => import("./pages/TaskFormPage.jsx"));
const CompletedTasksPage = lazy(() => import("./pages/CompletedTasksPage.jsx"));
const StatsPage = lazy(() => import("./pages/StatsPage.jsx"));
const PostponePage = lazy(() => import("./pages/PostponePage.jsx"));
const PostponedTasksPage = lazy(() => import("./pages/PostponedTasksPage.jsx"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <p className="auth-loading">読み込み中</p>;
  }

  return (
    <Suspense fallback={<p className="auth-loading">読み込み中</p>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/tasks" element={<TaskListPage />} />
            <Route path="/tasks/new" element={<TaskFormPage />} />
            <Route path="/completed" element={<CompletedTasksPage />} />
            <Route path="/stats" element={<StatsPage />} />
            {/* /postpone は旧 atodeyaru.html?id=... 形式のリンク互換用（クエリの id を読む） */}
            <Route path="/postpone" element={<PostponePage />} />
            <Route path="/postpone/:taskId" element={<PostponePage />} />
            <Route path="/postponed" element={<PostponedTasksPage />} />
            <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
            {/* ログイン済みで存在しないパスを開いた場合は、レイアウト付きの404を表示する。
                未ログインの場合はProtectedRouteが先に/loginへ振り分けるため、その場合はログイン画面が優先される
                （他の保護ルートと同じ挙動で一貫させている）。 */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
