/**
 * Googleドライブの「アプリ専用の非公開領域」(appDataFolder)への保存・読み込み。
 *
 * appDataFolder は利用者の通常のドライブ画面には一切表示されない、
 * このアプリだけがアクセスできる隠しスペース。会話履歴とAIの記憶を
 * 1つのJSONファイルにまとめて保存し、別端末で同じGoogleアカウントに
 * サインインした際にそのファイルを読み込むことで引き継ぐ。
 *
 * REST APIを直接fetchで叩くだけの薄い実装(専用SDKは使わない、この
 * プロジェクトの既存方針=軽量なライブラリのみ、に合わせている)。
 */

import { ChatMessage, UserMemorySettings } from "./types";

const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
const SYNC_FILE_NAME = "empa_sync_v1.json";

export class GoogleDriveSyncError extends Error {}

export interface SyncedData {
  /** 直近の会話履歴(端末内保存と同じ形式・同じ件数上限) */
  history: ChatMessage[];
  memory: UserMemorySettings;
  /** このデータが最後に更新された時刻(UNIXミリ秒)。端末間のどちらが新しいかの判定に使う */
  updatedAt: number;
}

async function findSyncFile(accessToken: string): Promise<{ id: string } | null> {
  const url =
    `${DRIVE_FILES_URL}?spaces=appDataFolder` +
    `&q=${encodeURIComponent(`name = '${SYNC_FILE_NAME}'`)}` +
    `&fields=${encodeURIComponent("files(id)")}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new GoogleDriveSyncError(`Googleドライブの検索に失敗しました(status ${res.status})`);
  }
  const data: { files?: Array<{ id: string }> } = await res.json();
  const first = data.files?.[0];
  return first ? { id: first.id } : null;
}

/**
 * Googleドライブに保存されているデータを取得する。
 * まだ一度も同期していない(ファイルが存在しない)場合は null を返す。
 */
export async function downloadSyncedData(accessToken: string): Promise<SyncedData | null> {
  const file = await findSyncFile(accessToken);
  if (!file) return null;

  const res = await fetch(`${DRIVE_FILES_URL}/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new GoogleDriveSyncError(`Googleドライブからの読み込みに失敗しました(status ${res.status})`);
  }
  try {
    const parsed = await res.json();
    if (
      parsed &&
      Array.isArray(parsed.history) &&
      typeof parsed.updatedAt === "number" &&
      parsed.memory
    ) {
      return parsed as SyncedData;
    }
    return null;
  } catch {
    return null;
  }
}

/** Googleドライブにデータを保存する(新規作成/上書きどちらも自動判定) */
export async function uploadSyncedData(accessToken: string, data: SyncedData): Promise<void> {
  const existing = await findSyncFile(accessToken);
  const boundary = `empa_sync_${Date.now()}`;
  const metadata = existing ? {} : { name: SYNC_FILE_NAME, parents: ["appDataFolder"] };
  const content = JSON.stringify(data);

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const url = existing
    ? `${DRIVE_UPLOAD_URL}/${existing.id}?uploadType=multipart`
    : `${DRIVE_UPLOAD_URL}?uploadType=multipart`;

  const res = await fetch(url, {
    method: existing ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) {
    throw new GoogleDriveSyncError(`Googleドライブへの保存に失敗しました(status ${res.status})`);
  }
}
