import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, googleProvider } from "./firebase.js";

// 既存 login.html の各Firebase Auth呼び出しと同じ仕様。ログアウトは AuthContext 側の logout() が
// 既に唯一の窓口として使われているため、ここでは重複させない。
export function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(auth, email);
}

// 既存 login.html の translateAuthError と同じ仕様。
// エラーオブジェクト自体（code/message）はコンソールに出しても問題ないが、
// パスワードなどの入力値そのものは呼び出し側でログへ渡さないこと。
export function translateAuthError(error) {
  const code = error && error.code;
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
