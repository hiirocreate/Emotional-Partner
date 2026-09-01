import { Platform } from "react-native";
import * as Speech from "expo-speech";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { base64ToBytes } from "./base64";
import { VoiceOption, VoiceSettings } from "./types";

/**
 * 音声合成(TTS)の抽象化レイヤー。
 * 3つの音源プロバイダを選択式で切り替えられる:
 *
 * - "system": 端末/ブラウザに内蔵された音声合成
 *   (Web: SpeechSynthesis API、Native: expo-speech)。無料・登録不要だが、
 *   声のバリエーションは端末/ブラウザ依存。
 * - "voicevox": 自前でホスティングした VOICEVOX ENGINE (無料・OSS) のHTTP APIを
 *   呼び出して合成音声(WAV)を取得し、expo-audio で再生する。
 *   キャラクターボイスが豊富で、ペルソナ設定との相性が良いが、
 *   常時稼働サーバーを自分で用意する必要がある(README参照)。
 * - "google": Google Cloud Text-to-Speech APIを利用者自身のAPIキーで直接呼び出す。
 *   サーバーのホスティングが一切不要な代わりに、キャラクターボイスではなく
 *   自然な読み上げ音声(Neural2等)が中心になる。無料枠が大きく、個人利用なら
 *   実質無料で使える(README参照)。
 *
 * ["voicevox"/"google"の速度対策]
 * クラウド合成(VOICEVOX/Google)は「テキスト送信→音声データ取得」のHTTP往復が
 * どうしても発生し、モバイル回線や非力な自前サーバー(GCP無料枠など)では
 * この往復だけで数百ms〜数秒かかることがある。文単位でキューに積んで
 * 逐次再生する仕組み(enqueueSpeech)自体は既にあったが、以前は
 * 「今の文の再生が終わってから次の文の合成をリクエストする」という
 * 完全な直列処理だったため、往復のたびに無音の間が空いてしまっていた。
 * これを解消するため、
 *   1. enqueueSpeech() に積んだ瞬間から(再生の順番を待たずに)音声合成の
 *      HTTPリクエストを先読みで開始しておく(prefetch)。再生中に次の文の
 *      合成が裏で進むので、前の文が終わる頃には次の音声データが
 *      既に手元にある状態になる。
 *   2. 再生用のAudioPlayerインスタンスを文ごとに作り直さず、1つを使い回して
 *      replace()で音源だけ差し替える。ネイティブ(スマホ)ではプレイヤーの
 *      生成・破棄のたびにOS側のオーディオセッション初期化コストがかかり、
 *      これが文の切れ目ごとの体感の「間」として効いていたため。
 */

function isWeb() {
  return Platform.OS === "web";
}

/** 端末/ブラウザ内蔵の音声一覧を取得する。日本語音声を優先的に先頭へ。 */
export async function listAvailableVoices(): Promise<VoiceOption[]> {
  if (isWeb()) {
    return listWebVoices();
  }
  const voices = await Speech.getAvailableVoicesAsync();
  const mapped: VoiceOption[] = voices.map((v) => ({
    id: v.identifier,
    label: `${v.name ?? v.identifier}${v.language ? ` (${v.language})` : ""}`,
    lang: v.language ?? "",
  }));
  return sortJapaneseFirst(mapped);
}

function sortJapaneseFirst(voices: VoiceOption[]): VoiceOption[] {
  return [...voices].sort((a, b) => {
    const aJa = a.lang.toLowerCase().startsWith("ja") ? 0 : 1;
    const bJa = b.lang.toLowerCase().startsWith("ja") ? 0 : 1;
    return aJa - bJa;
  });
}

function listWebVoices(): Promise<VoiceOption[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const collect = () => {
      const voices = synth.getVoices();
      const mapped: VoiceOption[] = voices.map((v) => ({
        id: v.voiceURI,
        label: `${v.name} (${v.lang})`,
        lang: v.lang,
      }));
      resolve(sortJapaneseFirst(mapped));
    };
    const existing = synth.getVoices();
    if (existing.length > 0) {
      collect();
    } else {
      synth.onvoiceschanged = collect;
      setTimeout(collect, 500);
    }
  });
}

