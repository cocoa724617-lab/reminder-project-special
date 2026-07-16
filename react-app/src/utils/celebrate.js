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

// 新しいステータスを初めて発見した瞬間の演出。completionToastと同じトースト方式だが、
// ステータスの画像とステータス名を添えて少し長めに表示する。
export function celebrateStatusDiscovery(status) {
  if (!status) return;

  const toast = document.createElement("div");
  toast.className = "status-discovery-toast";

  if (status.image) {
    const image = document.createElement("img");
    image.className = "status-discovery-toast-image";
    image.src = status.image;
    image.alt = "";
    image.onerror = () => image.remove();
    toast.appendChild(image);
  }

  const body = document.createElement("div");
  body.className = "status-discovery-toast-body";

  const label = document.createElement("span");
  label.className = "status-discovery-toast-label";
  label.textContent = "新しいステータスを発見！";
  body.appendChild(label);

  const name = document.createElement("span");
  name.className = "status-discovery-toast-name";
  name.textContent = status.name || "";
  body.appendChild(name);

  toast.appendChild(body);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}
