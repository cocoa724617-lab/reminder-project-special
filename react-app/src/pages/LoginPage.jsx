import { useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { Navigate, useNavigate } from "react-router-dom";
import { auth, googleProvider } from "../services/firebase.js";
import { useAuth } from "../contexts/AuthContext.jsx";

// 既存 login.html の Google ログインだけを再現したもの。
// メールログイン・新規登録・パスワードリセットはまだ実装しない。
function LoginPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  async function handleGoogleLogin() {
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("ログインエラー:", err);
      setError("ログインに失敗しました。もう一度お試しください。");
    }
  }

  return (
    <main className="home-main">
      <section className="notification-card">
        <div className="notification-icon">🔔</div>
        <h2>ログインしてはじめる</h2>
        <p>Googleアカウントでログインしてください</p>

        <button type="button" onClick={handleGoogleLogin}>
          Googleでログイン
        </button>

        {error && <p className="login-error">{error}</p>}
      </section>
    </main>
  );
}

export default LoginPage;