/**
 * VOICEVOX ENGINE の /speakers から、選択可能な話者スタイルの一覧を取得する。
 * baseUrl の例: http://192.168.1.10:50021 (LAN上の自PC) や
 * Renderなどにデプロイした場合は https://your-app.onrender.com
 */
export async function listVoicevoxSpeakers(baseUrl: string): Promise<VoiceOption[]> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (!base) return [];
  const res = await fetch(`${base}/speakers`);
  if (!res.ok) {
    throw new Error(`VOICEVOXエンジンへの接続に失敗しました (HTTP ${res.status})`);
  }
  const speakers: Array<{
    name: string;
    styles: Array<{ id: number; name: string }>;
  }> = await res.json();

  const options: VoiceOption[] = [];
  for (const speaker of speakers) {
    for (const style of speaker.styles) {
      options.push({
        id: String(style.id),
        label: `${speaker.name}（${style.name}）`,
        lang: "ja-JP",
      });
    }
  }
  return options;
}

/**
 * Google Cloud Text-to-Speech APIの `/v1/voices` から、日本語の音声一覧を取得する。
 * https://cloud.google.com/text-to-speech/docs/reference/rest/v1/voices/list
 */
export async function listGoogleTtsVoices(apiKey: string): Promise<VoiceOption[]> {
  const key = apiKey.trim();
  if (!key) return [];
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/voices?languageCode=ja-JP&key=${encodeURIComponent(key)}`
  );
  if (!res.ok) {
    throw new Error(
      `Google Cloud TTSへの接続に失敗しました (HTTP ${res.status})。APIキーと、Text-to-Speech APIの有効化状況をご確認ください。`
    );
  }
  const data: { voices?: Array<{ name: string; ssmlGender: string; languageCodes: string[] }> } =
    await res.json();
  const genderLabel: Record<string, string> = { MALE: "男性", FEMALE: "女性", NEUTRAL: "中性" };
  const options: VoiceOption[] = (data.voices ?? []).map((v) => ({
    id: v.name,
    label: `${v.name}（${genderLabel[v.ssmlGender] ?? v.ssmlGender}）`,
    lang: v.languageCodes[0] ?? "ja-JP",
  }));
  // Neural2/Chirp3-HDなど新しい高品質な音声を先頭に出す
  const rank = (id: string) => {
    if (id.includes("Chirp3-HD")) return 0;
    if (id.includes("Neural2")) return 1;
    if (id.includes("Wavenet")) return 2;
    return 3;
  };
  return options.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

export interface SpeakCallbacks {
  onDone?: () => void;
  onError?: () => void;
}

function needsCloudSynthesis(voice: VoiceSettings): boolean {
  return voice.provider === "voicevox" || voice.provider === "google";
}

/**
 * settings.voice の内容に従って読み上げを実行する(即座に、直前の再生を中断して)。
 * provider に応じてVOICEVOX ENGINE / Google Cloud TTS / 端末内蔵音声のいずれかを使う。
 * 吹き出しの🔊ボタンでの再生や試聴など、単発の読み上げに使う。
 * AIの返答をストリーミングに合わせて逐次読み上げたい場合は `enqueueSpeech` を使うこと。
 */
export function speakText(
  text: string,
  voice: VoiceSettings,
  callbacks: SpeakCallbacks = {}
) {
  stopSpeaking();
  dispatchSpeak(text, voice, callbacks);
}

function dispatchSpeak(text: string, voice: VoiceSettings, callbacks: SpeakCallbacks) {
  if (needsCloudSynthesis(voice)) {
    synthesizeCloudAudio(text, voice)
      .then((audio) => playAudioArrayBuffer(audio.arrayBuffer, audio.mimeType, audio.fileExt, callbacks))
      .catch((e) => {
        console.warn("読み上げに失敗しました", e);
        callbacks.onError?.();
      });
    return;
  }

  speakWithSystemVoice(text, voice.selectedVoiceId, voice.rate, voice.pitch, callbacks);
}

interface SynthesizedAudio {
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  fileExt: string;
}

interface QueueItem {
  text: string;
  voice: VoiceSettings;
  callbacks: SpeakCallbacks;
  /** クラウド合成が必要な場合、キュー追加と同時に開始しておく先読みリクエスト(失敗時はnullに解決する) */
  synthesis: Promise<SynthesizedAudio | null> | null;
}

let speechQueue: QueueItem[] = [];
let isProcessingQueue = false;
// stopSpeaking()のたびに世代を進める。再生中の項目が強制停止された場合、
// 先読み中の合成待ちや再生待ちをこの世代番号でまとめて打ち切り、
// キューの停止漏れを防ぐ。
let queueGeneration = 0;

/**
 * 読み上げを再生キューに追加する。
 *
 * AIの返答はストリーミングで少しずつ届くため、全文が揃うのを待ってから読み上げると
 * (特に精度重視モデルでは)無音の待ち時間が長く感じられる。文の区切り(。！？や改行)が
 * 来るたびにこの関数で追加していくと、既存の読み上げの再生が終わり次第すぐ次の文が
 * 再生されるため、体感の応答速度が大きく改善する。
 *
 * さらに、クラウド音声(VOICEVOX/Google)の合成リクエストは、再生の順番を待たずに
 * キュー追加と同時に(裏で)開始する。前の文が再生されている間に次の文の合成が
 * 進むため、文の切れ替わりで無音になりにくい(特に回線が細いスマホや、
 * 非力な自前VOICEVOXサーバーで効果が大きい)。
 *
 * `speakText` と違い、既存の再生や既にキューにある分は中断しない。
 */
export function enqueueSpeech(
  text: string,
  voice: VoiceSettings,
  callbacks: SpeakCallbacks = {}
): void {
  if (!text.trim()) return;
  const synthesis = needsCloudSynthesis(voice)
    ? synthesizeCloudAudio(text, voice).catch((e) => {
        console.warn("音声合成の先読みに失敗しました", e);
        return null;
      })
    : null;
  speechQueue.push({ text, voice, callbacks, synthesis });
  if (!isProcessingQueue) {
    processSpeechQueue(queueGeneration);
  }
}

/** キューに溜まっている分だけ消去する(現在再生中のものは止めない。止めたい場合は stopSpeaking を使う) */
export function clearSpeechQueue(): void {
  speechQueue = [];
}

async function processSpeechQueue(generation: number): Promise<void> {
  const item = speechQueue.shift();
  if (!item) {
    isProcessingQueue = false;
    return;
  }
  isProcessingQueue = true;

  if (item.synthesis) {
    const audio = await item.synthesis;
    if (generation !== queueGeneration) return; // 待っている間にstopSpeaking()で打ち切られた
    if (!audio) {
      item.callbacks.onError?.();
    } else {
      await playAudioArrayBuffer(audio.arrayBuffer, audio.mimeType, audio.fileExt, item.callbacks);
    }
  } else {
    await new Promise<void>((resolve) => {
      speakWithSystemVoice(item.text, item.voice.selectedVoiceId, item.voice.rate, item.voice.pitch, {
        onDone: () => {
          item.callbacks.onDone?.();
          resolve();
        },
        onError: () => {
          item.callbacks.onError?.();
          resolve();
        },
      });
    });
  }

  if (generation !== queueGeneration) {
    // 再生中にstopSpeaking()で打ち切られていたら、ここで処理チェーンを終える
    return;
  }
  processSpeechQueue(generation);
}

/**
 * ストリーミング中のテキストから、まだ読み上げていない「確定した文」だけを取り出す。
 * 句点(。！？)や改行までを1文として扱い、末尾の未確定な文(区切りがまだ来ていない部分)は
 * 次回以降に持ち越す。呼び出し側は返ってきた `consumedUpTo` を次回の `consumedLength` に渡すこと。
 */
export function extractSpeakableChunks(
  fullText: string,
  consumedLength: number
): { chunks: string[]; consumedUpTo: number } {
  const unconsumed = fullText.slice(consumedLength);
  const chunks: string[] = [];
  let lastBoundary = 0;
  const boundaryRegex = /[。！？\n]/g;
  let match: RegExpExecArray | null;
  while ((match = boundaryRegex.exec(unconsumed))) {
    const end = match.index + 1;
    const chunk = unconsumed.slice(lastBoundary, end).trim();
    if (chunk) chunks.push(chunk);
    lastBoundary = end;
  }
  return { chunks, consumedUpTo: consumedLength + lastBoundary };
}

function speakWithSystemVoice(
  text: string,
  voiceId: string | null,
  rate: number,
  pitch: number,
  callbacks: SpeakCallbacks
) {
  if (isWeb()) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      callbacks.onError?.();
      return;
    }
    const utter = new window.SpeechSynthesisUtterance(text);
    utter.rate = rate;
    utter.pitch = pitch;
    if (voiceId) {
      const match = window.speechSynthesis.getVoices().find((v) => v.voiceURI === voiceId);
      if (match) utter.voice = match;
    }
    utter.onend = () => callbacks.onDone?.();
    utter.onerror = () => callbacks.onError?.();
    window.speechSynthesis.speak(utter);
    return;
  }

  Speech.speak(text, {
    voice: voiceId ?? undefined,
    rate,
    pitch,
    language: "ja-JP",
    onDone: callbacks.onDone,
    onError: callbacks.onError,
  });
}

/** voice.provider に応じてVOICEVOX/Google Cloud TTSの音声データを取得する(再生はしない)。 */
async function synthesizeCloudAudio(text: string, voice: VoiceSettings): Promise<SynthesizedAudio> {
  if (voice.provider === "voicevox") {
    const { baseUrl, speakerId } = voice.voicevox;
    if (!baseUrl || speakerId == null) {
      throw new Error("VOICEVOXの接続先または話者が未設定です");
    }
    return synthesizeVoicevox(text, baseUrl, speakerId, voice.rate, voice.pitch);
  }

  const { apiKey, voiceName } = voice.google;
  if (!apiKey || !voiceName) {
    throw new Error("Google Cloud TTSのAPIキーまたは音声が未設定です");
  }
  return synthesizeGoogleTts(text, apiKey, voiceName, voice.rate, voice.pitch);
}

async function synthesizeVoicevox(
  text: string,
  baseUrl: string,
  speakerId: number,
  rate: number,
  pitch: number
): Promise<SynthesizedAudio> {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const queryRes = await fetch(
    `${base}/audio_query?speaker=${speakerId}&text=${encodeURIComponent(text)}`,
    { method: "POST" }
  );
  if (!queryRes.ok) {
    throw new Error(`音声パラメータの生成に失敗しました (HTTP ${queryRes.status})`);
  }
  const audioQuery = await queryRes.json();
  // アプリの「速さ/高さ」スライダーをVOICEVOXのパラメータ範囲にゆるく対応させる
  audioQuery.speedScale = clamp(rate, 0.5, 2.0);
  audioQuery.pitchScale = clamp((pitch - 1) * 0.3, -0.15, 0.15);

  const synthRes = await fetch(`${base}/synthesis?speaker=${speakerId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(audioQuery),
  });
  if (!synthRes.ok) {
    throw new Error(`音声合成に失敗しました (HTTP ${synthRes.status})`);
  }
  const arrayBuffer = await synthRes.arrayBuffer();
  return { arrayBuffer, mimeType: "audio/wav", fileExt: "wav" };
}

