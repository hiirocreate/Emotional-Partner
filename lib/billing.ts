/**
 * 有料プラン(サブスクリプション)の状態確認・決済導線をまとめたロジック。
 *
 * 「備え付けのAI」(共有プロキシ経由の対話AI)と、VOICEVOX(端末にない読み上げ
 * ボイス)は有料プラン加入者、または管理者だけが使える。
 *
 * 課金・管理者判定は、この端末で連携しているGoogleアカウントの
 * メールアドレス単位で行う(以前あった「端末ごとのランダムなコード」方式は廃止した)。
 * 具体的には、Googleサインインで得られる「IDトークン」(Googleが署名した、
 * 本人であることの証明書のようなもの)を毎回サーバー(proxy-worker)に送り、
 * サーバー側でその署名を検証してから、検証済みのメールアドレスに紐づく
 * サブスク状態を返してもらう。詳細は proxy-worker/src/googleIdToken.js、
 * README「7.」参照。
 *
 * 決済自体はStripeの決済リンク(Payment Link)に任せ、購入者のメールアドレスを
 * Stripe Checkoutが収集する。このアプリ/サーバーでは、Webhook経由で
 * Cloudflare Workers側のKVに「そのメールアドレスのサブスク状態」を反映し、
 * `/v1/billing/status` で(IDトークンで確認した)本人のメールアドレスの状態を
 * 問い合わせるだけ、というシンプルな構成にしている。
 *
 * このモジュール自体はIDトークンの取得方法(ネイティブ/Web)を知らない
 * (呼び出し側が lib/googleAuth.ts / .web.ts の getGoogleIdToken() で取得して渡す)。
 */

import {
  BILLING_SUBSCRIBE_URL,
  SHARED_PROXY_APP_SECRET,
  SHARED_PROXY_BASE_URL,
  isSharedProxyConfigured,
} from "./config";
import { BillingSettings, LicenseStatus } from "./types";

export class BillingCheckError extends Error {}

/** 現在のプランで、共有プロキシ(備え付けAI)/VOICEVOXなどの有料機能を使えるかどうか */
export function hasPaidAccess(billing: BillingSettings): boolean {
  if (billing.status === "admin") return true;
  if (billing.status === "active") {
    return billing.expiresAt == null || billing.expiresAt > Date.now();
  }
  return false;
}

/**
 * 決済ページ(Stripe決済リンク)のURLを組み立てる。
 * 連携中のGoogleアカウントのメールアドレスを `prefilled_email` として付け加えることで、
 * Stripe Checkout側の入力欄に自動で入力され、サブスク判定用のメールアドレスと
 * 決済時のメールアドレスがずれてしまう事故を防ぐ(空欄でも決済自体は可能)。
 */
export function buildSubscribeUrl(email: string | null): string {
  if (!email) return BILLING_SUBSCRIBE_URL;
  const separator = BILLING_SUBSCRIBE_URL.includes("?") ? "&" : "?";
  return `${BILLING_SUBSCRIBE_URL}${separator}prefilled_email=${encodeURIComponent(email)}`;
}

/**
 * 連携中のGoogleアカウント(IDトークンで証明されたメールアドレス)の課金状態を
 * サーバーに問い合わせる。
 *
 * @param googleIdToken - lib/googleAuth.ts(.web.ts) の getGoogleIdToken() で取得した、
 *   有効期限内のIDトークン。null の場合(未連携/期限切れ)は問い合わせを行わず
 *   "none" を返す。
 */
export async function checkBillingStatus(
  googleIdToken: string | null
): Promise<{ status: LicenseStatus; expiresAt: number | null }> {
  if (!isSharedProxyConfigured()) {
    throw new BillingCheckError(
      "共有プロキシが未設定のため、プラン状態を確認できません(アプリ配布者による設定待ちです)。"
    );
  }
  if (!googleIdToken) {
    return { status: "none", expiresAt: null };
  }

  const url = `${SHARED_PROXY_BASE_URL.replace(/\/+$/, "")}/billing/status`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "X-App-Secret": SHARED_PROXY_APP_SECRET,
        "X-Google-Id-Token": googleIdToken,
      },
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
