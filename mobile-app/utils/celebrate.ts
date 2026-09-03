import type { StatusDefinition } from "./user-status-utils";

// 既存 react-app/src/utils/celebrate.js のRN版。
// Web版はdocument.bodyへ直接トーストのDOMを追加する自己完結処理だったが、RNにはDOMが無いため、
// ここでは「発火して終わり」の薄い関数＋購読可能なイベントバスにし、実際の表示は
// components/celebration-toast.tsx（app/_layout.tsxにルート直下で1つだけマウントするグローバルな
// オーバーレイ）が購読して行う。呼び出し側の使い勝手はWeb版と同じ：celebrateCompletion(); と
// 1行呼ぶだけでよく、hookもcontextも呼び出し側では意識しなくてよい。
export type CelebrationEvent =
  | { type: "completion"; id: number; message: string }
  | { type: "discovery"; id: number; name: string; statusKey: string };

type Listener = (event: CelebrationEvent) => void;

const listeners = new Set<Listener>();
let nextId = 0;

// components/celebration-toast.tsx がマウント時に購読する。戻り値の関数がunsubscribe。
export function subscribeCelebrations(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: CelebrationEvent) {
  listeners.forEach((listener) => listener(event));
}

const COMPLETION_MESSAGES = ["おつかれ！", "ちゃんと終わらせたのすごい！", "一歩進んだね！"];

export function celebrateCompletion() {
  const message = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];
  emit({ type: "completion", id: nextId++, message });
}

// 新しいステータスを初めて発見した瞬間の演出。completionと同じイベントバス経由だが、
// ステータスの画像とステータス名を添えて少し長めに表示する（表示時間はcelebration-toast.tsx側で管理）。
export function celebrateStatusDiscovery(status: StatusDefinition | null | undefined) {
  if (!status) return;
  emit({ type: "discovery", id: nextId++, name: status.name || "", statusKey: status.key });
}
