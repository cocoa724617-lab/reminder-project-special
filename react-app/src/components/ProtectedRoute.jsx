import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/useAuth.js";

// 未ログインなら /login へ飛ばすゲート。認証状態の読み込み中は
// App 側で "読み込み中" 表示に切り替えているため、ここに来た時点で判定は済んでいる。
function ProtectedRoute() {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
