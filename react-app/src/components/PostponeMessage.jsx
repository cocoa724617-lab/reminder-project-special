// 既存 atodeyaru.html の later-postpone-screen 上部（タスク名＋メッセージ＋「いつやるの？」）の表示部分。
// メッセージ本文の抽選は呼び出し側（PostponePage）が1回だけ行い、ここでは受け取った文字列を表示するだけにする。
function PostponeMessage({ taskTitle, message }) {
  return (
    <section className="atodeyaru-content" aria-labelledby="later-message">
      {taskTitle && <p className="atodeyaru-task-title">{taskTitle}</p>}
      <h1 id="later-message" className="atodeyaru-message">
        {message}
      </h1>
      <p className="atodeyaru-question">いつやるの？</p>
    </section>
  );
}

export default PostponeMessage;
