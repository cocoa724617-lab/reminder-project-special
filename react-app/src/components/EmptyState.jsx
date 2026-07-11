// 既存アプリの .task-list-empty をそのまま流用した、一覧が0件のときの共通表示。
function EmptyState({ children }) {
  return <p className="task-list-empty">{children}</p>;
}

export default EmptyState;
