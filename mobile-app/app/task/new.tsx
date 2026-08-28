import TaskForm from '@/components/task-form';

// 既存 react-app/src/pages/TaskFormPage.jsx の「新規作成」ルート版。
// editIdを渡さない静的ルートにすることで、useTask("new") のような不正なFirestore参照を避けている。
export default function NewTaskScreen() {
  return <TaskForm />;
}
