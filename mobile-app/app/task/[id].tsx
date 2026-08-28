import { useLocalSearchParams } from 'expo-router';

import TaskForm from '@/components/task-form';

// 既存 react-app/src/pages/TaskFormPage.jsx の「編集」ルート版（Web版の /tasks/new?id=... に相当）。
export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskForm editId={id} />;
}
