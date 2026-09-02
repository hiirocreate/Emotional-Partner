import { registerWebModule, NativeModule } from 'expo';

// Web/iOSでは未対応(Android限定の機能)。呼び出し側は必ずPlatform.OS === 'android'
// でガードしてから使うこと(lib/localVoicevox.ts参照)。万一呼ばれた場合のフォールバック。
class VoicevoxLocalModule extends NativeModule<{}> {
  async initializeEngine(): Promise<void> {
    throw new Error('VoicevoxLocalはAndroid限定の機能です');
  }
  async loadVoiceModel(_vvmPath: string): Promise<void> {
    throw new Error('VoicevoxLocalはAndroid限定の機能です');
  }
  async unloadVoiceModel(_vvmPath: string): Promise<void> {
    throw new Error('VoicevoxLocalはAndroid限定の機能です');
  }
  async synthesize(_text: string, _styleId: number): Promise<string> {
    throw new Error('VoicevoxLocalはAndroid限定の機能です');
  }
}

export default registerWebModule(VoicevoxLocalModule, 'VoicevoxLocalModule');
