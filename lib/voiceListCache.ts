import { VoiceOption } from "./types";

/**
 * VOICEVOX / Google Cloud TTS の音声一覧のインメモリキャッシュ。
 *
 * 設定画面はチャット画面との行き来のたびに再マウントされる(expo-routerの
 * スタックナビゲーションでは「戻る」で画面がアンマウントされるため)。
 * これにより毎回話者一覧を再取得してしまい、体感の待たされ感につながっていた。
 * URL/APIキーが変わっていなければ再取得せずにこのキャッシュを使い回す。
 * (アプリを完全に再起動すればキャッシュは消えるが、画面往復では消えない)
 */

let voicevoxCache: { key: string; voices: VoiceOption[] } | null = null;
let googleCache: { key: string; voices: VoiceOption[] } | null = null;

export function getCachedVoicevoxVoices(baseUrl: string): VoiceOption[] | null {
  const key = baseUrl.trim();
  if (!key || !voicevoxCache || voicevoxCache.key !== key) return null;
  return voicevoxCache.voices;
}

export function setCachedVoicevoxVoices(baseUrl: string, voices: VoiceOption[]): void {
  const key = baseUrl.trim();
  if (!key) return;
  voicevoxCache = { key, voices };
}

export function getCachedGoogleVoices(apiKey: string): VoiceOption[] | null {
  const key = apiKey.trim();
  if (!key || !googleCache || googleCache.key !== key) return null;
  return googleCache.voices;
}

export function setCachedGoogleVoices(apiKey: string, voices: VoiceOption[]): void {
  const key = apiKey.trim();
  if (!key) return;
  googleCache = { key, voices };
}
