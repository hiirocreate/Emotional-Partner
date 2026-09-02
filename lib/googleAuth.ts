/**
 * Googleアカウント連携(サインイン)— Android/iOS向け実装。
 *
 * 「別端末でも同じGoogleアカウントでログインすれば、会話ログとAIの記憶を
 * 引き継げる」ための仕組みの入り口。実際の同期処理は lib/googleDriveSync.ts、
 * 記憶の生成は lib/memory.ts を参照。
 *
 * Web版は仕組みが大きく異なる(この公式ライブラリはWebをサポートしていない)ため
 * lib/googleAuth.web.ts に別実装がある。Metroのプラットフォーム別ファイル解決
 * (VoicevoxLocalModule.ts / .web.ts と同じ仕組み)により、Android/iOSでは
 * このファイルが、Webでは googleAuth.web.ts が自動的に使われる。
 *
 * セットアップにはGoogle Cloud ConsoleでのOAuthクライアント作成が必要。
 * 詳細はREADME「7. Googleアカウントで履歴・記憶を引き継ぐ」を参照。
 */

import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";

import { GOOGLE_DRIVE_SCOPES, GOOGLE_WEB_CLIENT_ID, isGoogleSyncConfigured } from "./config";

export class GoogleAuthError extends Error {}

export interface GoogleAuthResult {
  email: string | null;
  accessToken: string;
}

let configured = false;

function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: GOOGLE_DRIVE_SCOPES,
    offlineAccess: false,
  });
  configured = true;
}

/** このプラットフォームでGoogle連携が使える可能性があるか(設定未了は除く) */
export function isGoogleAuthSupported(): boolean {
  return true;
}

/**
 * Googleサインインを開始する。
 * 利用者がキャンセルした場合は null を返す(エラーにはしない)。
 */
export async function connectGoogleAccount(): Promise<GoogleAuthResult | null> {
  if (!isGoogleSyncConfigured()) {
    throw new GoogleAuthError(
      "Googleアカウント連携が未設定です(アプリ配布者による設定待ちです)。"
    );
  }
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const result = await GoogleSignin.signIn();
    if (!isSuccessResponse(result)) {
      return null;
    }
    const tokens = await GoogleSignin.getTokens();
    return { email: result.data.user.email ?? null, accessToken: tokens.accessToken };
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw new GoogleAuthError(
      `Googleサインインに失敗しました: ${e instanceof Error ? e.message : String(e)}`
    );
  }
}

/**
 * サインイン済みであれば、有効なアクセストークンを(必要ならサイレント再認証して)返す。
 * サインインしていない/失敗した場合は null を返す(呼び出し側は同期を諦めるだけでよい)。
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  if (!isGoogleSyncConfigured()) return null;
  ensureConfigured();
  try {
    if (!GoogleSignin.hasPreviousSignIn()) return null;
    const result = await GoogleSignin.signInSilently();
    if (result.type !== "success") return null;
    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  } catch {
    return null;
  }
}

/** Googleアカウント連携を解除する(サインアウト+アクセス取り消し) */
export async function disconnectGoogleAccount(): Promise<void> {
  ensureConfigured();
  try {
    await GoogleSignin.revokeAccess();
  } catch {
    // アクセス取り消しに失敗しても、サインアウト自体は試みる
  }
  try {
    await GoogleSignin.signOut();
  } catch {
    // 未サインイン状態などは無視してよい
  }
}
