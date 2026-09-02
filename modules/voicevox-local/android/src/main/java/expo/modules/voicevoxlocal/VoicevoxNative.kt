package expo.modules.voicevoxlocal

/**
 * voicevox_jni.cpp (libvoicevox_jni.so) へのJNI宣言。
 * すべて呼び出し元スレッドをブロックするので、[VoicevoxLocalModule] 側の
 * AsyncFunction (バックグラウンド実行) からのみ呼ぶこと。
 */
internal object VoicevoxNative {
  init {
    System.loadLibrary("voicevox_jni")
  }

  /** OpenJTalk辞書ディレクトリと、ONNX Runtime共有ライブラリの絶対パスを指定して初期化する(冪等)。 */
  external fun initializeEngine(dictDir: String, onnxruntimePath: String)

  /** VVMファイル(絶対パス)を読み込む。既に読み込み済みの場合は何もしない。 */
  external fun loadVoiceModel(vvmPath: String)

  /** 読み込み済みのVVMファイルを解放する。読み込まれていなければ何もしない。 */
  external fun unloadVoiceModel(vvmPath: String)

  /** テキストとスタイルIDから音声波形(WAV)のバイト列を合成する。 */
  external fun synthesize(text: String, styleId: Int): ByteArray
}
