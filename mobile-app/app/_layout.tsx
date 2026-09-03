import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import CelebrationToast from '@/components/celebration-toast';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

// 既存 react-app/src/components/ProtectedRoute.jsx + App.jsx のルーティング部分に相当。
// Expo Router (SDK52以降) の Stack.Protected を使い、認証状態に応じて表示するグループを
// 自動的に振り分ける（未ログインで保護画面のディープリンクを開いても login へリダイレクトされる）。
function RootNavigator() {
  const { currentUser, isLoading } = useAuth();

  // Web版の「読み込み中」表示に相当。認証状態が確定するまでは何も描画しない。
  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!currentUser}>
        <Stack.Screen name="(tabs)" />
        {/* タスク登録・編集はFAB(＋ボタン)からモーダルで開く。フォーム自体が保存/キャンセル/削除
            ボタンを持つため、ネイティブヘッダーの戻るボタンは出さない（headerShown: false）。 */}
        <Stack.Screen name="task/new" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="task/[id]" options={{ presentation: 'modal', headerShown: false }} />
        {/* 後でやる時刻選択も同じくモーダル。画面自体に「キャンセルして一覧へ戻る」があるためヘッダーは出さない。 */}
        <Stack.Screen name="postpone/[id]" options={{ presentation: 'modal', headerShown: false }} />
        {/* 完了済みタスク・実績は設定タブからの導線で開く読み取り中心の画面のため、モーダルではなく
            ネイティブヘッダー＋戻るジェスチャーの通常push画面にする。 */}
        <Stack.Screen name="completed" options={{ headerShown: true, title: '完了済みタスク' }} />
        <Stack.Screen name="stats" options={{ headerShown: true, title: '実績' }} />
      </Stack.Protected>

      <Stack.Protected guard={!currentUser}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    // components/frequency-slider.tsx がreact-native-gesture-handlerのPanジェスチャーを使うため、
    // ライブラリの要件通りアプリ全体をGestureHandlerRootViewで包む。
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <RootNavigator />
          <StatusBar style="auto" />
          {/* utils/celebrate.ts のイベントを購読するグローバルなトースト。画面をまたいで1つだけ表示する。 */}
          <CelebrationToast />
        </ThemeProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