/**
 * Google Cloud Text-to-Speech APIの `/v1/text:synthesize` を呼び出す。
 * https://cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize
 */
async function synthesizeGoogleTts(
  text: string,
  apiKey: string,
  voiceName: string,
  rate: number,
  pitch: number
): Promise<SynthesizedAudio> {
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(apiKey.trim())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: "ja-JP", name: voiceName },
        audioConfig: {
          audioEncoding: "MP3",
          // アプリの「速さ」スライダー(0.5〜1.8)はGoogleの許容範囲(0.25〜4.0)にそのまま収まる
          speakingRate: clamp(rate, 0.25, 4.0),
          // アプリの「高さ」スライダー(0.5〜1.8、基準1.0)をGoogleの半音単位(-20.0〜20.0)へゆるく対応させる
          pitch: clamp((pitch - 1) * 8, -20, 20),
        },
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`音声合成に失敗しました (HTTP ${res.status})`);
  }
  const data: { audioContent?: string } = await res.json();
  if (!data.audioContent) {
    throw new Error("音声データを取得できませんでした");
  }
  const bytes = base64ToBytes(data.audioContent);
  return { arrayBuffer: bytes.buffer as ArrayBuffer, mimeType: "audio/mpeg", fileExt: "mp3" };
}

// 文の切り替わりごとにAudioPlayerを生成・破棄すると、特にネイティブ(スマホ)では
// OS側のオーディオセッション初期化コストが毎回かかり、無音の「間」として体感される。
// 1つのプレイヤーを使い回し、replace()で音源だけ差し替えることでこれを避ける。
let sharedPlayer: AudioPlayer | null = null;
// 現在の再生が「自然に最後まで再生し終わったか(true)」「stopSpeaking()等で
// 途中で打ち切られたか(false)」を呼び出し元に伝えるための解決関数。
let resolveActivePlayback: ((finishedNaturally: boolean) => void) | null = null;

