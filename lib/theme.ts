import { BillingSettings, ThemePresetId, ThemeSettings } from "./types";

/**
 * 配色テーマの解決ロジック。
 *
 * - 無料ユーザー: 常に既存(標準)配色。presetId/customColorsに何が入っていても無視する
 *   (過去にサブスク/管理者だった端末が失効した場合の保険にもなる)。
 * - サブスク(有料プラン)ユーザー: プリセットから選んだ配色。
 * - 管理者: customColorsが設定されていればそれを最優先。無ければプリセット扱い。
 */

export interface ThemeColors {
  /** 画面の背景色 */
  baseColor: string;
  /** ボタン・アクティブなチップなどのアクセントカラー */
  buttonColor: string;
  /** 見出し・本文の基本テキストカラー */
  textColor: string;
}

export const DEFAULT_THEME_COLORS: ThemeColors = {
  baseColor: "#FFFFFF",
  buttonColor: "#4A7DFF",
  textColor: "#26263A",
};

export const THEME_PRESETS: Record<
  Exclude<ThemePresetId, "default">,
  ThemeColors & { label: string }
> = {
  ocean: { label: "オーシャン", baseColor: "#F0F8FF", buttonColor: "#2F8FD9", textColor: "#123A52" },
  sunset: { label: "サンセット", baseColor: "#FFF6EE", buttonColor: "#FF7A45", textColor: "#5A3018" },
  forest: { label: "フォレスト", baseColor: "#F1F8F0", buttonColor: "#3F9152", textColor: "#1F3B22" },
  lavender: { label: "ラベンダー", baseColor: "#F5F0FF", buttonColor: "#8A63D2", textColor: "#332255" },
  mono: { label: "モノトーン", baseColor: "#F5F5F7", buttonColor: "#3A3A44", textColor: "#1C1C22" },
};

export const THEME_PRESET_LIST: Array<{ id: ThemePresetId } & ThemeColors & { label: string }> = [
  { id: "default", label: "標準", ...DEFAULT_THEME_COLORS },
  ...(Object.keys(THEME_PRESETS) as Array<Exclude<ThemePresetId, "default">>).map((id) => ({
    id,
    ...THEME_PRESETS[id],
  })),
];

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

/**
 * 管理者向けの自由配色を、カラーコードの手入力ではなくタップで選べるようにするための色見本。
 * 役割ごとに見やすい範囲の色だけを並べている(ベースは淡い色、ボタンは目立つ色、
 * テキストは読みやすい濃い色)。
 */
export const BASE_COLOR_SWATCHES: string[] = [
  "#FFFFFF",
  "#F7F7FA",
  "#F5F5F7",
  "#EAF3FF",
  "#F0F8FF",
  "#FFF6EE",
  "#FFFDE7",
  "#F1F8F0",
  "#EFFBF6",
  "#F5F0FF",
  "#FFF0F5",
  "#F6F1E7",
];

export const BUTTON_COLOR_SWATCHES: string[] = [
  "#4A7DFF",
  "#2F8FD9",
  "#00A3A3",
  "#26A69A",
  "#3F9152",
  "#8BC34A",
  "#F2A93B",
  "#FF7A45",
  "#FF5A5F",
  "#E0527A",
  "#EC6BAD",
  "#8A63D2",
  "#5C6BC0",
  "#3A3A44",
];

export const TEXT_COLOR_SWATCHES: string[] = [
  "#26263A",
  "#1C1C22",
  "#000000",
  "#123A52",
  "#1F3B22",
  "#332255",
  "#4A2130",
  "#5A3018",
  "#3A2E00",
  "#212121",
];

export function resolveThemeColors(theme: ThemeSettings, billing: BillingSettings): ThemeColors {
  const isAdmin = billing.status === "admin";
  const isSubscriber = isAdmin || billing.status === "active";

  if (!isSubscriber) {
    // 無料ユーザーは常に標準配色
    return DEFAULT_THEME_COLORS;
  }

  if (isAdmin && theme.customColors) {
    const c = theme.customColors;
    return {
      baseColor: isValidHexColor(c.baseColor) ? c.baseColor : DEFAULT_THEME_COLORS.baseColor,
      buttonColor: isValidHexColor(c.buttonColor) ? c.buttonColor : DEFAULT_THEME_COLORS.buttonColor,
      textColor: isValidHexColor(c.textColor) ? c.textColor : DEFAULT_THEME_COLORS.textColor,
    };
  }

  if (theme.presetId !== "default") {
    const preset = THEME_PRESETS[theme.presetId as Exclude<ThemePresetId, "default">];
    if (preset) return { baseColor: preset.baseColor, buttonColor: preset.buttonColor, textColor: preset.textColor };
  }

  return DEFAULT_THEME_COLORS;
}
