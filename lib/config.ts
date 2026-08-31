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
export const SHARED_PROXY_BASE_URL = "https://kokorotalk-proxy.h-onoue-test.workers.dev/v1";

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
export const SHARED_PROXY_APP_SECRET = "kokorononakahanozokenai";

/** 共有プロキシが利用可能かどうか(値が設定されているか)を返す */
export function isSharedProxyConfigured(): boolean {
  return Boolean(SHARED_PROXY_BASE_URL && SHARED_PROXY_APP_SECRET);
}

/**
 * 有料プラン(サブスクリプション)の決済ページURL。
 * Stripeの「決済リンク(Payment Link)」を発行し、そのURLをそのまま設定してください
 * (`https://buy.stripe.com/xxxxx` の形式)。詳しい手順は proxy-worker/README.md を参照。
 *
 * アプリ側はこのURLの末尾に `?client_reference_id=<この端末のコード>` を自動的に
 * 付け加えて開くため、ここには素のPayment LinkのURLだけを設定すればよい。
 */
export const BILLING_SUBSCRIBE_URL = "https://buy.stripe.com/test_fZufZhaZu0dHbCXdM8dUY00";

/** 有料プランの決済リンクが設定済みかどうか */
export function isBillingConfigured(): boolean {
  return Boolean(BILLING_SUBSCRIBE_URL);
}


/**
 * アプリ配布者(開発者)が管理する共有VOICEVOXサーバーのURL。
 *
 * 「備え付けのAI」と同じ考え方で、有料プラン加入者(または管理者)が
 * 自分でVOICEVOXサーバーを用意しなくても使えるようにするための仕組み。
 * 有料プラン加入者(または管理者)が設定画面でVOICEVOXへの接続先を
 * まだ何も設定していない場合、このURLへ自動的に接続されます。
 * (自分専用のVOICEVOXサーバーを使いたい人は、設定画面で個別に上書きできます)
 */
export const SHARED_VOICEVOX_URL = "https://8.235.85.246.nip.io";

/** 共有VOICEVOXサーバーが設定済みかどうか */
export function isSharedVoicevoxConfigured(): boolean {
  return Boolean(SHARED_VOICEVOX_URL);
}
