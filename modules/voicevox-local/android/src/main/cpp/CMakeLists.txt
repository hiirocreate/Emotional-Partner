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
