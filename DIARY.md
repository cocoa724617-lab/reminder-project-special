# 開発日記

「日記に残して」と言われた時にここへ追記する。新しい記録が上。

---

## 2026-11-01

### 期限切れタスクの通知を止める(B案)を実装

- 一回きり(繰り返し無し)のタスクが期限切れになっても、バッチ通知(頻度指定のランダム通知)が延々届き続けていた不具合を解消
- 修正は2箇所セットで実装(片方だけでは当日分を防げないため)
  - `isChainableTask`に`isTaskOverdue`判定を追加。期限切れ+繰り返し無しのタスクを通知対象外にし、`onTaskWritten`・`regenerateReminderSchedules`の両方で「今後新しく予約を作らせない」を実現
  - `sendReminderNotifications`に、期限切れ後の送信時に残っている同タスクの未通知batch予約を削除する処理を追加(「それっきりにする」)
- 繰り返し設定があるタスクは対象外（完了すると次回のdueDateに進むだけなので、期限切れの概念がそもそも当てはまらない）
- A案(タスクカードの見た目で期限切れを示す)はまだ未着手。BACKLOG.mdに次の項目として残した
- Cloud Functions 3つ(`onTaskWritten`/`regenerateReminderSchedules`/`sendReminderNotifications`)をデプロイ済み

### 変更ファイル
- `functions/index.js`

---

## 2026-10-27(2)

### isRepeatingTaskの重複を解消

- `taskLabels.js`と`taskService.js`の両方に、ほぼ同じ内容(`repeat`が`"none"`以外かどうか)の`isRepeatingTask`が別々に定義されていた
- `taskService.js`側の独自定義を削除し、`taskLabels.js`のものを`import`する形に統一
- ビルド・Hostingデプロイ済み

### 変更ファイル
- `react-app/src/services/taskService.js`

---

## 2026-10-27

### タスクカードの「次回待ち」表示を統一

- 繰り返しタスクが今回分を完了した時の表示(`cycleStatus`)が、HomePage.jsxとTaskListPage.jsxで食い違っていた
  - HomePage:該当タスクを一覧から丸ごと除外(次回情報も消える)
  - TaskListPage:「完了済み」セクションへ回し、「次回：〜」ピル付きで表示
  - 原因はHomePageがTaskCard.jsxを使わず独自にカードを組んでいて、この分岐自体を知らなかったこと
- `taskLabels.js`に`splitTasksByRepeatCycle()`を追加し、判定ロジックを1箇所に集約
  - `pending`(今やるべきもの)と`waiting`(次回待ち、cycleStatus付き)に分けて返す
  - HomePage/TaskListPageの両方をこの関数経由に書き換え
- HomePageに「次回まで完了済み」セクションを新設し、TaskCardと同じ「次回：〜」表示に揃えた
- `react-app`をビルドしてHostingにデプロイ済み

### 変更ファイル
- `react-app/src/utils/taskLabels.js`
- `react-app/src/pages/HomePage.jsx`
- `react-app/src/pages/TaskListPage.jsx`
