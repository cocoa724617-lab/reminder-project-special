import type { PostponeMessageType } from "../types/task";

// 既存 react-app/src/utils/postponeMessages.js の verbatim 移植（TypeScript化のみ）。
export const POSTPONE_MESSAGE_TYPES: Record<PostponeMessageType, { label: string; messages: string[] }> = {
  gentle: {
    label: "優しい",
    messages: [
      "大丈夫。少し休んだらまた戻ってこよう",
      "無理しないで、できるときにやろうね",
      "休むのも大事。またあとで一緒にやろう",
    ],
  },
  normal: {
    label: "普通",
    messages: ["また今度やろう", "いつやるの？", "後でやる設定にしました"],
  },
  strict: {
    label: "厳しめ",
    messages: [
      "また後回しにしています。本当に後でやりますか？",
      "それ、いつまで後回しにするの？",
      "先延ばしグセ、そろそろ直そう",
    ],
  },
  cheer: {
    label: "応援",
    messages: ["大丈夫、次はできる！", "ファイト！戻ってきたら一緒に頑張ろう", "休んだら全力でいこう！"],
  },
};

export function pickPostponeMessage(type: PostponeMessageType | string | null | undefined): string {
  const entry = POSTPONE_MESSAGE_TYPES[type as PostponeMessageType] || POSTPONE_MESSAGE_TYPES.normal;
  const list = entry.messages;
  return list[Math.floor(Math.random() * list.length)];
}
