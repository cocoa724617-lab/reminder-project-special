import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "../services/firebase";

// 既存 react-app/src/contexts/AuthContext.jsx + authContextObject.js + useAuth.js を
// 1ファイルにまとめたExpo版（Web版はVite Fast Refresh都合で3ファイルに分けていたが、
// Expo RouterのFast Refreshではこの分割は不要なため統合している）。
// Firebase Authentication の状態を全画面から参照できるようにするプロバイダー。
interface AuthContextValue {
  currentUser: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  function logout() {
    return signOut(auth);
  }

  const value: AuthContextValue = { currentUser, isLoading, logout };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth は AuthProvider の内側で使ってください");
  }
  return context;
}
