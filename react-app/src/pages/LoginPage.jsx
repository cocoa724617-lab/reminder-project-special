import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/useAuth.js";
import { signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, translateAuthError } from "../services/authService.js";
import EmailLoginForm from "../components/EmailLoginForm.jsx";
import SignupForm from "../components/SignupForm.jsx";
import PasswordResetForm from "../components/PasswordResetForm.jsx";

// 既存 login.html のReact版。Googleログインに加え、メールログイン・新規登録・パスワード再設定を
// 画面内のモード切り替えで提供する（既存はログイン/新規登録の1フォームを使い回す設計だったが、
// ここではコンポーネントを分けたぶん、モードとして3つを切り替える形にしている）。
function LoginPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  function resetMessages() {
    setError("");
    setInfo("");
  }

  function switchMode(nextMode) {
    resetMessages();
    setMode(nextMode);
  }

  async function handleGoogleLogin() {
    resetMessages();
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Googleログインエラー:", err);
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEmailLogin(email, password) {
    resetMessages();
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("メールログインエラー:", err.code || err);
      setError(translateAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignup(email, password) {
    resetMessages();
    setIsSubmitting(true);
    try {
      await signUpWithEmail(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("新規登録エラー:", err.code || err);
      setError(translateAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset(email) {
    resetMessages();
    setIsSubmitting(true);
    try {
      await resetPassword(email);
      setInfo("パスワード再設定用のメールを送信しました。");
    } catch (err) {
      console.error("パスワード再設定エラー:", err.code || err);
      setError(translateAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="home-main">
      <section className="notification-card">
        <div className="notification-icon">🔔</div>
        <h2>ログインしてはじめる</h2>
        <p>Googleアカウント、またはメールアドレスでログインしてください</p>

        <button type="button" onClick={handleGoogleLogin} disabled={isSubmitting}>
          Googleでログイン
        </button>

        <p className="login-divider-text">または</p>

        {mode === "login" && <EmailLoginForm onSubmit={handleEmailLogin} isSubmitting={isSubmitting} />}
        {mode === "signup" && <SignupForm onSubmit={handleSignup} isSubmitting={isSubmitting} />}
        {mode === "reset" && <PasswordResetForm onSubmit={handlePasswordReset} isSubmitting={isSubmitting} />}

        <div className="login-links-row">
          {mode !== "login" && (
            <button type="button" className="link-button" onClick={() => switchMode("login")}>
              ログインはこちら
            </button>
          )}
          {mode !== "signup" && (
            <button type="button" className="link-button" onClick={() => switchMode("signup")}>
              新規登録はこちら
            </button>
          )}
          {mode !== "reset" && (
            <button type="button" className="link-button" onClick={() => switchMode("reset")}>
              パスワードを忘れた場合
            </button>
          )}
        </div>

        {error && <p className="login-error">{error}</p>}
        {info && <p className="login-info">{info}</p>}
      </section>
    </main>
  );
}

export default LoginPage;