function ensureSharedPlayer(source: string): AudioPlayer {
  if (sharedPlayer) {
    sharedPlayer.replace(source);
    return sharedPlayer;
  }
  const player = createAudioPlayer(source);
  player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) {
      resolveActivePlayback?.(true);
      resolveActivePlayback = null;
    }
  });
  sharedPlayer = player;
  return player;
}

async function playAudioArrayBuffer(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  fileExt: string,
  callbacks: SpeakCallbacks
) {
  try {
    let source: string;
    let cleanup: (() => void) | null = null;

    if (isWeb()) {
      // expo-file-system はWeb版では機能しない(スタブ実装)ため、
      // ブラウザ標準のBlob URLを使って再生する。
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      source = url;
      cleanup = () => URL.revokeObjectURL(url);
    } else {
      // 文ごとに新しいファイル名で書き出すと生成・削除の回数が増えるため、
      // 拡張子ごとに固定名を使い回す(直列再生なので競合しない)。
      const file = new File(Paths.cache, `kokorotalk-tts-playback.${fileExt}`);
      if (file.exists) {
        file.delete();
      }
      file.create({ overwrite: true });
      file.write(new Uint8Array(arrayBuffer));
      source = file.uri;
    }

    const player = ensureSharedPlayer(source);
    const finishedNaturally = await new Promise<boolean>((resolve) => {
      resolveActivePlayback = resolve;
      player.play();
    });
    cleanup?.();

    if (finishedNaturally) {
      callbacks.onDone?.();
    }
    // 途中で打ち切られた場合は、stopSpeaking()側で完結しているのでコールバックは呼ばない
  } catch (e) {
    console.warn("音声の再生に失敗しました", e);
    callbacks.onError?.();
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function stopSpeaking() {
  clearSpeechQueue();
  queueGeneration++;
  isProcessingQueue = false;

  if (resolveActivePlayback) {
    const resolve = resolveActivePlayback;
    resolveActivePlayback = null;
    resolve(false);
  }
  if (sharedPlayer) {
    try {
      sharedPlayer.pause();
    } catch {
      // no-op
    }
  }

  if (isWeb()) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    return;
  }
  Speech.stop();
}
