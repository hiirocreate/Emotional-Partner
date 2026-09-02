// voicevox_core (https://github.com/VOICEVOX/voicevox_core, MIT License) のC APIを
// Kotlin(expo.modules.voicevoxlocal.VoicevoxNative)から呼び出すための薄いJNIラッパー。
//
// 呼び出し順序(Kotlin側で保証する):
//   1. initializeEngine(dictDir, onnxruntimePath) を一度だけ呼ぶ
//   2. loadVoiceModel(vvmPath) でVVMファイルを読み込む(複数可)
//   3. synthesize(text, styleId) で読み込み済みスタイルのテキストを音声合成する
//   4. 不要になったら unloadVoiceModel(vvmPath) で解放する
//
// このファイル単体では実機/エミュレータでのビルド・実行検証ができていないため、
// 初回ビルドで問題が出た場合はGitHub Actionsのログを共有してほしい。
// (README「6. VOICEVOXをアプリに内蔵する(Android限定・実験的機能)」参照)

#include <jni.h>
#include <string>
#include <vector>
#include <mutex>

#include "voicevox_core.h"

namespace {

std::mutex g_mutex;

const VoicevoxOnnxruntime *g_onnxruntime = nullptr;
OpenJtalkRc *g_open_jtalk = nullptr;
VoicevoxSynthesizer *g_synthesizer = nullptr;

struct LoadedModel {
  std::string path;
  VoicevoxVoiceModelFile *handle;
  uint8_t id[16];
};

std::vector<LoadedModel> g_models;

void ThrowRuntimeException(JNIEnv *env, const std::string &message) {
  jclass exClass = env->FindClass("java/lang/RuntimeException");
  if (exClass != nullptr) {
    env->ThrowNew(exClass, message.c_str());
  }
}

bool ThrowIfError(JNIEnv *env, VoicevoxResultCode result) {
  if (result == VOICEVOX_RESULT_OK) {
    return false;
  }
  ThrowRuntimeException(env, voicevox_error_result_to_message(result));
  return true;
}

std::string JStringToUtf8(JNIEnv *env, jstring value) {
  const char *chars = env->GetStringUTFChars(value, nullptr);
  std::string result(chars);
  env->ReleaseStringUTFChars(value, chars);
  return result;
}

LoadedModel *FindLoadedModel(const std::string &path) {
  for (auto &model : g_models) {
    if (model.path == path) {
      return &model;
    }
  }
  return nullptr;
}

}  // namespace

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_voicevoxlocal_VoicevoxNative_initializeEngine(
    JNIEnv *env, jobject /*thiz*/, jstring j_dict_dir, jstring j_onnxruntime_path) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_synthesizer != nullptr) {
    return;  // 初期化済み(再初期化はしない)
  }

  const std::string dict_dir = JStringToUtf8(env, j_dict_dir);
  const std::string onnxruntime_path = JStringToUtf8(env, j_onnxruntime_path);

  VoicevoxLoadOnnxruntimeOptions ort_options =
      voicevox_make_default_load_onnxruntime_options();
  ort_options.filename = onnxruntime_path.c_str();

  VoicevoxResultCode result =
      voicevox_onnxruntime_load_once(ort_options, &g_onnxruntime);
  if (ThrowIfError(env, result)) return;

  result = voicevox_open_jtalk_rc_new(dict_dir.c_str(), &g_open_jtalk);
  if (ThrowIfError(env, result)) return;

  VoicevoxInitializeOptions init_options = voicevox_make_default_initialize_options();
  // e2-microのような非力なサーバーと違い、実機のCPUをそのまま使う想定。
  // 0を指定すると環境に合わせた数(voicevox_core側で決定)が使われる。
  init_options.cpu_num_threads = 0;

  result = voicevox_synthesizer_new(g_onnxruntime, g_open_jtalk, init_options, &g_synthesizer);
  ThrowIfError(env, result);
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_voicevoxlocal_VoicevoxNative_loadVoiceModel(
    JNIEnv *env, jobject /*thiz*/, jstring j_vvm_path) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_synthesizer == nullptr) {
    ThrowRuntimeException(env, "initializeEngineが先に呼ばれていません");
    return;
  }

  const std::string vvm_path = JStringToUtf8(env, j_vvm_path);
  if (FindLoadedModel(vvm_path) != nullptr) {
    return;  // 既に読み込み済み
  }

  VoicevoxVoiceModelFile *model = nullptr;
  VoicevoxResultCode result = voicevox_voice_model_file_open(vvm_path.c_str(), &model);
  if (ThrowIfError(env, result)) return;

  LoadedModel entry;
  entry.path = vvm_path;
  entry.handle = model;
  voicevox_voice_model_file_id(model, &entry.id);

  VoicevoxLoadVoiceModelOptions load_options =
      voicevox_make_default_load_voice_model_options();
  result = voicevox_synthesizer_load_voice_model(g_synthesizer, model, load_options);
  if (ThrowIfError(env, result)) {
    voicevox_voice_model_file_delete(model);
    return;
  }

  g_models.push_back(entry);
}

extern "C" JNIEXPORT void JNICALL
Java_expo_modules_voicevoxlocal_VoicevoxNative_unloadVoiceModel(
    JNIEnv *env, jobject /*thiz*/, jstring j_vvm_path) {
  std::lock_guard<std::mutex> lock(g_mutex);
  const std::string vvm_path = JStringToUtf8(env, j_vvm_path);

  for (size_t i = 0; i < g_models.size(); i++) {
    if (g_models[i].path != vvm_path) continue;

    if (g_synthesizer != nullptr) {
      // VoicevoxVoiceModelId は `const uint8_t (*)[16]` (16バイト配列へのポインタ)
      // という型のため、配列そのものではなく `&...id` を渡す必要がある。
      voicevox_synthesizer_unload_voice_model(g_synthesizer, &g_models[i].id);
    }
    voicevox_voice_model_file_delete(g_models[i].handle);
    g_models.erase(g_models.begin() + static_cast<long>(i));
    return;
  }
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_expo_modules_voicevoxlocal_VoicevoxNative_synthesize(
    JNIEnv *env, jobject /*thiz*/, jstring j_text, jint style_id) {
  std::lock_guard<std::mutex> lock(g_mutex);
  if (g_synthesizer == nullptr) {
    ThrowRuntimeException(env, "initializeEngineが先に呼ばれていません");
    return nullptr;
  }

  const std::string text = JStringToUtf8(env, j_text);

  VoicevoxTtsOptions tts_options = voicevox_make_default_tts_options();

  uintptr_t wav_length = 0;
  uint8_t *wav = nullptr;
  VoicevoxResultCode result = voicevox_synthesizer_tts(
      g_synthesizer, text.c_str(), static_cast<VoicevoxStyleId>(style_id), tts_options,
      &wav_length, &wav);
  if (ThrowIfError(env, result)) {
    return nullptr;
  }

  jbyteArray output = env->NewByteArray(static_cast<jsize>(wav_length));
  if (output != nullptr) {
    env->SetByteArrayRegion(output, 0, static_cast<jsize>(wav_length),
                             reinterpret_cast<const jbyte *>(wav));
  }
  voicevox_wav_free(wav);
  return output;
}
