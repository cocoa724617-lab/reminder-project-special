import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 既存の firebase-init.js と同じ Firebase プロジェクトに接続する設定値。
// 元ファイルは CDN の URL import だが、react-app は npm パッケージ (firebase) を
// 使うため、設定値だけをそのままコピーしている。元ファイルは変更しない。
// firebase-init.js 側の設定値を変更した場合は、こちらも合わせて更新すること。
const firebaseConfig = {
  apiKey: "AIzaSyDjcQkCw9YSqw2a-VC-jQgM1xxrE-IucB8",
  authDomain: "reminder-project-individual.firebaseapp.com",
  projectId: "reminder-project-individual",
  storageBucket: "reminder-project-individual.firebasestorage.app",
  messagingSenderId: "468795170434",
  appId: "1:468795170434:web:f7a1f644eca28ee5bcde9b",
  measurementId: "G-PZX19T6TTD",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
