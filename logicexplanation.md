ロジック説明
①通知システム全体の動きについて
https://claude.ai/artifact/UXodnBGRHRWN36Eb2Y8Bvh


②期限切れについて
https://claude.ai/artifact/8AW8Pm4Q7XAvo8HwvtwGNb (タスク状態判定の分岐)
https://claude.ai/artifact/EhXtyLt9NvN77UFmf7yM1z (バッチ通知スケジューリングの仕組み)
https://claude.ai/artifact/Ddin9LnQ6hAi1EPTDr1i3a (期限切れ通知の止め方)

現状:「期限が過去になっても、見た目も通知の挙動も変わらない」。これは別々の2つの仕組みに関係している。

■ 表示側(カードの見た目)との関係
- task.dueDateが過去かどうかを判定する処理が、クライアント側のどこにも存在しない
- 似た判定として、繰り返しタスクの「今回分は完了済み・次回待ち」を判定するgetRepeatCycleStatus(taskLabels.js)が既にある
  - これはHomePage.jsxとTaskListPage.jsxで食い違っていたのを、splitTasksByRepeatCycle()に集約して解消済み(DIARY.md参照)
  - 「期限切れ」の表示も同じ発想(クライアント側の純粋関数＋TaskCardでの表示分岐)で実装できるはず

■ 通知側(いつまで通知するか)との関係
functions/index.jsの3つの関数が関わっている。

- isChainableTask: 通知予約(reminders)を作ってよいかの判定。statusと頻度設定とenabledしか見ておらず、dueDateは見ていない
- regenerateTaskBatch: 実際に予約(kind: "batch")を作る。呼ばれた瞬間の時間帯を先に全部確定させるため、後から期限切れになっても後追いしない
- sendReminderNotifications: 1分ごとに送信。task.statusが完了済みかどうかしか見ておらず、isChainableTaskの判定結果や期限切れかどうかとは無関係に送ってしまう

■ 「期限切れなら通知を止める」を実装する場合の注意点
- 判定:「期限切れ(now > dueDateTime) かつ repeatが"none"」の時だけ止める
  - 繰り返し設定(repeat)があるタスクは対象外。完了すると次回のdueDateに進むだけなので、「期限切れ」はそもそも「今回分がまだ未完了」という意味しかない
- isChainableTaskだけ直しても不十分
  - 直せば「これから新しく作られる予約」は防げる(regenerateReminderSchedules・onTaskWrittenの両方に自動で効く)
  - しかし「既に作られてしまった今日の分」(朝の再生成でまとめて作られた、期限より後の時刻の予約)は残り続ける
- そのため①sendReminderNotifications(送信直前に残りの予約を削除)と②isChainableTask(今後新しく作らせない)の両方をセットで直す必要がある













まとめる必要がるもの
1. タスクの状態を決める仕組み(最優先)
今おっしゃった3つは実はこれ1つに絡み合っています。「タスクがどう見えるか」はほぼ全部、以下の掛け算で決まっています。

期限切れの扱い(未実装・バックログ):task.dueDateが過去かどうかを判定する処理が今はどこにも無い
繰り返しタスクの「今回分完了済み」判定:taskLabels.js のgetRepeatCycleStatus。lastCompletedAtと次回のdueDateだけで「次回まで待機中」を判定する、少しひねった仕組み
タスクカードの作られ方:TaskCard.jsxは3ページ共通だが、HomePage.jsxだけ別実装(前に指摘した重複)
両者が絡むのは、getRepeatCycleStatusの結果(cycleStatus)をTaskCardが受け取って表示を変えている(TaskCard.jsx:77-78)ため
この3つは1枚の図にまとめる価値が高いです(「期限切れ」の方針を決める時、カード表示・繰り返し判定の両方に影響するため)。

2. ステータス(セルフマネジメントマスター等)判定ロジック
前に説明したuserStatusUtils.js。completionRate/postponeRate/averageRegisteredTasksPerDayという3つの指標から7種類のステータスを判定する仕組み。単体で閉じているので、把握は1回で済みます(すでに説明済み)。

3. 完了・後回し・ストリークの三点セット
taskService.jsのcompleteTask/delayTaskWithLaterTime。これも地味に絡んでいます。

完了するとlaterCount(後回し回数)がリセットされる
繰り返しタスクは削除せずdueDateを次回に進めるだけ
ストリーク(computeNextStreak)は「日付」のみで判定、完了回数は見ない
4. 通知システム
→ 前回のartifactで既に整理済み。

5. 認証・Firestoreセキュリティルール
firestore.rules。ここは把握しておくと「なぜこの書き込みが失敗するのか」系のバグに強くなりますが、優先度は低めです(今まで問題になっていない)。

提案: 「1. タスクの状態を決める仕組み」が一番、複数ファイルに分散していて把握しづらい割に期限切れのバックログ対応で確実に触る部分なので、次に図解するならここが一番効果的だと思います。logicexplanation.mdに、まずこれを書いてみましょうか?




