# EmPa（テスト版）

相談用（メンタルケア用）音声AIアプリのプロトタイプです。React Native (Expo) 製で、**同じコードから Web版とAndroid(APK)版の両方**をビルドできます。すべて無料枠のツールのみで構成しています。

> ⚠️ **注意事項**
> このアプリはテスト段階のプロトタイプであり、医療行為・診断・治療の代わりにはなりません。

## できること

- **リアルタイム音声入力**: マイクボタンを押すと、話した内容をリアルタイムでテキスト化します（Web: ブラウザ標準のSpeech API／アプリ: OS内蔵の音声認識。いずれも無料・追加登録不要）。
- **テキストでも相談可能**: マイクが使えない環境でも、通常のチャット入力で相談できます。
- **入出力の相互変換**: 「音声で相談してテキストで返答を受け取る」「テキストで相談して音声で返答を受け取る」のどちらも可能です（設定画面の「自動読み上げ」トグル、または返答の🔊ボタンから）。
- **ストリーミング応答**: AIの返答は生成され次第リアルタイムに画面へ表示されます。返答が全部揃うまで待つ必要がなく、体感速度が大きく向上します。音声読み上げも同様に、文の区切り(。！？)が届くたびに先行して再生を始めるため、全文が生成し終わるのを待たずに話し始めます。
- **PCでの操作性**: Web版をPCで開いた場合、入力欄で Ctrl+Enter（Macは⌘+Enter）で送信できます（素のEnterは改行）。
- **読み上げボイスを選択式で切り替え**: 「端末/ブラウザ内蔵ボイス」「VOICEVOX（無料の日本語キャラクターボイスエンジン）」「Google Cloud TTS（自然なニューラル音声、サーバー不要）」の3系統から選べます。声質・キャラクター性を重視するならVOICEVOX、サーバー運用の手間なく自然な声を使いたいならGoogle Cloud TTSがおすすめです（セットアップ方法は下記）。
- **AIの立場（ペルソナ）をユーザーごとに設定可能**: 「友だちのように」「兄・姉のように」「傾聴カウンセラーのように」などのプリセットに加え、自由記述でオリジナルの立場を設定できます。
- **AI連携はAPIキー入力なしですぐ使える**: 開発者が用意した共有プロキシ経由で対話AIに接続する設計のため、利用者は各自でAPIキーを発行・入力する必要がありません（有料プラン加入者向け機能。詳細は下記）。
- **自分専用のAPI連携もワンタップで設定可能**: 共有プロキシを使わず自分専用の環境で使いたい場合は、「自分のAPIキーを使う」に切り替えた上で、[OpenRouter](https://openrouter.ai)ならログインボタン一つでAPIキーの発行・入力なしに接続できます（OAuthログイン）。Groqの場合もキー作成ページを直接開くボタンとクリップボード貼り付けボタンで、コピー＆ペーストの手間だけで済みます。こちらは有料プランに関係なく無料でお使いいただけます。
- **有料プラン(サブスクリプション)と管理者コード**: 「備え付けのAI」(共有プロキシ)とVOICEVOX(端末にない読み上げボイス)は有料プラン加入者向けの機能です。Stripeでの決済リンクにより継続課金を受け付けられます。アプリ配布者(管理者)は管理者コードを設定画面に入力することで、課金なしで全機能を使えます。「自分のAPIキーを使う」モードと端末内蔵ボイスはプランに関係なく無料です。
- **プラン別のカラーテーマ**: 無料ユーザーは標準の配色、有料プラン加入者は設定画面の「カラーテーマ」からプリセットの配色をいくつか選べます。管理者はベースカラー・ボタンカラー・テキストカラーを自由に指定できます。

## 相談窓口の案内について（設計方針）

このアプリでは、AIが「いのちの電話」等の相談窓口を機械的に案内する仕組みは搭載していません。定型文の差し込みは、かえって相手を突き放す印象を与えたり、AIとの対話そのものへの信頼を損なう場合があるためです。

システムプロンプトには、相手が「今この瞬間、具体的な方法で自分を傷つけようとしている」ことを明確に語った場合に限り、その言葉から目をそらさずAI自身の言葉で心配を伝えるよう指示する一文だけを残しています（相談窓口の案内やホットライン番号の提示は指示していません）。これも不要であれば `lib/personas.ts` の `buildSystemPrompt` 関数内、「唯一の例外として」から始まる1文を削除すれば完全に取り除けます。

## 使っている無料ツール

| 用途 | 使用技術 | 料金 |
|---|---|---|
| アプリの土台 | Expo (React Native) + expo-router | 無料 (OSS) |
| 音声認識 (STT) | `expo-speech-recognition`（Web: ブラウザ標準 SpeechRecognition API／Android・iOS: OS内蔵音声認識） | 無料・登録不要 |
| 音声合成 (TTS) ①端末内蔵 | Web: ブラウザ標準 SpeechSynthesis API／Native: `expo-speech`（OS内蔵） | 無料・登録不要 |
| 音声合成 (TTS) ②VOICEVOX | [VOICEVOX ENGINE](https://github.com/VOICEVOX/voicevox_engine)（OSS）を [GCP Always Free](https://cloud.google.com/free) の e2-micro VM上でDocker常時稼働 + Caddyで自動HTTPS化 | 無料（Always Free枠、期間の定めなし） |
| 音声合成 (TTS) ③Google Cloud TTS | [Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech) を利用者自身のAPIキーで直接呼び出し(サーバー不要) | 無料枠内なら無料（Neural2等は月100万文字まで） |
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

- **高速重視**: `openai/gpt-oss-20b`（日常会話向け）
- **精度重視**: `openai/gpt-oss-120b`（応答はやや遅くなりますが、文脈理解や表現力が向上）

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

自分の環境でVOICEVOX ENGINEを立てて、アプリの設定画面にそのURLを入力するだけで使えます。用途に応じて3つの構成を用意しました。

#### A. 自分のPCに公式アプリを丸ごとダウンロードして動かす（一番簡単・体感速度が一番速い）

「VOICEVOXの音声モデルをダウンロードしてアプリに組み込めないか」という発想への一番手軽な答えがこれです。アプリ本体(APK/Web)にモデルを内蔵することは(スマホ向けのReact Native/Expoという構成上)現実的ではありませんが、**VOICEVOX公式サイトが配布しているWindows/Mac/Linux版アプリ**を自分のPCにインストールすれば、音声モデルも含めて丸ごとPC内に入り、以後はインターネット接続なしで動きます。

1. [VOICEVOX公式サイト](https://voicevox.hiroshiba.jp/)からOSに合った版をダウンロード・インストールする。
2. アプリを起動する(自動で音声合成エンジンも一緒にポート50021で立ち上がるので、Dockerの知識は不要です)。
3. `http://<PCのIPアドレス>:50021` をスマホ/ブラウザ側のVOICEVOX設定に入力する(スマホとPCが同じWi-Fiに接続されている必要があります)。動作確認は `http://127.0.0.1:50021/docs` で行えます。

**アプリを開いている間だけ**使える方式ですが、手元のPCの性能をそのまま使えるため(Windowsならさらに速いGPUモードも選べます)、下記「C. 常時稼働サーバー」で使っているGCP無料枠(0.25 vCPUしかない非力な構成)よりも体感速度は明確に速くなります。「どこでも常時使えること」より「使うときだけでいいからとにかく速いこと」を優先する人向けです。

#### B. お試し用: 自分のPCでDockerを使って動かす

```bash
docker run --rm -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:cpu-latest
```

起動後、`http://<PCのIPアドレス>:50021` をスマホ/ブラウザ側のVOICEVOX設定に入力してください（スマホとPCが同じWi-Fiに接続されている必要があります）。動作確認は `http://127.0.0.1:50021/docs` で行えます。速度面ではAと同じ(自分のPC性能をそのまま使う)ですが、GUIアプリを入れたくない・Docker環境が既にある場合はこちらでも構いません。PCを閉じると使えなくなる点はAと同じです。

#### C. 推奨構成(基本方針): スリープなし・場所を問わず使える常時稼働サーバー(無料)

上記A・Bは「自分のPCを開いている間だけ」使える高速な方式です。アプリ全体としてはこちらのC(常時アクセス可能)を基本のデフォルトとしつつ、速さを優先したい人は上記A・Bを個別に併用する、という組み合わせを想定しています。

「PCをつけっぱなしにしない」「スリープ復帰の遅延なしにいつでも使う」を両立するには、**本当に常時稼働する無料クラウドVM**の上でVOICEVOX ENGINEを24時間動かすのが最も確実です。Render/Fly.ioなどのPaaS系無料枠や、Hugging Face SpacesのDockerタイプ(2026年に無料枠が廃止され有料プラン専用になりました)は一定時間アクセスがないと自動スリープしたり、そもそも無料で使えなかったりするため、この用途には不向きです。

無料かつ期間の定めなく使えるVMとしては、以下の2つが候補になります。どちらもクレジットカードでの本人確認は必要ですが、無料枠の範囲内であれば課金は発生しません。

- **Google Cloud Platform(GCP)の "Always Free" 枠**: `us-west1`(オレゴン)・`us-central1`(アイオワ)・`us-east1`(サウスカロライナ)のいずれかのリージョンで、`e2-micro` インスタンス(0.25 vCPU・RAM 1GB)を1台、期間の定めなく無料で使えます(新規登録時の$300トライアルクレジットとは別枠)。標準永続ディスク30GBまで、北米以外への通信(日本からのアクセスもここに含まれます)は月1GBまでという制限がありますが、VOICEVOXの音声データのやり取りだけなら通常使用の範囲では収まりやすいです。以下はこちらを前提にした手順です。
- **Oracle Cloud Infrastructure(OCI)の "Always Free" 枠**: スペックは`e2-micro`よりずっと上(Ampere A1、2 OCPU/12GB RAMまで無料)ですが、登録時の審査で失敗することがあります。再挑戦したい場合は、下記の手順3以降と同様に(セキュリティリスト/ufwで80・443番を開放したうえで)進めれば動作します。

このリポジトリの `voicevox-server/` フォルダに、VOICEVOX ENGINEを常時稼働かつHTTPS公開するための `docker-compose.yml` と `Caddyfile`(自動HTTPS化のリバースプロキシ設定)を同梱しています。VM側の準備さえ整えば、このフォルダをコピーして `docker compose up -d` するだけです。

**手順の概要(GCP Always Freeの場合):**

1. [Google Cloudの無料アカウント](https://cloud.google.com/free)を作成する(クレジットカードでの本人確認が必要ですが、Always Free枠の範囲内では課金されません)。プロジェクトを1つ作成しておく。
2. Compute Engineで **VMインスタンスを作成する**。ここで以下3点を必ず守る(どれか1つでもずれるとAlways Free対象外になり課金される):
   - **リージョン**: `us-west1` / `us-central1` / `us-east1` のいずれか(ゾーンはその中のどれでもよい)
   - **マシンタイプ**: `e2-micro`
   - **ブートディスク**: Ubuntu最新LTS・標準永続ディスク30GB以内
   - 作成画面の「HTTPトラフィックを許可する」「HTTPSトラフィックを許可する」のチェックボックスを両方ONにする(80番・443番へのファイアウォール規則が自動的に作られる)。
3. 必要であれば「外部IPアドレス」を静的IPとして予約し、インスタンスに割り当てる(未使用の予約IPは課金対象になるため、必ず割り当てた状態にしておく)。
4. [DuckDNS](https://www.duckdns.org/) などの無料DDNSサービスで `やりたい名前.duckdns.org` の形の無料サブドメインを取得し、インスタンスの外部IPをAレコードとして設定する。
5. コンソールのSSHボタン(またはローカルの `gcloud compute ssh`)でインスタンスに接続し、Docker をインストールする(`curl -fsSL https://get.docker.com | sh` で簡易インストール可)。
6. `e2-micro` はRAMが1GBとやや少ないため、スワップ領域を追加しておくと安定する:
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
7. このリポジトリの `voicevox-server/` フォルダをインスタンスにコピーし(`scp -r` や `git clone` など)、`.env.example` を `.env` にコピーして `DUCKDNS_DOMAIN` を手順4のドメインに書き換える。
8. 起動する:
   ```bash
   cd voicevox-server
   docker compose up -d
   ```
   Caddyが自動でLet's Encryptの証明書を取得し、`https://やりたい名前.duckdns.org` でVOICEVOX ENGINEにHTTPS経由でアクセスできるようになります(`restart: always` により、VM再起動時も自動的に立ち上がります)。
9. アプリの設定画面のVOICEVOX URLに `https://やりたい名前.duckdns.org` を入力すれば完了です。動作確認は `https://やりたい名前.duckdns.org/docs` で行えます。
10. 念のため、GCPコンソールの「お支払い」→「予算とアラート」で少額(例: 100円)のアラートを設定しておくと、万一無料枠を超えても気づけて安心です。

> **なぜHTTPS化が必須なのか**: Web版はGitHub Pages(HTTPS)で公開されるため、ブラウザの仕様上HTTPの相手には接続できません(混在コンテンツブロック)。またAndroidアプリ側もAPIレベル28以降デフォルトで平文HTTP通信がブロックされます。そのため `voicevox-server/` にはVOICEVOX自体を直接公開せず、CaddyでHTTPS化した上でリバースプロキシする構成にしています。

**多少の出費が気にならない場合**は、DigitalOcean・Hetzner・Vultrなどの小規模VPS(月5〜6ドル程度)を使うと、リージョン制限やRAM 1GBの制約なしにもっと快適に動かせます。手順はGCPの3〜10とほぼ同じで、VPS側は最初からHTTP/HTTPSが開いていることが多い分むしろ簡単です。

### 5. Google Cloud TTSで読み上げボイスを増やす（任意、サーバー不要）

VOICEVOXのようなキャラクターボイスではなく、より自然な読み上げ音声を、**サーバーを一切立てずに**使いたい場合はこちらがおすすめです。「自分のAPIキーを使う」対話AIと同じ考え方で、利用者自身のGoogle CloudのAPIキーをアプリに直接設定し、[Google Cloud Text-to-Speech](https://cloud.google.com/text-to-speech) を直接呼び出します。常時稼働サーバーもDuckDNSもDockerも不要です。

無料枠が大きく(WaveNet/Standard音声は月400万文字、Neural2/Chirp3-HDなどの高品質な音声でも月100万文字まで無料)、個人利用であれば通常は無料枠に収まります。ただしAPIの有効化にはクレジットカードでの課金設定が必要です(無料枠内であれば課金されません)。

**手順の概要:**

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成する(GCPをVOICEVOX用に既に使っている場合は同じプロジェクトで構いません)。
2. [Text-to-Speech APIの有効化ページ](https://console.cloud.google.com/apis/library/texttospeech.googleapis.com)を開き、「有効にする」を押す(課金アカウントの設定を求められたら設定する)。
3. 左メニューの「APIとサービス」→「認証情報」→「認証情報を作成」→「APIキー」でAPIキーを発行する。乱用防止のため、発行後にキーを編集して「APIの制限」を「Cloud Text-to-Speech API」のみに絞っておくと安全。
4. アプリの設定画面で「Google Cloud TTS（自分のAPIキー）」を選び、発行したAPIキーを貼り付けて「接続して音声一覧を取得」を押す。日本語の音声一覧(Neural2/Chirp3-HD/Wavenet/Standardなど)が表示されるので、好きな声を選べば完了。

### 6. VOICEVOXをアプリに内蔵する(Android限定・実験的機能)

上記4のVOICEVOXは「サーバー(自分のPC or 常時稼働VM)にアプリから通信して読み上げる」方式でした。この6は発想が異なり、**サーバーを一切使わず、音声合成そのものをスマホ内で完結させる**方式です。通信が発生しないため理論上もっとも速く、オフラインでも動きます。ただし技術的な制約から**Android版のみ**の機能で、**有料プラン加入者または管理者のみ**が使えます(無料プランやWeb版では表示されません)。

#### なぜAndroid限定なのか

この機能はVOICEVOX公式の音声合成エンジン本体([voicevox_core](https://github.com/VOICEVOX/voicevox_core)、MITライセンス)をアプリに組み込むことで実現しています。voicevox_coreはC言語向けのライブラリとPython向けライブラリが公式に提供されていますが、**Webブラウザ向け(WASM)や React Native/Expo向けの公式提供は存在しません**。そのためWeb版でこの方式を使うことはできず、今まで通りVOICEVOXサーバー(上記4)に頼る形になります。Android版は、C言語向けライブラリをJNI(Javaと C/C++を橋渡しする仕組み)経由で直接呼び出す独自のネイティブモジュール(`modules/voicevox-local/`)を実装することで対応しています。iOS版も技術的には同様のアプローチが可能ですが、このリポジトリでは未対応です。

#### 使い方

1. 有料プランに加入する、または管理者コードを入力する(設定画面の「利用プラン」から)。
2. 設定画面の音声プロバイダで「VOICEVOX（内蔵・Android限定）」を選ぶ(Android版のみ表示されます)。
3. 使いたい話者・スタイルのチップをタップするとダウンロードが始まります(数十MB程度。進捗が表示されます)。ダウンロードが終わったスタイルには✓が付き、タップで選択できます。
4. 選択したスタイルがそのまま読み上げに使われます。不要になったデータは「ダウンロード済みデータの管理」から個別に削除できます。

話者・スタイルの一覧やVVM(音声モデル)ファイルとの対応は[voicevox_vvmリポジトリ](https://github.com/VOICEVOX/voicevox_vvm)の配布物をそのまま使わせていただいており、`lib/voicevoxVvmCatalog.ts` にその対応表をそのまま反映しています。

#### ライセンス・クレジット表記について

- voicevox_core本体・アプリ内蔵用のネイティブモジュールのコードはMITライセンスです。
- **各音声モデル(VVMファイル)には個別の利用規約があります**。商用・非商用問わず利用・アプリへの組み込み・再配布が許可されていますが、**「VOICEVOX:キャラクター名」のようなクレジット表記が必要**です(表記ルールの詳細は[voicevox_vvmリポジトリのREADME](https://github.com/VOICEVOX/voicevox_vvm)、および各キャラクターの利用規約ページを参照してください)。この機能を使って生成した音声を含むコンテンツを公開する場合は、使った話者に応じたクレジット表記を忘れないようにしてください。

#### ビルドの仕組みと、正直な検証状況について

voicevox_core本体(C API)・ONNX Runtime・OpenJTalk辞書は、リポジトリには含めず、**GitHub Actionsのビルド時にVOICEVOX CORE公式のDownloaderツールで毎回取得**し、`modules/voicevox-local/android/src/main/jniLibs/` および `assets/voicevox_dict/` に配置してからビルドしています(`.github/workflows/build-apk.yml` 参照)。VVM音声モデル自体はビルドに含めず、前述の通りアプリ内から利用者が個別にダウンロードする方式です。

正直にお伝えすると、この開発環境にはAndroid SDK/NDKが無く実機・実エミュレータでのビルド確認ができないため、以下の範囲で検証しています:

- JNIのC++コード(`voicevox_jni.cpp`)は、voicevox_coreの実物のヘッダファイルを取り込んだ上で実際に`g++`でコンパイルが通ることを確認済みです(構文・型の誤りがないことは確認できています)。
- CMakeの設定(`CMakeLists.txt`)も実際に`cmake`で構成が通ることを確認済みです。
- TypeScript/React Native側のコード(`tsc --noEmit`、`expo export --platform web`)は問題なく通っています。

一方で、**実際のAndroidリンク・ビルド・実機動作はこの環境では確認できていません**。GitHub Actionsでビルドした際にエラーが出た場合は、ビルドログをそのまま共有していただければ、それをもとに修正します。他の機能に比べてネイティブコードを含む分、初回ビルドでの手直しが必要になる可能性が他の機能より高い、実験的な機能だとご理解ください。

## GitHubにpushしてAPK版・Web版を自動ビルドする

このリポジトリには GitHub Actions のワークフローを2つ用意しています。GitHubにリポジトリを作成し、このコードをpushするだけで動作します。

### APK版（Android）

`.github/workflows/build-apk.yml` が `main` ブランチへのpush、または手動実行（Actionsタブ → "Build Android APK" → "Run workflow"）でAPKをビルドします。ビルドが完了すると、そのワークフロー実行画面の "Artifacts" から `empa-apk` をダウンロードできます。

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
  voiceOutput.ts          音声合成(TTS)の抽象化(端末内蔵/VOICEVOX/Google Cloud TTS/内蔵VOICEVOX)
  localVoicevox.ts        VOICEVOX内蔵機能(Android限定)のVVMダウンロード管理・ネイティブ呼び出し
  voicevoxVvmCatalog.ts   VVMファイルと話者/スタイルIDの対応表
modules/voicevox-local/  VOICEVOXをアプリに内蔵するExpoネイティブモジュール(Android限定・実験的)
.github/workflows/    GitHub ActionsによるAPKビルド・Web公開
proxy-worker/         対話AIの共有プロキシ(Cloudflare Workers)。開発者のAPIキーをここに集約
voicevox-server/     VOICEVOXを常時稼働・HTTPS公開するためのdocker-compose構成(GCP Always Free等のVMにコピーして使用)
```

## 今後の拡張候補（テスト版からの発展）

- 共有プロキシの利用状況に応じて、Groqの有料プラン移行やCloudflare Access等の追加保護を検討する
- VOICEVOXエンジンの常時稼働先(有料インスタンス等)の検討、レイテンシ改善
- 会話履歴のクラウド同期（複数端末での引き継ぎ）
- ダークモード、フォントサイズ調整などアクセシビリティ対応
- 通知・リマインダー機能（継続的なチェックイン）
