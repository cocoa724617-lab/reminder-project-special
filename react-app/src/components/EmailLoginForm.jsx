import { useState } from "react";

// 既存 login.html の email-login-form（ログインモード）と同じ入力項目。
function EmailLoginForm({ onSubmit, isSubmitting }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(email, password);
  }

  return (
    <form className="email-auth-form" onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="メールアドレス"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <input
        type="password"
        placeholder="パスワード（6文字以上）"
        autoComplete="current-password"
        minLength={6}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "ログイン中…" : "ログイン"}
      </button>
    </form>
  );
}

export default EmailLoginForm;
