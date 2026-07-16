import { useEffect, useState } from "react";

// getRepeatCycleStatus（繰り返しタスクの「次回期限が来たら未完了に戻す」判定）はnew Date()を
// 都度評価するだけなので、タスク一覧がFirestoreの変更で再レンダーされない限り、次回期限の時刻を
// またいでも自動では未完了側へ移らない。一定間隔でこの値を更新し、呼び出し側を再レンダーさせることで
// ページを開きっぱなしのままでも正しいタイミングで切り替わるようにする。
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
