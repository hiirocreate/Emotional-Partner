import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#EAF3FF" },
          headerTitleStyle: { fontSize: 17, fontWeight: "600" },
          headerTintColor: "#26263A",
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "EmPa" }} />
        <Stack.Screen name="settings" options={{ title: "設定" }} />
        <Stack.Screen name="oauth/openrouter" options={{ title: "接続中…", headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
