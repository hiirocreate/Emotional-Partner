import { Platform } from "react-native";
import * as Speech from "expo-speech";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import { VoiceOption, VoiceSettings } from "./types";

/**
 * 音声合成(TTS)の抽象化レイヤー。
 * 2つの音源プロバイダを選択式で切り替えられる:
 *
 * - "system": 端末/ブラウザに内蔵された音声合成
 *   (Web: SpeechSynthesis API、Native: expo-speech)。無料・登録不要だが、
 *   声のバリエーションは端末/ブラウザ依存。
 * - "voicevox": 自前でホスティングした VOICEVOX ENGINE (無料・OSS) のHTTP APIを
 *   呼び出して合成音声(WAV)を取得し、expo-audio で再生する。
 *   キャラクターボイスが豊富で、ペルソナ設定との相性が良い。
 *   セットアップ方法は README を参照。
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

export interface SpeakCallbacks {
  onDone?: () => void;
  onError?: () => void;
}

let currentVoicevoxPlayer: AudioPlayer | null = null;

/**
 * settings.voice の内容に従って読み上げを実行する。
 * provider が "voicevox" ならVOICEVOX ENGINEに問い合わせ、
 * それ以外は端末/ブラウザ内蔵の音声合成を使う。
 */
export function speakText(
  text: string,
  voice: VoiceSettings,
  callbacks: SpeakCallbacks = {}
) {
  stopSpeaking();

  if (voice.provider === "voicevox") {
    const { baseUrl, speakerId } = voice.voicevox;
    if (!baseUrl || speakerId == null) {
      console.warn("VOICEVOXの接続先または話者が未設定です");
      callbacks.onError?.();
      return;
    }
    speakWithVoicevox(text, baseUrl, speakerId, voice.rate, voice.pitch, callbacks);
    return;
  }

  speakWithSystemVoice(text, voice.selectedVoiceId, voice.rate, voice.pitch, callbacks);
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

async function speakWithVoicevox(
  text: string,
  baseUrl: string,
  speakerId: number,
  rate: number,
  pitch: number,
  callbacks: SpeakCallbacks
) {
  try {
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
    await playWavArrayBuffer(arrayBuffer, callbacks);
  } catch (e) {
    console.warn("VOICEVOXでの読み上げに失敗しました", e);
    callbacks.onError?.();
  }
}

async function playWavArrayBuffer(arrayBuffer: ArrayBuffer, callbacks: SpeakCallbacks) {
  if (isWeb()) {
    // expo-file-system はWeb版では機能しない(スタブ実装)ため、
    // ブラウザ標準のBlob URLを使って再生する。
    try {
      const blob = new Blob([arrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const player = createAudioPlayer(url);
      currentVoicevoxPlayer = player;
      const cleanup = () => {
        subscription.remove();
        player.remove();
        if (currentVoicevoxPlayer === player) currentVoicevoxPlayer = null;
        URL.revokeObjectURL(url);
      };
      const subscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.didJustFinish) {
          cleanup();
          callbacks.onDone?.();
        }
      });
      player.play();
    } catch (e) {
      console.warn("音声の再生に失敗しました", e);
      callbacks.onError?.();
    }
    return;
  }

  try {
    const bytes = new Uint8Array(arrayBuffer);
    const file = new File(Paths.cache, `kokorotalk-tts-${Date.now()}.wav`);
    if (file.exists) {
      file.delete();
    }
    file.create({ overwrite: true });
    file.write(bytes);

    const player = createAudioPlayer(file.uri);
    currentVoicevoxPlayer = player;
    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        player.remove();
        if (currentVoicevoxPlayer === player) currentVoicevoxPlayer = null;
        try {
          file.delete();
        } catch {
          // 一時ファイルの削除失敗は無視して良い
        }
        callbacks.onDone?.();
      }
    });
    player.play();
  } catch (e) {
    console.warn("音声の再生に失敗しました", e);
    callbacks.onError?.();
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function stopSpeaking() {
  if (currentVoicevoxPlayer) {
    try {
      currentVoicevoxPlayer.pause();
      currentVoicevoxPlayer.remove();
    } catch {
      // no-op
    }
    currentVoicevoxPlayer = null;
  }

  if (isWeb()) {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    return;
  }
  Speech.stop();
}
