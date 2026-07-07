const COMPLETION_MESSAGES = ['おつかれ！', 'ちゃんと終わらせたのすごい！', '一歩進んだね！'];

// タスク完了時に、画面下部へ小さな達成メッセージを一瞬だけ表示する
export function celebrateCompletion() {
  const message = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];

  const toast = document.createElement('div');
  toast.className = 'completion-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('is-visible'));

  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}
