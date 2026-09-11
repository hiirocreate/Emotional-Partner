cmake_minimum_required(VERSION 3.22)
project(voicevox_jni)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# voicevox_core のAndroid向けビルド済み共有ライブラリ。
# GitHub Actions側のビルドで公式Downloaderが取得し、
# android/src/main/jniLibs/${ANDROID_ABI}/libvoicevox_core.so に配置してから
# ビルドする想定(README/.github/workflows/build-apk.yml参照)。
set(VOICEVOX_CORE_LIB_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../jniLibs/${ANDROID_ABI}")

add_library(voicevox_jni SHARED
  voicevox_jni.cpp
)

target_include_directories(voicevox_jni PRIVATE include)

# ONNX Runtimeを実行時にファイルパス指定でロードする方式(voicevox_onnxruntime_load_once)を使うため、
# ヘッダ側にそのAPI群を有効化させる必要がある(未定義だとコンパイルエラーになる)。
target_compile_definitions(voicevox_jni PRIVATE VOICEVOX_LOAD_ONNXRUNTIME)

find_library(log-lib log)

# voicevox_core(Rust製cdylib)のビルド済み.soにはSONAME(DT_SONAME)が
# 埋め込まれていない。この状態でリンカに「フルパスの.soファイル」をそのまま
# 渡すと(以前の add_library(... IMPORTED) + IMPORTED_LOCATION 方式)、
# リンカはDT_SONAMEが無いことのフォールバックとして「リンク時に渡された
# 文字列そのもの」をDT_NEEDEDに焼き込む。その文字列はCIランナー上のビルド時
# 絶対パス(/home/runner/work/...)になってしまうため、実機では当然
# 見つからず dlopen failed: library "/home/runner/work/.../libvoicevox_core.so"
# not found という実行時エラーになっていた(実際にホスト環境のgcc/lldで
# 再現・検証済み)。
#
# 対策として、フルパスではなく `-L<ディレクトリ> -l:libvoicevox_core.so`
# という「名前指定」でリンクする。この場合、DT_SONAMEが無い.soに対しても
# リンカは「-l:の後に書かれた文字列そのもの」をDT_NEEDEDとして使うため、
# 常に "libvoicevox_core.so" という名前だけが記録される。この名前は
# APK内の実際の配置場所(lib/${ANDROID_ABI}/libvoicevox_core.so、
# libvoicevox_jni.soと同じディレクトリ)とAndroidのリンカが解決できる形で一致する。
target_link_directories(voicevox_jni PRIVATE ${VOICEVOX_CORE_LIB_DIR})

target_link_libraries(voicevox_jni
  -l:libvoicevox_core.so
  ${log-lib}
)
