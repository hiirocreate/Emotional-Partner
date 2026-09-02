package expo.modules.voicevoxlocal

import android.net.Uri
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/** APK内(assets/voicevox_dict/)に同梱したOpenJTalk辞書の展開先ディレクトリ名 */
private const val DICT_ASSET_DIR = "voicevox_dict"
private const val ONNXRUNTIME_SO_NAME = "libvoicevox_onnxruntime.so"

/**
 * VOICEVOX CORE (https://github.com/VOICEVOX/voicevox_core, MIT License) を
 * 端末上で直接実行し、サーバー通信なしで音声合成するためのExpoモジュール(Android限定)。
 *
 * - voicevox_core本体・ONNX Runtimeはビルド時にjniLibsとして同梱する
 *   (.github/workflows/build-apk.yml参照)。
 * - OpenJTalk辞書もビルド時にassetsとして同梱し、初回利用時に内部ストレージへ展開する。
 * - VVM音声モデルファイルは同梱せず、利用者が設定画面から個別にダウンロードする
 *   (lib/localVoicevox.ts参照。有料プラン/管理者限定)。
 */
class VoicevoxLocalModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("VoicevoxLocal")

    // 辞書の展開とエンジンの初期化をまとめて行う(冪等)。JS側はパスを意識しなくてよい。
    AsyncFunction("initializeEngine") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("ReactContextを取得できませんでした")

      val dictDir = ensureDictionaryExtracted(context.filesDir)
      val nativeLibDir = context.applicationInfo.nativeLibraryDir
        ?: throw IllegalStateException("nativeLibraryDirを取得できませんでした")
      val onnxruntimePath = File(nativeLibDir, ONNXRUNTIME_SO_NAME).absolutePath

      VoicevoxNative.initializeEngine(dictDir, onnxruntimePath)
    }

    // JS側からは expo-file-system の File#uri (file://... 形式) をそのまま渡してもらい、
    // ここでvoicevox_core(Rust)が期待する素のファイルパスに変換する。
    AsyncFunction("loadVoiceModel") { vvmUri: String ->
      VoicevoxNative.loadVoiceModel(uriToPath(vvmUri))
    }

    AsyncFunction("unloadVoiceModel") { vvmUri: String ->
      VoicevoxNative.unloadVoiceModel(uriToPath(vvmUri))
    }

    // JS側にはWAVデータをbase64文字列で返す(既存のGoogle Cloud TTS経路と同じ形で
    // lib/base64.ts の base64ToBytes でそのままデコードできるようにするため)。
    AsyncFunction("synthesize") { text: String, styleId: Int ->
      val wavBytes = VoicevoxNative.synthesize(text, styleId)
      Base64.encodeToString(wavBytes, Base64.NO_WRAP)
    }
  }

  /** expo-file-systemの `file:///...` URI文字列を、voicevox_core(Rust)が期待する素のパスに変換する。 */
  private fun uriToPath(uri: String): String {
    return Uri.parse(uri).path ?: uri
  }

  /**
   * assets/voicevox_dict/ 以下をfilesDir/voicevox_dict/ へ展開する(初回のみ、以降はスキップ)。
   * OpenJTalkは実ファイルパスを要求するため、APK内のassetsを直接は渡せない。
   */
  private fun ensureDictionaryExtracted(filesDir: File): String {
    val destRoot = File(filesDir, DICT_ASSET_DIR)
    val doneMarker = File(destRoot, ".extracted")
    if (doneMarker.exists()) {
      return destRoot.absolutePath
    }

    val assetManager = appContext.reactContext?.assets
      ?: throw IllegalStateException("AssetManagerを取得できませんでした")

    fun copyRecursively(assetPath: String, destDir: File) {
      val entries = assetManager.list(assetPath) ?: emptyArray()
      if (entries.isEmpty()) {
        // ファイル(これ以上list出来ない)とみなしてコピーする
        destDir.parentFile?.mkdirs()
        assetManager.open(assetPath).use { input ->
          destDir.outputStream().use { output -> input.copyTo(output) }
        }
        return
      }
      destDir.mkdirs()
      for (entry in entries) {
        copyRecursively("$assetPath/$entry", File(destDir, entry))
      }
    }

    destRoot.mkdirs()
    copyRecursively(DICT_ASSET_DIR, destRoot)
    doneMarker.writeText("ok")
    return destRoot.absolutePath
  }
}
