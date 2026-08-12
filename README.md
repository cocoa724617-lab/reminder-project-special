# ランダム通知リマインダー

タスクを登録すると、指定した頻度でランダムなタイミングに通知が届くリマインダーアプリ。「絶対に忘れたくないタスク」には、期限からの相対時間で必ず届く固定通知も設定できる。React製のインストール可能なPWAとして動作し、バックエンドにFirebaseを使用している。

## 主な機能

- タスク管理（タイトル・メモ・色ラベル・重要度・優先度）
- 期限設定（日付＋任意で時刻）と繰り返し（毎日／毎週／毎月／毎年）
- ランダム通知（1日／1週間あたりの回数を指定）＋期限からの相対時間で届く固定通知
- 通知を受け付ける時間帯・個別に止めたい時間帯の設定
- 通知のアクションボタンから、アプリを開かずに「完了」「1時間後」を操作可能
- 「あとでやる」機能と後回し回数の記録
- 連続達成日数（ストリーク）の記録
- 完了履歴・直近の達成率などの実績確認
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
