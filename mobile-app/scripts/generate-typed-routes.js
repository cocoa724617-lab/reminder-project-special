#!/usr/bin/env node

/**
 * Expo Routerのtyped routes宣言ファイル（.expo/types/router.d.ts）を手動で再生成する。
 *
 * 通常このファイルは `expo start` の開発サーバーがファイル監視中に自動更新するが、
 * `expo export` では更新されない（Phase2で判明した既知の制限）。
 * app/ 配下に新しいルートファイルを追加した直後は、このスクリプトを実行してから
 * `npx tsc --noEmit` を実行しないと、router.push() 等の型チェックが古いルート一覧のまま失敗する。
 *
 * 使い方: node scripts/generate-typed-routes.js
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const appRoot = path.join(root, "app");
process.env.EXPO_ROUTER_APP_ROOT = appRoot;

const RequireContextPonyfill = require("expo-router/build/testing-library/require-context-ponyfill").default;
const { EXPO_ROUTER_CTX_IGNORE } = require("expo-router/_ctx-shared");
const { getTypedRoutesDeclarationFile } = require("expo-router/build/typed-routes/generate");

const ctx = RequireContextPonyfill(appRoot, true, EXPO_ROUTER_CTX_IGNORE);
const file = getTypedRoutesDeclarationFile(ctx, {});

const outputDir = path.join(root, ".expo", "types");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "router.d.ts"), file);

console.log("Regenerated .expo/types/router.d.ts");
