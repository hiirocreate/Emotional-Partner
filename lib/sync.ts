/**
 * Googleドライブとの同期オーケストレーション(起動時の取り込み・送信ごとのアップロード)。
 *
 * lib/googleAuth.ts(トークン取得)とlib/googleDriveSync.ts(Drive REST API)を
 * 組み合わせ、失敗しても例外を投げずに「同期できなかっただけ」として扱う
 * (会話自体は同期の成否に関わらず端末内で普通に続けられる)。
 */

import { getGoogleAccessToken } from "./googleAuth";
import { downloadSyncedData, uploadSyncedData } from "./googleDriveSync";
import { saveHistory, saveSettings } from "./storage";
import { AppSettings, ChatMessage } from "./types";

function localUpdatedAt(settings: AppSettings, messages: ChatMessage[]): number {
  const lastMessageAt = messages.length ? messages[messages.length - 1].createdAt : 0;
  return Math.max(lastMessageAt, settings.userMemory.updatedAt ?? 0);
}

export interface SyncPullResult {
  settings: AppSettings;
  messages: ChatMessage[];
  pulledFromDrive: boolean;
}

/**
 * 起動時に呼ぶ。Googleドライブ側のデータが端末内より新しければ取り込む。
 * 未サインイン/トークン取得失敗(Web版でアクセストークンの有効期限切れの場合を含む)
 * の場合は何もしない。
 */
export async function pullFromDriveIfNewer(
  settings: AppSettings,
  messages: ChatMessage[]
): Promise<SyncPullResult> {
  if (!settings.google.connected) {
    return { settings, messages, pulledFromDrive: false };
  }
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) {
    return { settings, messages, pulledFromDrive: false };
  }
  try {
    const remote = await downloadSyncedData(accessToken);
    if (!remote || remote.updatedAt <= localUpdatedAt(settings, messages)) {
      return { settings, messages, pulledFromDrive: false };
    }
    const nextSettings: AppSettings = {
      ...settings,
      userMemory: remote.memory,
      google: { ...settings.google, lastSyncedAt: Date.now() },
    };
    await saveHistory(remote.history);
    await saveSettings(nextSettings);
    return { settings: nextSettings, messages: remote.history, pulledFromDrive: true };
  } catch {
    return { settings, messages, pulledFromDrive: false };
  }
}

/**
 * 会話が進むたびに呼ぶ、失敗しても無視してよいバックグラウンドアップロード。
 * 戻り値の設定(lastSyncedAt更新済み)を呼び出し側でstateに反映する。
 */
export async function pushToDriveInBackground(
  settings: AppSettings,
  messages: ChatMessage[]
): Promise<AppSettings> {
  if (!settings.google.connected) return settings;
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return settings;
  try {
    await uploadSyncedData(accessToken, {
      history: messages,
      memory: settings.userMemory,
      updatedAt: Date.now(),
    });
    const nextSettings: AppSettings = {
      ...settings,
      google: { ...settings.google, lastSyncedAt: Date.now() },
    };
    await saveSettings(nextSettings);
    return nextSettings;
  } catch {
    return settings;
  }
}
