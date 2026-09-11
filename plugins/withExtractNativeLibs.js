// modules/voicevox-local (内蔵VOICEVOX) は、ONNX Runtime(推論ライブラリ)の.soファイルを
// voicevox_core(Rust)側からファイルパス指定でdlopenする方式を使っている
// (VoicevoxLocalModule.kt: `File(nativeLibraryDir, "libvoicevox_onnxruntime.so").absolutePath`)。
//
// 一方、Android Gradle Pluginの新しめのデフォルト(targetSdkVersion 23以降かつ
// `android:extractNativeLibs` を明示しない場合)では、ネイティブライブラリはAPK内に
// 圧縮されたまま置かれ、インストール時にファイルとして展開されない
// ("非展開"モード)。このモードでは `ApplicationInfo.nativeLibraryDir` が
// `/data/app/.../base.apk!/lib/arm64-v8a` のような、実ディスク上には存在しない
// 疑似パス(APKアーカイブ内を指すだけの文字列)を返す。
//
// `System.loadLibrary()` はAndroidの特別なローダー機構でこの疑似パスを正しく
// 解釈できるが、voicevox_core側が行う素の`dlopen(path)`はこれを理解できず、
// 「推論ライブラリのロードまたは初期化ができませんでした」
// (VOICEVOX_RESULT_INIT_INFERENCE_RUNTIME_ERROR)エラーになる。
//
// `android:extractNativeLibs="true"` を明示すると、インストール時に.soファイルが
// 実ディスク上に展開されるようになり、`nativeLibraryDir` が本物のディレクトリパスに
// なるため、この問題を回避できる(アプリのインストール容量はやや増えるが、
// 音声合成用のONNX Runtime/VOICEVOX CORE/OpenJTalk辞書を実機で正しく動かすために必要)。
//
// `expo prebuild` はAndroidManifest.xmlを毎回作り直すため、この設定はExpoの
// config pluginとして書いて app.json の "plugins" に登録しておく必要がある
// (生成後のファイルを直接書き換えても次回のprebuildで消えてしまうため)。
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withExtractNativeLibs(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$["android:extractNativeLibs"] = "true";
    }
    return config;
  });
};
