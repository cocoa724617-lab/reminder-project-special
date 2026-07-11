import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import HomePage from "./pages/HomePage.jsx";
import TaskListPage from "./pages/TaskListPage.jsx";
import TaskFormPage from "./pages/TaskFormPage.jsx";
import StatsPage from "./pages/StatsPage.jsx";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/tasks" element={<TaskListPage />} />
        <Route path="/tasks/new" element={<TaskFormPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
