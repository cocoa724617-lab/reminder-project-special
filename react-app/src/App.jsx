import { Routes, Route } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import HomePage from "./pages/HomePage.jsx";
import TaskListPage from "./pages/TaskListPage.jsx";
import TaskFormPage from "./pages/TaskFormPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";

function App() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <p className="auth-loading">読み込み中</p>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tasks" element={<TaskListPage />} />
          <Route path="/tasks/new" element={<TaskFormPage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
