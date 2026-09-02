#!/usr/bin/env node
/**
 * Cloudflare Pages (レガシーPagesプロジェクト) は、デプロイ時に
 * パスの途中に `node_modules` というフォルダ名を含む静的ファイルを
 * 自動的に無視してしまう(内部的なハードコードされた除外リストによる仕様で、
 * 現時点ではPages側にオーバーライド手段が提供されていない)。
 *
 * `npx expo export --platform web` の出力(dist/)には、
 * `@expo/vector-icons` が使うアイコン用フォントが
 *   dist/assets/node_modules/@expo/vector-icons/...
 * というパスに書き出されるため、このままCloudflare Pagesにデプロイすると
 * フォントファイルだけが配信されず(リクエストするとindex.htmlのSPA
 * フォールバックが200で返る)、マイクボタンなどのアイコンが表示されなくなる。
 *
 * このスクリプトは `expo export` の直後に実行し、
 *   dist/assets/node_modules/**  →  dist/assets/vendor/**
 * にディレクトリごとリネームしたうえで、ビルド済みJSバンドル内の
 * 参照パス文字列 "assets/node_modules/" を "assets/vendor/" に
 * 書き換える。GitHub Pages側はこの制約が無いため影響しない
 * (このスクリプトはCloudflare Pagesのビルドコマンドからのみ呼び出す想定)。
 */
const fs = require("fs");
const path = require("path");

const DIST_DIR = path.join(__dirname, "..", "dist");
const OLD_DIR = path.join(DIST_DIR, "assets", "node_modules");
const NEW_DIR = path.join(DIST_DIR, "assets", "vendor");
const OLD_URL_SEGMENT = "assets/node_modules/";
const NEW_URL_SEGMENT = "assets/vendor/";

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function main() {
  if (!fs.existsSync(DIST_DIR)) {
    console.log("[fix-cloudflare-pages-assets] dist/ が見つからないためスキップします。");
    return;
  }
  if (!fs.existsSync(OLD_DIR)) {
    console.log(
      "[fix-cloudflare-pages-assets] dist/assets/node_modules が無いためリネーム不要です(スキップ)。"
    );
    return;
  }

  fs.renameSync(OLD_DIR, NEW_DIR);
  console.log(
    `[fix-cloudflare-pages-assets] ${path.relative(process.cwd(), OLD_DIR)} を ${path.relative(
      process.cwd(),
      NEW_DIR
    )} にリネームしました。`
  );

  let patchedFiles = 0;
  for (const file of walk(DIST_DIR)) {
    // ビルド成果物(JS/HTML/JSON等)のみ対象。フォント等バイナリはスキップ。
    if (!/\.(js|html|json|css)$/i.test(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    if (!content.includes(OLD_URL_SEGMENT)) continue;
    const patched = content.split(OLD_URL_SEGMENT).join(NEW_URL_SEGMENT);
    fs.writeFileSync(file, patched, "utf8");
    patchedFiles += 1;
    console.log(`[fix-cloudflare-pages-assets] 参照パスを書き換え: ${path.relative(process.cwd(), file)}`);
  }

  if (patchedFiles === 0) {
    console.warn(
      "[fix-cloudflare-pages-assets] 警告: ディレクトリはリネームしましたが、参照パスを含むファイルが見つかりませんでした。"
    );
  }
}

main();
