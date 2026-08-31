/**
 * アプリ配布者(開発者)が管理する共有プロキシの接続情報。
 *
 * 「AI連携を簡単にする」ための仕組み: 利用者が各自でAPIキーを発行しなくても
 * 対話AIを使えるように、開発者自身のGroq APIキーをCloudflare Workers上の
 * 小さな中継サーバー(プロキシ)にだけ保持させ、アプリはそのプロキシを叩く。
 * デプロイ方法は proxy-worker/README.md を参照。
 *
 * デプロイ後、以下の2つの値をデプロイ結果に合わせて書き換えてから
 * アプリをビルド(APK/Web公開)してください。
 */

/** Cloudflare Workersのデプロイ先URL。例: https://kokorotalk-proxy.your-name.workers.dev/v1 */
export const SHARED_PROXY_BASE_URL = "";

/**
 * プロキシへのアクセスを軽くゲートするための共有シークレット。
 * proxy-worker 側で `wrangler secret put APP_SHARED_SECRET` に設定した値と
 * 同じ文字列をここに設定してください。
 *
 * 注意: これはアプリのビルドに埋め込まれるため、本当の意味での秘密情報には
 * なりません(APKやWebのJSを解析すれば読み取れます)。あくまで「無関係な
 * ボットや検索エンジンによる誤アクセスを防ぐ」程度の軽いゲートです。
 * 悪用が心配な場合は、後述のレート制限(Cloudflare Workers Rate Limiting)を
 * あわせて設定してください。
 */
export const SHARED_PROXY_APP_SECRET = "";

/** 共有プロキシが利用可能かどうか(値が設定されているか)を返す */
export function isSharedProxyConfigured(): boolean {
  return Boolean(SHARED_PROXY_BASE_URL && SHARED_PROXY_APP_SECRET);
}
