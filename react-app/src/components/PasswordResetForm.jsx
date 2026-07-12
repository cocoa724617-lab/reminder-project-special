import { useState } from "react";

// 既存 login.html の forgotPasswordButton と同じFirebase呼び出し（sendPasswordResetEmail）を、
// 独立した画面として切り出したもの（既存はログイン用メール欄を流用していたが、こちらは専用の入力欄を持つ）。
function PasswordResetForm({ onSubmit, isSubmitting }) {
  const [email, setEmail] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(email);
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
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "送信中…" : "再設定メールを送る"}
      </button>
    </form>
  );
}

export default PasswordResetForm;
