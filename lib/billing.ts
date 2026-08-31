/**
 * 有料プラン(サブスクリプション)の状態確認・決済導線をまとめたロジック。
 *
 * 「備え付けのAI」(共有プロキシ経由の対話AI)と、VOICEVOX(端末にない読み上げ
 * ボイス)は有料プラン加入者、または管理者コードを持つ管理者だけが使える。
 *
 * 決済自体はStripeの決済リンク(Payment Link)に任せ、このアプリ/サーバーでは
 * 「この端末のコード」をStripeの client_reference_id として受け渡し、
 * Webhook経由でCloudflare Workers側のKVに反映されたサブスク状態を
 * `/v1/billing/status` で問い合わせるだけ、というシンプルな構成にしている。
 *
 * 管理者は、この「コード」欄に(Stripeを経由せず)管理者コードを直接入力する。
 * サーバー側で ADMIN_CODE と一致するかどうかだけを見て "admin" 判定するため、
 * 課金なしで全機能を使える。
 */

import { BILLING_SUBSCRIBE_URL, SHARED_PROXY_APP_SECRET, SHARED_PROXY_BASE_URL, isSharedProxyConfigured } from "./config";
import { BillingSettings, LicenseStatus } from "./types";

export class BillingCheckError extends Error {}

/** この端末用の新しい識別コードを生成する(購入時にStripeへ渡すreference ID) */
export function generateLicenseCode(): string {
  const group = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KTLK-${group()}-${group()}`;
}

/** 現在のプランで、共有プロキシ(備え付けAI)/VOICEVOXなどの有料機能を使えるかどうか */
export function hasPaidAccess(billing: BillingSettings): boolean {
  if (billing.status === "admin") return true;
  if (billing.status === "active") {
    return billing.expiresAt == null || billing.expiresAt > Date.now();
  }
  return false;
}

/** 決済ページ(Stripe決済リンク)のURLを、この端末のコード付きで組み立てる */
export function buildSubscribeUrl(licenseCode: string): string {
  const separator = BILLING_SUBSCRIBE_URL.includes("?") ? "&" : "?";
  return `${BILLING_SUBSCRIBE_URL}${separator}client_reference_id=${encodeURIComponent(licenseCode)}`;
}

/** 入力されたコード(購入時のコード、または管理者コード)の状態をサーバーに問い合わせる */
export async function checkLicenseStatus(
  code: string
): Promise<{ status: LicenseStatus; expiresAt: number | null }> {
  if (!isSharedProxyConfigured()) {
    throw new BillingCheckError(
      "共有プロキシが未設定のため、プラン状態を確認できません(アプリ配布者による設定待ちです)。"
    );
  }
  const trimmed = code.trim();
  if (!trimmed) {
    return { status: "none", expiresAt: null };
  }

  const url = `${SHARED_PROXY_BASE_URL.replace(/\/+$/, "")}/billing/status?code=${encodeURIComponent(trimmed)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-App-Secret": SHARED_PROXY_APP_SECRET },
    });
  } catch {
    throw new BillingCheckError("プラン状態の確認中にネットワークエラーが発生しました。");
  }
  if (!res.ok) {
    throw new BillingCheckError(`プラン状態の確認に失敗しました(status ${res.status})。`);
  }

  let data: { status?: string; expiresAt?: number | null };
  try {
    data = await res.json();
  } catch {
    throw new BillingCheckError("サーバーからの応答を解釈できませんでした。");
  }

  const status: LicenseStatus =
    data.status === "admin" || data.status === "active" ? data.status : "none";
  return { status, expiresAt: data.expiresAt ?? null };
}
