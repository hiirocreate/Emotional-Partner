import { NativeModule, requireNativeModule } from 'expo';

declare class VoicevoxLocalModule extends NativeModule<{}> {
  /** 辞書の展開とエンジンの初期化を行う(冪等。パスの解決はネイティブ側で行う)。 */
  initializeEngine(): Promise<void>;
  /** VVMファイル(絶対パス)を読み込む。 */
  loadVoiceModel(vvmPath: string): Promise<void>;
  /** 読み込み済みのVVMファイルを解放する。 */
  unloadVoiceModel(vvmPath: string): Promise<void>;
  /** テキストとスタイルIDから音声を合成し、WAVデータをbase64文字列で返す。 */
  synthesize(text: string, styleId: number): Promise<string>;
}

export default requireNativeModule<VoicevoxLocalModule>('VoicevoxLocal');
