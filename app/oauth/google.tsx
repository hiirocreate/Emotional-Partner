import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";

/**
 * GoogleのOAuthログイン完了後に一瞬だけ表示される中継ページ(Web版のみ使用)。
 *
 * 実際のトークン受け渡しは lib/googleAuth.web.ts の
 * WebBrowser.openAuthSessionAsync が、このページのURL(リダイレクト先として
 * Google Cloud Consoleに登録したもの)を検知した時点で処理するため、
 * ここでは「閉じてよい」ことを示す簡単な表示だけを行う。
 */
export default function GoogleOAuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4A7DFF" />
      <Text style={styles.text}>Googleアカウントとの接続を完了しています…</Text>
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
