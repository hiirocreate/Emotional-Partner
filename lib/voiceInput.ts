import { useCallback, useRef, useState } from "react";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

/**
 * 音声入力(STT)の抽象化フック。
 *
 * expo-speech-recognition は Web では標準の SpeechRecognition API を、
 * Android/iOS ではOS内蔵の音声認識をそのまま利用するため、
 * 「リアルタイムに音声を読み取る」要件をこの1つのAPIで
 * Web版・アプリ版の両方に対して無料で満たせる。
 */
export interface VoiceInputState {
  isListening: boolean;
  /** 認識中の途中経過(確定前)テキスト */
  interimText: string;
  error: string | null;
}

export function useVoiceInput(onFinalResult: (text: string) => void) {
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    interimText: "",
    error: null,
  });
  const finalHandlerRef = useRef(onFinalResult);
  finalHandlerRef.current = onFinalResult;

  useSpeechRecognitionEvent("start", () => {
    setState((s) => ({ ...s, isListening: true, error: null }));
  });

  useSpeechRecognitionEvent("end", () => {
    setState((s) => ({ ...s, isListening: false, interimText: "" }));
  });

  useSpeechRecognitionEvent("result", (event) => {
    const result = event.results?.[0];
    if (!result) return;
    const transcript = result.transcript ?? "";
    if (event.isFinal) {
      setState((s) => ({ ...s, interimText: "" }));
      if (transcript.trim()) {
        finalHandlerRef.current(transcript.trim());
      }
    } else {
      setState((s) => ({ ...s, interimText: transcript }));
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setState((s) => ({
      ...s,
      isListening: false,
      error: describeError(event.error),
    }));
  });

  const start = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setState((s) => ({
          ...s,
          error: "マイクの使用が許可されていません。端末の設定を確認してください。",
        }));
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: "ja-JP",
        interimResults: true,
        continuous: false,
      });
    } catch (e) {
      setState((s) => ({
        ...s,
        error: "音声認識を開始できませんでした。この環境では利用できない可能性があります。",
      }));
    }
  }, []);

  const stop = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // no-op: 認識が開始されていない場合など
    }
  }, []);

  return { ...state, start, stop };
}

function describeError(code: string): string {
  switch (code) {
    case "not-allowed":
      return "マイクの使用が許可されていません。";
    case "no-speech":
      return "音声が検出されませんでした。もう一度お試しください。";
    case "network":
      return "ネットワークエラーにより音声認識に失敗しました。";
    default:
      return `音声認識でエラーが発生しました (${code})`;
  }
}
