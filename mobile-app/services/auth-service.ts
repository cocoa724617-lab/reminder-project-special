import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "./firebase";

// 既存 react-app/src/services/authService.js のExpo版。
// signInWithGoogle は未移植（Phase1では見送り）：
// RNではWeb版のsignInWithPopupが使えず、expo-auth-session経由のOAuthフローか
// ネイティブGoogle Sign-In SDK（+ iOS URL scheme設定）が別途必要なため、
// 基盤（このPhase）が固まった後のフェーズで改めて対応する。

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

// 既存 login.html の translateAuthError と同じ仕様。
// エラーオブジェクト自体（code/message）はコンソールに出しても問題ないが、
// パスワードなどの入力値そのものは呼び出し側でログへ渡さないこと。
export function translateAuthError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "auth/invalid-email") return "メールアドレスの形式が正しくありません。";
  if (code === "auth/user-not-found") return "このメールアドレスのアカウントが見つかりません。";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (code === "auth/email-already-in-use") return "このメールアドレスは既に登録されています。ログインをお試しください。";
  if (code === "auth/weak-password") return "パスワードは6文字以上で設定してください。";
  if (code === "auth/too-many-requests") return "試行回数が多すぎます。しばらくしてからもう一度お試しください。";
  return "エラーが発生しました。もう一度お試しください。";
}
