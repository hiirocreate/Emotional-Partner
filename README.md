# こころトーク（テスト版）

相談用（メンタルケア用）音声AIアプリのプロトタイプです。React Native (Expo) 製で、**同じコードから Web版とAndroid(APK)版の両方**をビルドできます。すべて無料枠のツールのみで構成しています。

> ⚠️ **注意事項**
> このアプリはテスト段階のプロトタイプであり、医療行為・診断・治療の代わりにはなりません。

## できること

- **リアルタイム音声入力**: マイクボタンを押すと、話した内容をリアルタイムでテキスト化します（Web: ブラウザ標準のSpeech API／アプリ: OS内蔵の音声認識。いずれも無料・追加登録不要）。
- **テキストでも相談可能**: マイクが使えない環境でも、通常のチャット入力で相談できます。
- **入出力の相互変換**: 「音声で相談してテキストで返答を受け取る」「テキストで相談して音声で返答を受け取る」のどちらも可能です（設定画面の「自動読み上げ」トグル、または返答の🔊ボタンから）。
- **ストリーミング応答**: AIの返答は生成され次第リアルタイムに画面へ表示されます。返答が全部揃うまで待つ必要がなく、体感速度が大きく向上します。
- **読み上げボイスを選択式で切り替え**: 「端末/ブラウザ内蔵ボイス」と「VOICEVOX（無料の日本語キャラクターボイスエンジン）」の2系統から選べます。声質・キャラクター性を重視するならVOICEVOXがおすすめです（セットアップ方法は下記）。
- **AIの立場（ペルソナ）をユーザーごとに設定可能**: 「友だちのように」「兄・姉のように」「傾聴カウンセラーのように」などのプリセットに加え、自由記述でオリジナルの立場を設定できます。
- **AI連携はAPIキー入力なしですぐ使える**: 開発者が用意した共有プロキシ経由で対話AIに接続する設計のため、利用者は各自でAPIキーを発行・入力する必要がありません（有料プラン加入者向け機能。詳細は下記）。
- **自分専用のAPI連携もワンタップで設定可能**: 共有プロキシを使わず自分専用の環境で使いたい場合は、「自分のAPIキーを使う」に切り替えた上で、[OpenRouter](https://openrouter.ai)ならログインボタン一つでAPIキーの発行・入力なしに接続できます（OAuthログイン）。Groqの場合もキー作成ページを直接開くボタンとクリップボード貼り付けボタンで、コピー＆ペーストの手間だけで済みます。こちらは有料プランに関係なく無料でお使いいただけます。
- **有料プラン(サブスクリプション)と管理者コード**: 「備え付けのAI」(共有プロキシ)とVOICEVOX(端末にない読み上げボイス)は有料プラン加入者向けの機能です。Stripeでの決済リンクにより継続課金を受け付けられます。アプリ配布者(管理者)は管理者コードを設定画面に入力することで、課金なしで全機能を使えます。「自分のAPIキーを使う」モードと端末内蔵ボイスはプランに関係なく無料です。

## 相談窓口の案内について（設計方針）

このアプリでは、AIが「いのちの電話」等の相談窓口を機械的に案内する仕組みは搭載していません。定型文の差し込みは、かえって相手を突き放す印象を与えたり、AIとの対話そのものへの信頼を損なう場合があるためです。

システムプロンプトには、相手が「今この瞬間、具体的な方法で自分を傷つけようとしている」ことを明確に語った場合に限り、その言葉から目をそらさずAI自身の言葉で心配を伝えるよう指示する一文だけを残しています（相談窓口の案内やホットライン番号の提示は指示していません）。これも不要であれば `lib/personas.ts` の `buildSystemPrompt` 関数内、「唯一の例外として」から始まる1文を削除すれば完全に取り除けます。

## 使っている無料ツール

| 用途 | 使用技術 | 料金 |
|---|---|---|
| アプリの土台 | Expo (React Native) + expo-router | 無料 (OSS) |
| 音声認識 (STT) | `expo-speech-recognition`（Web: ブラウザ標準 SpeechRecognition API／Android・iOS: OS内蔵音声認識） | 無料・登録不要 |
| 音声合成 (TTS) ①端末内蔵 | Web: ブラウザ標準 SpeechSynthesis API／Native: `expo-speech`（OS内蔵） | 無料・登録不要 |
| 音声合成 (TTS) ②VOICEVOX | [VOICEVOX ENGINE](https://github.com/VOICEVOX/voicevox_engine)（OSS）を [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) VM上でDocker常時稼働 + Caddyで自動HTTPS化 | 無料（Always Free枠、期間の定めなし） |
| 対話生成AI (LLM) 中継 | [Cloudflare Workers](https://workers.cloudflare.com/)（`proxy-worker/`）で共有プロキシを構築し、開発者のAPIキーを1箇所に集約 | 無料枠（1日10万リクエストまで） |
| 対話生成AI (LLM) 本体 | デフォルトは [Groq](https://console.groq.com)（無料枠あり・高速）。プロキシを介さず [OpenRouter](https://openrouter.ai) 等の無料モデルへ直接切替も可 | 無料枠あり |
| 課金(サブスクリプション) | [Stripe](https://stripe.com) の決済リンク(Payment Link)。サブスク状態はCloudflare Workers KVで管理 | 月額固定費なし(決済額に応じた手数料のみ) |
| データ保存 | 端末内 `AsyncStorage`（サーバー不要） | 無料 |
| APKビルド・Web公開 | GitHub Actions + GitHub Pages | 無料枠あり |

会話内容や設定は**端末内のみ**に保存されます。対話AIへの問い合わせ時のみ、共有プロキシ(または利用者が指定した接続先)にメッセージ内容が送信されます。共有プロキシ自体は開発者のAPIキーを保持するだけで、会話内容を保存・記録する処理は行っていません。

## セットアップ手順

### 1. 依存パッケージのインストール

```bash
npm install --legacy-peer-deps
```

### 2. ローカルで起動して試す

```bash
# Webブラウザで試す(最も手軽)
npm run web

# スマホの Expo Go アプリで試す場合
npm start
```

> VOICEVOXやマイク機能はExpo Goでは一部制限されることがあります。フル機能を試す場合は `npx expo prebuild` の上でネイティブビルド（`npx expo run:android` など）を推奨します。

### 3. 対話AI(共有プロキシ)をセットアップする

このアプリはデフォルトで、開発者(配布者であるあなた)が用意する**共有プロキシ**経由で対話AIに接続します。この方式にすることで、利用者は各自でAPIキーを発行・入力しなくてもすぐアプリを使い始められます。

セットアップは最初の1回だけです。`proxy-worker/` フォルダに手順をまとめています(概要):

1. [Groq](https://console.groq.com) の無料アカウントでAPIキーを発行する
2. [Cloudflareの無料アカウント](https://dash.cloudflare.com/sign-up)を作成する
3. `cd proxy-worker && npm install && npx wrangler login`
4. `npx wrangler secret put GROQ_API_KEY` / `npx wrangler secret put APP_SHARED_SECRET` でキーを設定
5. `npx wrangler deploy` でデプロイし、発行されたURLを控える
6. `lib/config.ts` の `SHARED_PROXY_BASE_URL` / `SHARED_PROXY_APP_SECRET` を書き換えてアプリをビルドし直す

詳しい手順・料金・注意点は **[proxy-worker/README.md](./proxy-worker/README.md)** を参照してください。

設定画面には速度重視・精度重視の2プリセットを用意しています。

- **高速重視**: `llama-3.1-8b-instant`（参考値: 500〜600トークン/秒。日常会話向け）
- **精度重視**: `llama-3.3-70b-versatile`（応答はやや遅くなりますが、文脈理解や表現力が向上）

Groqは無料枠の対象モデルが変更されることがあります。うまく繋がらない場合は [console.groq.com/docs/models](https://console.groq.com/docs/models) で現在利用可能なモデルIDを確認し、`proxy-worker/src/index.js` の `ALLOWED_MODELS` と `app/settings.tsx` の `PROXY_MODEL_PRESETS` を書き換えてください。

#### 有料プラン(サブスクリプション)を設定する場合

「備え付けのAI」とVOICEVOXは有料プラン加入者向けの機能として実装されています。Stripeでの決済リンクの作成、Cloudflare Workers KVでのサブスク状態管理、管理者コードの設定などの手順は **[proxy-worker/README.md](./proxy-worker/README.md)** の「有料プラン(サブスクリプション)をセットアップする」の章にまとめています。

この設定を行わない場合でも、管理者コード(`ADMIN_CODE`)だけ設定しておけば、あなた自身は課金なしで全機能を使えます。他の利用者への課金導線が不要な場合は、Stripe連携そのものを省略しても構いません。

#### プロキシを使わず、自分のAPIキーで直接使いたい場合

設定画面の対話AI欄で「自分のAPIキーを使う」に切り替えれば、共有プロキシを経由せず [Groq](https://console.groq.com) や [OpenRouter](https://openrouter.ai) に直接接続できます。共有プロキシが混み合っている時や、動作確認だけしたい場合に便利です。

**個々の利用者が、自分専用のAPIキーを手間なく用意できるように**、この切り替え画面に「かんたん接続」欄を用意しています。

- **OpenRouterの場合**: 「🔗 OpenRouterでログインして接続」ボタンを押すだけで、ブラウザでOpenRouterのログイン画面(OAuth・PKCE方式)が開きます。ログイン(未登録なら新規登録)して許可すると、APIキーの発行・コピー・貼り付けを一切せずにこの端末へ自動設定されます。裏側の実装は `lib/openrouterOAuth.ts` と、リダイレクト先となる `app/oauth/openrouter.tsx` です。
- **Groqの場合**: Groqには2026年8月時点で同種のOAuth連携が無いため、「🌐 Groqのキー作成ページを開く」ボタンでキー発行ページを直接開き、発行したキーをコピーした状態で「📋 クリップボードから貼り付け」ボタンを押すだけで設定できるようにしています(手入力よりも間違いが起きにくくなります)。

いずれの方法で設定したAPIキーも、共有プロキシと同じく**端末内にのみ保存**され、外部のサーバーには送信されません。

### 4. VOICEVOXで読み上げボイスを増やす（任意）

VOICEVOXは無料・オープンソースの日本語音声合成エンジンで、ずんだもんや四国めたんなど個性豊かなキャラクターボイスを多数収録しています。ペルソナ設定と組み合わせて「兄っぽい声」「友だちっぽい声」のように使い分けると相性が良いです。

自分の環境でVOICEVOX ENGINEを立てて、アプリの設定画面にそのURLを入力するだけで使えます。用途に応じて2つの構成を用意しました。

#### お試し用: 自分のPCでDockerを使って動かす（一番簡単・動作確認向け）

```bash
docker run --rm -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

起動後、`http://<PCのIPアドレス>:50021` をスマホ/ブラウザ側のVOICEVOX設定に入力してください（スマホとPCが同じWi-Fiに接続されている必要があります）。動作確認は `http://127.0.0.1:50021/docs` で行えます。PCを閉じると使えなくなるので、あくまで動作確認用です。

#### 推奨構成: スリープなし・場所を問わず使える常時稼働サーバー

「PCをつけっぱなしにしない」「スリープ復帰の遅延なしにいつでも使う」を両立するには、**本当に常時稼働する無料クラウドVM**の上でVOICEVOX ENGINEを24時間動かすのが最も確実です。Render/Fly.ioなどのPaaS系無料枠は一定時間アクセスがないと自動スリープする仕様のため、この用途には不向きです(スリープ復帰時に数十秒待たされます)。

そこでおすすめなのが **Oracle Cloud Infrastructure(OCI)の "Always Free" VM** です。他社の「無料トライアル(期間限定)」とは異なり、Always Freeは期間の定めなく無料で使い続けられるVM(Ampere A1, 2026年時点で 2 OCPU / 12GB RAM まで無料)で、PaaSのようなアイドル時のスリープが存在しません。VOICEVOX ENGINEを動かすには十分なスペックです。

このリポジトリの `voicevox-server/` フォルダに、VOICEVOX ENGINEを常時稼働かつHTTPS公開するための `docker-compose.yml` と `Caddyfile`(自動HTTPS化のリバースプロキシ設定)を同梱しています。

**手順の概要:**

1. **Oracle Cloudの無料アカウントを作成**し、コンソールから Always Free 対象の Ampere A1 インスタンス(Ubuntuイメージ推奨)を作成する。登録時にクレジットカードの本人確認が必要ですが、Always Free枠の範囲内では課金されません。
   - まれに人気リージョンで「空き容量不足」エラーが出ることがあります。その場合はリージョンや可用性ドメインを変えて再試行してください。
   - 作成時に「予約済みパブリックIP」を1つ割り当てておくと、再起動してもIPアドレスが変わらず後述のDNS設定が安定します。
2. インスタンスの **セキュリティリスト/ネットワークセキュリティグループ** と、Ubuntu内の **ufw/iptables** の両方で、80番・443番ポートへのインバウンド通信を許可する(OCIのUbuntuイメージはデフォルトでSSH以外をブロックしているため、両方の設定が必要な点に注意)。
3. [DuckDNS](https://www.duckdns.org/) などの無料DDNSサービスで `やりたい名前.duckdns.org` の形の無料サブドメインを取得し、手順1の予約済みIPをAレコードとして設定する(IPが固定なので自動更新の仕組みは不要)。
4. インスタンスにSSH接続し、Docker と Docker Compose をインストール。
5. このリポジトリの `voicevox-server/` フォルダをインスタンスにコピーし、`.env.example` を `.env` にコピーして `DUCKDNS_DOMAIN` を手順3のドメインに書き換える。
6. 起動する:
   ```bash
   cd voicevox-server
   docker compose up -d
   ```
   Caddyが自動でLet's Encryptの証明書を取得し、`https://やりたい名前.duckdns.org` でVOICEVOX ENGINEにHTTPS経由でアクセスできるようになります(`restart: always` により、VM再起動時も自動的に立ち上がります)。
7. アプリの設定画面のVOICEVOX URLに `https://やりたい名前.duckdns.org` を入力すれば完了です。

> **なぜHTTPS化が必須なのか**: Web版はGitHub Pages(HTTPS)で公開されるため、ブラウザの仕様上HTTPの相手には接続できません(混在コンテンツブロック)。またAndroidアプリ側もAPIレベル28以降デフォルトで平文HTTP通信がブロックされます。そのため `voicevox-server/` にはVOICEVOX自体を直接公開せず、CaddyでHTTPS化した上でリバースプロキシする構成にしています。

**もっと手軽に試したい場合**は、VM管理が不要な [Hugging Face Spaces](https://huggingface.co/spaces)(無料CPUプランのDockerタイプ、約48時間操作がないとスリープ)にVOICEVOX ENGINEのDockerイメージをデプロイする方法もあります。セットアップは簡単ですが、Oracle Cloud VM方式ほど「絶対にスリープしない」保証はありません。

## GitHubにpushしてAPK版・Web版を自動ビルドする

このリポジトリには GitHub Actions のワークフローを2つ用意しています。GitHubにリポジトリを作成し、このコードをpushするだけで動作します。

### APK版（Android）

`.github/workflows/build-apk.yml` が `main` ブランチへのpush、または手動実行（Actionsタブ → "Build Android APK" → "Run workflow"）でAPKをビルドします。ビルドが完了すると、そのワークフロー実行画面の "Artifacts" から `kokoro-talk-apk` をダウンロードできます。

- テスト用に、Androidのデフォルトdebug署名でビルドしています。Google Playなどストア配布する場合は別途リリース署名の設定が必要です。
- GitHub Actionsは無料枠（パブリックリポジトリは無料、プライベートリポジトリも月2,000分無料）で完結します。

### Web版（GitHub Pages）

`.github/workflows/deploy-web.yml` が `main` へのpushでWeb版をビルドし、GitHub Pagesに自動公開します。

1. GitHubリポジトリの `Settings > Pages` を開く
2. "Source" を **GitHub Actions** に設定する
3. `main` ブランチにpushすると、`https://<あなたのユーザー名>.github.io/<リポジトリ名>/` で公開されます

## プロジェクト構成

```
app/                  画面 (expo-router)
  _layout.tsx          画面共通のレイアウト・ナビゲーション設定
  index.tsx             メインのチャット画面(ストリーミング表示対応)
  settings.tsx         設定画面(ペルソナ・音声・AI接続設定)
  oauth/openrouter.tsx  OpenRouter OAuthログインのリダイレクト先ページ
components/           UI部品
  ChatBubble.tsx        チャットの吹き出し
  VoiceButton.tsx       マイクボタン
lib/                  ロジック(UIに依存しない部分)
  types.ts              型定義
  config.ts               共有プロキシの接続情報(URL・共有シークレット)
  storage.ts             設定・会話履歴の端末内保存
  personas.ts            AIの立場プリセットとシステムプロンプト生成
  ai.ts                    対話生成AI(LLM)へのストリーミング問い合わせ(共有プロキシ/自分のAPIキー)
  billing.ts               有料プラン(サブスクリプション)の状態確認・決済導線
  openrouterOAuth.ts       OpenRouterのOAuth(PKCE)連携。個別APIキーをログインだけで取得
  voiceInput.ts           音声入力(STT)の抽象化フック
  voiceOutput.ts          音声合成(TTS)の抽象化(端末内蔵/VOICEVOX)
.github/workflows/    GitHub ActionsによるAPKビルド・Web公開
proxy-worker/         対話AIの共有プロキシ(Cloudflare Workers)。開発者のAPIキーをここに集約
voicevox-server/     VOICEVOXを常時稼働・HTTPS公開するためのdocker-compose構成(Oracle Cloud等のVMにコピーして使用)
```

## 今後の拡張候補（テスト版からの発展）

- 共有プロキシの利用状況に応じて、Groqの有料プラン移行やCloudflare Access等の追加保護を検討する
- VOICEVOXエンジンの常時稼働先(有料インスタンス等)の検討、レイテンシ改善
- 会話履歴のクラウド同期（複数端末での引き継ぎ）
- ダークモード、フォントサイズ調整などアクセシビリティ対応
- 通知・リマインダー機能（継続的なチェックイン）
