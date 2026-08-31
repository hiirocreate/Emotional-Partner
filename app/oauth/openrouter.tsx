import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

/**
 * OpenRouterのOAuthログイン完了後に一瞬だけ表示される中継ページ。
 *
 * 実際のAPIキー受け渡しは lib/openrouterOAuth.ts の
 * WebBrowser.openAuthSessionAsync が、このページのURL(リダイレクト先)を
 * 検知した時点で処理するため、ここでは「閉じてよい」ことを示す簡単な
 * 表示だけを行う。Web版ではこのポップアップは自動的に閉じられる。
 */
export default function OpenRouterOAuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2F5BD9" />
      <Text style={styles.text}>OpenRouterとの接続を完了しています…</Text>
      <Text style={styles.subText}>
        このまま自動的にアプリに戻ります。戻らない場合はこのタブを閉じてください。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
    gap: 12,
  },
  text: { fontSize: 15, fontWeight: "600", color: "#26263A" },
  subText: { fontSize: 12, color: "#8A8AA0", textAlign: "center" },
});
