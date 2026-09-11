cmake_minimum_required(VERSION 3.22)
project(voicevox_jni)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# voicevox_core のAndroid向けビルド済み共有ライブラリ。
# GitHub Actions側のビルドで公式Downloaderが取得し、
# android/src/main/jniLibs/${ANDROID_ABI}/libvoicevox_core.so に配置してから
# ビルドする想定(README/.github/workflows/build-apk.yml参照)。
add_library(voicevox_core SHARED IMPORTED)
set_target_properties(voicevox_core PROPERTIES
  IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}/libvoicevox_core.so"
  # IMPORTED_SONAMEを明示しないと、リンカがIMPORTED_LOCATIONのビルド時の絶対パス
  # (CIランナー上の /home/runner/work/... のようなパス)をそのままvoicevox_jni.so の
  # DT_NEEDEDに焼き込んでしまうことがある。その場合、実機では当然その絶対パスが
  # 存在しないため、実際にはAPKに同梱されているlibvoicevox_core.so自体は正しい場所
  # (lib/${ANDROID_ABI}/)にあるにもかかわらず
  # 「dlopen failed: library "/home/runner/work/.../libvoicevox_core.so" not found」
  # という実行時エラーになる。SONAMEを"libvoicevox_core.so"(ファイル名のみ)に
  # 固定することで、DT_NEEDEDには名前だけが記録されるようになり、Androidのリンカが
  # 同じネイティブライブラリ namespace(APK内のlib/${ANDROID_ABI}/)から正しく
  # 解決できるようになる。
  IMPORTED_SONAME "libvoicevox_core.so"
)

add_library(voicevox_jni SHARED
  voicevox_jni.cpp
)

target_include_directories(voicevox_jni PRIVATE include)

# ONNX Runtimeを実行時にファイルパス指定でロードする方式(voicevox_onnxruntime_load_once)を使うため、
# ヘッダ側にそのAPI群を有効化させる必要がある(未定義だとコンパイルエラーになる)。
target_compile_definitions(voicevox_jni PRIVATE VOICEVOX_LOAD_ONNXRUNTIME)

find_library(log-lib log)

target_link_libraries(voicevox_jni
  voicevox_core
  ${log-lib}
)
