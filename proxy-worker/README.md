# こころトーク 共有プロキシ (proxy-worker)

アプリの利用者がGroqのAPIキーを各自発行しなくても対話AIを使えるようにするための、Cloudflare Workers製の小さな中継サーバーです。無料枠(1日10万リクエストまで)で運用できます。

やっていることはシンプルです: アプリからの「対話してほしい」というリクエストを受け取り、`X-App-Secret` ヘッダーで簡易チェックした上で、開発者(あなた)のGroq APIキーを使ってGroqに転送し、その返答(ストリーミング含む)をそのままアプリへ返します。利用者側の端末にはGroqのAPIキーは一切渡りません。

## デプロイ手順(初回のみ)

### 1. Cloudflareの無料アカウントを作成

まだアカウントがなければ [dash.cloudflare.com](https://dash.cloudflare.com/sign-up) で作成してください。

### 2. Wrangler(CLI)をセットアップ

```bash
cd proxy-worker
npm install
npx wrangler login
```

ブラウザが開くのでCloudflareアカウントでログインしてください。

### 3. シークレットを設定

```bash
# Groqで発行したAPIキー(gsk_...)
npx wrangler secret put GROQ_API_KEY

# アプリ側と一致させる共有シークレット(ランダムな文字列を自分で決めてください)
npx wrangler secret put APP_SHARED_SECRET
```

### 4. デプロイ

```bash
npx wrangler deploy
```

成功すると `https://kokorotalk-proxy.<あなたのサブドメイン>.workers.dev` のようなURLが表示されます。これをメモしてください。

> `wrangler.toml` の `[[ratelimits]]` ブロックがCloudflareのプランの都合でデプロイエラーになる場合は、そのブロックを削除して再度 `npx wrangler deploy` してください(レート制限機能だけが無効になり、他は問題なく動作します)。

### 5. アプリ側に接続情報を設定

このリポジトリの `lib/config.ts` を開き、以下の2つを手順4・3で決めた値に書き換えてください。

```ts
export const SHARED_PROXY_BASE_URL = "https://kokorotalk-proxy.<あなたのサブドメイン>.workers.dev/v1";
export const SHARED_PROXY_APP_SECRET = "<手順3で決めた共有シークレット>";
```

書き換えたら、通常どおりアプリをビルド(`npm run web` / APKビルド等)すれば、利用者はAPIキー入力なしで対話AIを使えるようになります。

## 動作確認

```bash
curl -N https://kokorotalk-proxy.<あなたのサブドメイン>.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-App-Secret: <手順3で決めた共有シークレット>" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role":"user","content":"こんにちは"}],
    "stream": true
  }'
```

ストリーミングでテキストが返ってくれば成功です。

## 呼び出せるモデルを増やしたい場合

`src/index.js` の `ALLOWED_MODELS` にモデルIDを追加し、アプリ側の `app/settings.tsx` の `PROXY_MODEL_PRESETS` にも対応する選択肢を追加してください(両方を一致させておかないと、アプリから送っても403/400で弾かれます)。

## 運用上の注意

- この構成は、開発者(あなた)のGroq無料枠を**全利用者で共有**します。利用者が増えるとレート制限に達しやすくなります。人数が増えてきた場合は、Groqの有料プランへの移行や、Cloudflare側の追加保護(Cloudflare Access等)の検討をおすすめします。
- `X-App-Secret` はアプリのビルドに埋め込まれるため、APKやWebのJSを解析すれば読み取れてしまいます。あくまで「無関係な自動スキャン・誤アクセスを減らす」程度のものと考えてください。
