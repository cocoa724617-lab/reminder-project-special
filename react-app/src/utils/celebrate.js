// 既存 celebrate.js の verbatim 移植。
// document.body へ直接トーストを追加するだけの自己完結処理のため、React管理外のDOM操作として
// そのまま呼び出しても問題ない（React仮想DOMのツリーとは干渉しない）。
const COMPLETION_MESSAGES = ["おつかれ！", "ちゃんと終わらせたのすごい！", "一歩進んだね！"];

export function celebrateCompletion() {
  const message = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];

  const toast = document.createElement("div");
  toast.className = "completion-toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}
