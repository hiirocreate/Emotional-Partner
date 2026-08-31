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

## 有料プラン(サブスクリプション)をセットアップする(任意)

「備え付けのAI」(この共有プロキシ経由の対話AI)と、アプリのVOICEVOX(端末にない読み上げボイス)機能は、有料プラン加入者だけが使える仕様になっています。管理者(あなた)自身は「管理者コード」を使うことで、課金なしで全機能を使えます。

この機能を使わず、誰でも無料で共有プロキシを使えるようにしたい場合は、このセクションはスキップして構いません(その場合、後述の管理者コードだけ設定しておけば、あなた自身は問題なく使えます。他の利用者は「自分のAPIキーを使う」モードのみ無料で使える形になります)。

### 全体の仕組み

1. アプリの各端末には、初回起動時に固有の「コード」が自動生成される(設定画面に表示)。
2. 利用者はこのコードを持って、あなたが用意したStripeの決済リンク(Payment Link)で決済する。決済時、このコードが `client_reference_id` としてStripe側に記録される。
3. 決済完了・更新・解約のたびに、StripeからこのWorkerへWebhook通知が届き、Cloudflare Workers KVにサブスク状態(有効/無効)が記録される。
4. アプリは設定画面の「状態を確認」ボタンで、そのコードのサブスク状態をこのWorkerに問い合わせる。
5. 「備え付けのAI」を使うリクエストにも同じコードが添付され、Worker側で有効なサブスク(または管理者コード)かどうかを毎回チェックする。

決済処理そのものはStripeに任せているため、このアプリ・Worker側では実際のクレジットカード情報等は一切扱いません。

### 手順

#### 1. KV(サブスク状態の保存先)を作成する

```bash
cd proxy-worker
npx wrangler kv namespace create SUBSCRIBERS
```

表示された `id = "xxxxxxxx..."` を、`wrangler.toml` の `[[kv_namespaces]]` ブロック内の `REPLACE_WITH_KV_ID` に書き換えてください。

#### 2. 管理者コードを決める

自分だけが知っている、推測されにくい文字列を決めてください(例: `admin-2026-xyz789` のようなもの)。

```bash
npx wrangler secret put ADMIN_CODE
```

このコードをアプリの設定画面の「あなたのコード」欄に入力し「状態を確認」を押せば、以降そのアプリでは課金なしで全機能が使えるようになります(このコードはビルドには一切埋め込まれず、サーバー側だけが知っているため、`X-App-Secret` よりも安全です)。

#### 3. Stripeで商品(サブスクリプション)と決済リンクを作る

1. [Stripeの無料アカウント](https://dashboard.stripe.com/register)を作成する(月額固定費なし。決済が発生した分だけ手数料がかかる従量課金)。
2. ダッシュボードの「商品カタログ」で新しい商品を作成し、価格を「継続課金(月額など)」に設定する。
3. その商品から「決済リンク(Payment Link)」を作成する。作成後に表示されるURL(`https://buy.stripe.com/xxxxx`)をメモする。
4. このリポジトリの `lib/config.ts` を開き、`BILLING_SUBSCRIBE_URL` にそのURLを設定する(アプリ側が自動で `?client_reference_id=...` を付け加えて開くので、URLはそのままでよい)。

#### 4. Stripe Webhookを設定する

1. Stripeダッシュボードの「開発者」→「Webhook」→「エンドポイントを追加」を開く。
2. エンドポイントURLに `https://kokorotalk-proxy.<あなたのサブドメイン>.workers.dev/v1/billing/webhook` を入力する。
3. リッスンするイベントとして、以下の3つを選択する:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. 作成後に表示される「署名シークレット(Signing secret、`whsec_...`)」をコピーし、Workerに設定する:
   ```bash
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```

#### 5. 再デプロイする

```bash
npx wrangler deploy
```

以降、Stripeで決済が完了すると自動的にKVへ反映され、アプリの「状態を確認」で有効になります。

### 動作確認のヒント

- Stripeダッシュボードの「開発者」→「Webhook」→ 該当エンドポイント の画面で、送信されたイベントとレスポンス(200が返っているか)を確認できます。
- テストモードのAPIキー・決済リンクで一通り動作確認してから、本番モードに切り替えることをおすすめします。
- `current_period_end`(サブスクの有効期限)は、Stripeの新しいAPIバージョン(2025年3月以降、通称「Basil」)ではサブスクリプション本体からsubscription item側に移動しています。このWorkerは両方のパターンに対応済みです。

## 呼び出せるモデルを増やしたい場合

`src/index.js` の `ALLOWED_MODELS` にモデルIDを追加し、アプリ側の `app/settings.tsx` の `PROXY_MODEL_PRESETS` にも対応する選択肢を追加してください(両方を一致させておかないと、アプリから送っても403/400で弾かれます)。

## 運用上の注意

- この構成は、開発者(あなた)のGroq無料枠を**全利用者で共有**します。利用者が増えるとレート制限に達しやすくなります。人数が増えてきた場合は、Groqの有料プランへの移行や、Cloudflare側の追加保護(Cloudflare Access等)の検討をおすすめします。
- `X-App-Secret` はアプリのビルドに埋め込まれるため、APKやWebのJSを解析すれば読み取れてしまいます。あくまで「無関係な自動スキャン・誤アクセスを減らす」程度のものと考えてください。
