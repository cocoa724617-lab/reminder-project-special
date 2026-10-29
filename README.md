# 先延ばし防止リマインダー

タスクを登録すると、指定した頻度でランダムなタイミングに通知が届くリマインダーアプリ。ただし通知を届けるだけでは先延ばしは減らないと気づき、「最初の一歩を促す」「継続状況・達成度を可視化する」「取り組みに応じてステータスが変わる」という3つの仕掛けで、実際の行動につながることを重視して作っている。「絶対に忘れたくないタスク」には、期限からの相対時間で必ず届く固定通知も設定できる。React製のインストール可能なPWAとして動作し、バックエンドにFirebaseを使用している。

## 主な機能

### タスク管理・通知
- タスク管理（タイトル・メモ・色ラベル・重要度・優先度）
- 期限設定（日付＋任意で時刻）と繰り返し（毎日／毎週／毎月／毎年）
- ランダム通知（1日／1週間あたりの回数を指定）＋期限からの相対時間で届く固定通知
- 通知を受け付ける時間帯・個別に止めたい時間帯の設定
- 通知のアクションボタンから、アプリを開かずに「完了」「1時間後」を操作可能

### 最初の一歩を促す仕掛け
- 「あとでやる」機能:時間を選ぶと、その時刻に「開くだけでもOKだよ！」という軽い文言で再通知が届く（完了を迫らず、まず開くことへのハードルを下げる設計）
- あとでやるを選んだ時の声かけメッセージを、厳しめ（いつやるの？）～優しめ（最初だけ開いてみよう！）から選べる
- 後回し回数の記録

### 継続状況・達成度の可視化
- 連続達成日数（ストリーク）の記録
- 完了履歴・直近の達成率などの実績確認
- 取り組み状況に応じて変化するステータスアイコン（全8種類）とその発見度

直近の「完了率」「後回し率」「タスクの登録ペース」から、毎回複数のステータスを判定している（実装: `react-app/src/utils/userStatusUtils.js` の `getUserStatusesFromStats`）。例えば下の3つはこういう基準で判定される。

| ステータス | 判定のイメージ |
|---|---|
| セルフマネジメントマスター | タスクをよく登録し、9割以上完了。後回しもほぼ無い |
| 先延ばし大魔神 | タスクの半分以上を後回しにしている |
| うっかり星人 | 完了率が3〜6割程度で、忘れがちな状態 |

| セルフマネジメントマスター | 先延ばし大魔神 | うっかり星人 |
|---|---|---|
| ![セルフマネジメントマスター](react-app/public/assets/status/self_management_master.png) | ![先延ばし大魔神](react-app/public/assets/status/procrastination_demon.png) | ![うっかり星人](react-app/public/assets/status/forgetful_alien.png) |

### 基盤
- Google／メールでのログイン
- PWA対応（iOS・Androidともにホーム画面に追加可能）

## 技術スタック

- フロントエンド: React 19 / Vite / React Router
- バックエンド: Firebase（Firestore, Authentication, Cloud Functions（v2, Node.js 24）, Cloud Messaging, Hosting）
- Firestoreセキュリティルールのテスト: Vitest + `@firebase/rules-unit-testing`（Firestoreエミュレータを使用、実行にはJavaが必要）

## ディレクトリ構成

```
react-app/               フロントエンド（React + Vite）
functions/                Cloud Functions（通知のスケジューリング・送信・クイック操作など）
firestore-tests/          Firestoreセキュリティルールのテスト（Vitest）
firestore.rules           Firestoreセキュリティルール
firestore.indexes.json    Firestore複合インデックス定義
firebase.json             Firebaseプロジェクト設定
```

## セットアップ

### 前提

- Node.js（Cloud FunctionsはNode.js 24系を想定）
- [Firebase CLI](https://firebase.google.com/docs/cli)（`npm install -g firebase-tools`）
- 自分のFirebaseプロジェクト（Firestore・Authentication（Email/Password・Google）・Cloud Messagingを有効化し、Blazeプラン（従量課金）にアップグレードしたもの。Cloud Functionsのスケジュール実行にBlazeプランが必須）

### 1. 依存パッケージのインストール

```bash
cd react-app && npm install
cd ../functions && npm install
```

### 2. Firebaseプロジェクトの設定値を反映

以下の4箇所を、自分のFirebaseプロジェクトの値に書き換える（`firebaseConfig`は「プロジェクトの設定 → マイアプリ」、VAPIDキーは「プロジェクトの設定 → Cloud Messaging」から取得）。

| ファイル | 内容 |
|---|---|
| `.firebaserc` | `default`プロジェクトID |
| `react-app/src/services/firebase.js` | `firebaseConfig` |
| `react-app/public/firebase-messaging-sw.js` | 同じ`firebaseConfig`（Service Workerは別ファイルのため二重に必要） |
| `react-app/src/services/fcmConfig.js` | Cloud Messagingの「ウェブ プッシュ証明書」（VAPIDキー） |

### 3. Firebase CLIの向き先を設定

```bash
firebase use <自分のプロジェクトID>
```

### 4. ローカルで起動

```bash
cd react-app
npm run dev
```

## デプロイ

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
cd react-app && npm run build && cd ..
firebase deploy --only hosting
```

## テスト

Firestoreセキュリティルールのテスト（Firestoreエミュレータを使用、実行にはJavaが必要）：

```bash
cd firestore-tests
npm install
firebase emulators:exec --only firestore "npm test"
```
