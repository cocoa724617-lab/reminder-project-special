# 開発日記

「日記に残して」と言われた時にここへ追記する。新しい記録が上。

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
