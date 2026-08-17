import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

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
        <Stack.Screen name="index" />
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
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <RootNavigator />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
