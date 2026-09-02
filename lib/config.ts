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
export const SHARED_PROXY_BASE_URL = "https://kokorotalk-proxy.h-onoue-test.workers.dev/";

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
 * アプリ側はこのURLの末尾に `?prefilled_email=<連携中のGoogleアカウントのメール>` を
 * 自動的に付け加えて開くため、ここには素のPayment LinkのURLだけを設定すればよい。
 * 加入・状態確認はGoogleアカウント連携(google.connected)が前提になる。
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
 * voicevox-server/README.md の手順でホスティングしたVOICEVOX ENGINEの
 * HTTPS URLをここに設定してください(例: https://your-name.duckdns.org)。
 *
 * 有料プラン加入者(または管理者)が設定画面でVOICEVOXへの接続先を
 * まだ何も設定していない場合、このURLへ自動的に接続されます。
 * (自分専用のVOICEVOXサーバーを使いたい人は、設定画面で個別に上書きできます)
 */
export const SHARED_VOICEVOX_URL = "";

/** 共有VOICEVOXサーバーが設定済みかどうか */
export function isSharedVoicevoxConfigured(): boolean {
  return Boolean(SHARED_VOICEVOX_URL);
}

/**
 * Googleアカウント連携(履歴・記憶の同期、README「7.」参照)の設定。
 *
 * Google Cloud ConsoleでOAuthクライアントを2つ作成し、それぞれのクライアントIDを
 * ここに設定してください:
 *
 * - GOOGLE_WEB_CLIENT_ID: 種類「ウェブ アプリケーション」のクライアントID。
 *   Web版のログイン(lib/googleAuth.web.ts, PKCE方式)と、Android版の
 *   `GoogleSignin.configure({ webClientId })` の両方で使う共通の値。
 * - Android版はこのクライアントIDに加えて、種類「Android」のOAuthクライアントを
 *   作成し、パッケージ名(com.example.kokorotalk)とSHA-1証明書フィンガープリントを
 *   登録しておく必要があります(コード上に直接設定する値はありません。
 *   Google Play servicesがビルドの署名から自動判定します)。
 */
export const GOOGLE_WEB_CLIENT_ID = "76724605537-3rcnirg8hvksdcut1u8iopcb77o6h6v7.apps.googleusercontent.com";

/**
 * 上記「ウェブ アプリケーション」クライアントに発行されるクライアントシークレット。
 * Web版のログイン(lib/googleAuth.web.ts)でのみ使用する(Android版はネイティブの
 * Google Sign-Inライブラリが別方式で認証するため使わない)。
 *
 * 注意: GoogleのOAuthは「ウェブ アプリケーション」種別のクライアントである限り、
 * PKCEを使っていてもトークン交換時にこのシークレットを要求してくる仕様になっています
 * (2026年時点、Googleの公式な仕様上の制約)。そのためこの値はアプリのWebビルドに
 * 埋め込まれ、本当の意味での秘密情報にはなりません
 * (SHARED_PROXY_APP_SECRETと同様の考え方です)。この値の漏洩で悪用できるのは
 * 「このアプリのふりをしてOAuth認可画面を表示させる」程度で、他人のGoogle
 * アカウントのデータには(利用者本人の同意なしには)アクセスできません。
 */
export const GOOGLE_WEB_CLIENT_SECRET = "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";

/** Googleアカウント連携が設定済みかどうか */
export function isGoogleSyncConfigured(): boolean {
  return Boolean(GOOGLE_WEB_CLIENT_ID);
}

/**
 * Googleドライブに要求するOAuthスコープ。
 * `drive.appdata` は「このアプリ専用の非公開領域」のみへのアクセス権で、
 * 利用者の通常のドライブ内ファイルには一切触れられない(Googleの審査区分でも
 * 「機密性の低いスコープ」扱いで、追加のセキュリティ審査(CASA)は不要)。
 */
export const GOOGLE_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.appdata"];
