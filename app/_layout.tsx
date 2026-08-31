import { useEffect, useState } from "react";
import { Stack, usePathname } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { loadSettings } from "../lib/storage";
import { DEFAULT_THEME_COLORS, resolveThemeColors, ThemeColors } from "../lib/theme";

export default function RootLayout() {
  // 画面遷移のたびに設定を読み直すことで、設定画面でテーマを変更した直後から
  // ヘッダーの配色にも反映されるようにする(ルートレイアウトはアプリ全体で
  // 1度しかマウントされないため)。
  const pathname = usePathname();
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_THEME_COLORS);

  useEffect(() => {
    loadSettings().then((s) => setColors(resolveThemeColors(s.theme, s.billing)));
  }, [pathname]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.baseColor },
          headerTitleStyle: { fontSize: 17, fontWeight: "600" },
          headerTintColor: colors.textColor,
          contentStyle: { backgroundColor: colors.baseColor },
        }}
      >
        <Stack.Screen name="index" options={{ title: "EmPa" }} />
        <Stack.Screen name="settings" options={{ title: "設定" }} />
        <Stack.Screen name="oauth/openrouter" options={{ title: "接続中…", headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
