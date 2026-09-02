import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

import { base64ToBytes } from "./base64";
import { LOCAL_VOICEVOX_CATALOG, LocalVoicevoxVvmEntry } from "./voicevoxVvmCatalog";
// Android限定のExpoネイティブモジュール本体。Web/iOSではフォールバック実装が
// 使われ、呼び出すと例外を投げる(isLocalVoicevoxSupported()で事前にガードすること)。
import VoicevoxLocalModule from "../modules/voicevox-local/src/VoicevoxLocalModule";

/**
 * VOICEVOXの音声モデル(VVMファイル)をアプリ内にダウンロードし、サーバー通信なしで
 * 端末上で直接音声合成するための機能(Android限定・有料プラン/管理者限定)。
 *
 * - voicevox_core本体・ONNX Runtime・OpenJTalk辞書はビルド時にAPKへ同梱済み
 *   (.github/workflows/build-apk.yml、modules/voicevox-local/参照)。
 * - VVMファイル(声そのもののデータ)だけを、利用者が選んだ話者ごとに個別に
 *   ダウンロードする。ダウンロード元は VOICEVOX/voicevox_vvm リポジトリの
 *   raw配信(MITではなくVOICEVOX音声モデル利用規約が適用されるが、アプリへの
 *   組み込み・再配布は許諾されている。詳細はREADME参照)。
 */

const VVM_DOWNLOAD_BASE_URL = "https://raw.githubusercontent.com/VOICEVOX/voicevox_vvm/main/vvms/";

export function isLocalVoicevoxSupported(): boolean {
  return Platform.OS === "android";
}

function vvmDirectory(): Directory {
  return new Directory(Paths.document, "voicevox_vvm");
}

function vvmFile(vvmFileName: string): File {
  return new File(vvmDirectory(), vvmFileName);
}

export function isVvmDownloaded(vvmFileName: string): boolean {
  if (!isLocalVoicevoxSupported()) return false;
  try {
    return vvmFile(vvmFileName).exists;
  } catch {
    return false;
  }
}

export function listDownloadedVvmFiles(): string[] {
  if (!isLocalVoicevoxSupported()) return [];
  const dir = vvmDirectory();
  if (!dir.exists) return [];
  return dir
    .list()
    .filter((entry): entry is File => entry instanceof File && entry.name.endsWith(".vvm"))
    .map((f) => f.name);
}

/** styleId(スタイルID)から、カタログ上の話者名・スタイル名・所属VVMファイルを逆引きする */
export function findCatalogEntryByStyleId(
  styleId: number
): { entry: LocalVoicevoxVvmEntry; speakerName: string; styleName: string } | null {
  for (const entry of LOCAL_VOICEVOX_CATALOG) {
    const style = entry.styles.find((s) => s.styleId === styleId);
    if (style) return { entry, speakerName: style.speakerName, styleName: style.styleName };
  }
  return null;
}

/**
 * VVMファイルをダウンロードする。既にダウンロード済みなら何もしない。
 * onProgressには0〜1の進捗率(サーバーがサイズを返さない場合はnull)が渡される。
 */
export async function downloadVvm(
  vvmFileName: string,
  onProgress?: (ratio: number | null) => void
): Promise<void> {
  if (!isLocalVoicevoxSupported()) {
    throw new Error("この機能はAndroid版でのみ利用できます");
  }
  if (isVvmDownloaded(vvmFileName)) return;

  const dir = vvmDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true, idempotent: true });
  }

  const url = `${VVM_DOWNLOAD_BASE_URL}${vvmFileName}`;
  const task = File.createDownloadTask(url, dir, {
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress?.(totalBytes > 0 ? bytesWritten / totalBytes : null);
    },
  });
  const result = await task.downloadAsync();
  if (!result) {
    throw new Error("ダウンロードが完了しませんでした。電波状況を確認して再度お試しください。");
  }
}

/** ダウンロード済みのVVMファイルを削除する(ネイティブ側の読み込み状態も忘れさせる)。 */
export function deleteVvm(vvmFileName: string): void {
  const file = vvmFile(vvmFileName);
  if (file.exists) file.delete();
  loadedVvmFiles.delete(vvmFileName);
}

// ネイティブエンジンの初期化・VVM読み込み状態はアプリのプロセスが生きている間だけ
// 有効(再起動すればまた読み込み直しが必要)なので、JS側でも同じ寿命でメモリ管理する。
let engineInitPromise: Promise<void> | null = null;
const loadedVvmFiles = new Set<string>();

async function ensureVoiceReady(vvmFileName: string): Promise<void> {
  if (!engineInitPromise) {
    engineInitPromise = VoicevoxLocalModule.initializeEngine();
  }
  await engineInitPromise;

  if (!loadedVvmFiles.has(vvmFileName)) {
    const file = vvmFile(vvmFileName);
    if (!file.exists) {
      throw new Error("この声のデータがまだダウンロードされていません");
    }
    await VoicevoxLocalModule.loadVoiceModel(file.uri);
    loadedVvmFiles.add(vvmFileName);
  }
}

/** テキストとスタイルIDから、端末内で直接WAVを合成する(サーバー通信なし)。 */
export async function synthesizeLocal(
  text: string,
  styleId: number
): Promise<{ arrayBuffer: ArrayBuffer; mimeType: string; fileExt: string }> {
  if (!isLocalVoicevoxSupported()) {
    throw new Error("この機能はAndroid版でのみ利用できます");
  }
  const found = findCatalogEntryByStyleId(styleId);
  if (!found) {
    throw new Error("未知のスタイルIDです");
  }
  await ensureVoiceReady(found.entry.vvmFile);

  const base64Wav = await VoicevoxLocalModule.synthesize(text, styleId);
  const bytes = base64ToBytes(base64Wav);
  return { arrayBuffer: bytes.buffer as ArrayBuffer, mimeType: "audio/wav", fileExt: "wav" };
}
