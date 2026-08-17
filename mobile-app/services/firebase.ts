import { initializeApp, getApps, getApp } from "firebase/app";
// firebase/auth の型定義は package.json の exports で "types" 条件が "react-native" 条件より
// 優先して解決されるため、実行時には存在する getReactNativePersistence が型定義上は見えない
// （Firebase SDK側の既知の制限。実装自体は動く）。
// 参照: https://github.com/firebase/firebase-js-sdk/issues/9316
// @ts-expect-error -- getReactNativePersistenceはランタイムには存在するが型定義に出てこないため
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// 既存 react-app/src/services/firebase.js と同じ Firebase プロジェクトに接続する設定値。
// 設定値を変更した場合は react-app 側（react-app/src/services/firebase.js）も合わせて更新すること。
const firebaseConfig = {
  apiKey: "AIzaSyDjcQkCw9YSqw2a-VC-jQgM1xxrE-IucB8",
  authDomain: "reminder-project-individual.firebaseapp.com",
  projectId: "reminder-project-individual",
  storageBucket: "reminder-project-individual.firebasestorage.app",
  messagingSenderId: "468795170434",
  appId: "1:468795170434:web:f7a1f644eca28ee5bcde9b",
  measurementId: "G-PZX19T6TTD",
};

// Fast Refresh でモジュールが再評価されても initializeApp を2回呼ばないようにする。
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Web版の getAuth() と異なり、React Nativeでは永続化ストレージを明示的に渡す必要がある
// （渡さない場合、ログイン状態がメモリ上にしか残らずアプリ再起動のたびにログアウトされる）。
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);
