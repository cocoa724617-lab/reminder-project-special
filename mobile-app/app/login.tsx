import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { resetPassword, signInWithEmail, signUpWithEmail, translateAuthError } from '@/services/auth-service';

type Mode = 'login' | 'signup' | 'reset';

// 既存 react-app/src/pages/LoginPage.jsx のExpo版。
// Phase1時点ではメール/パスワードのみ（Googleログインは未実装、後日ネイティブ設定込みで対応予定）。
// ログイン/新規登録に成功すると currentUser が変化し、ルートの Stack.Protected が自動的に
// index 画面へ切り替える（このファイル側から明示的に画面遷移する必要はない）。
// スタイリングはPhase2で他画面と合わせて作り直す前提の暫定UI。
export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetMessages() {
    setError('');
    setInfo('');
  }

  function switchMode(nextMode: Mode) {
    resetMessages();
    setMode(nextMode);
  }

  async function handleSubmit() {
    resetMessages();
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else if (mode === 'signup') {
        await signUpWithEmail(email, password);
      } else {
        await resetPassword(email);
        setInfo('パスワード再設定用のメールを送信しました。');
      }
    } catch (err) {
      console.error('認証エラー:', err);
      setError(translateAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>ログインしてはじめる</Text>
          <Text style={styles.subtitle}>メールアドレスでログインしてください</Text>

          <TextInput
            style={styles.input}
            placeholder="メールアドレス"
            placeholderTextColor="#8e8e93"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />

          {mode !== 'reset' && (
            <TextInput
              style={styles.input}
              placeholder="パスワード（6文字以上）"
              placeholderTextColor="#8e8e93"
              secureTextEntry
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
              value={password}
              onChangeText={setPassword}
            />
          )}

          <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'ログイン' : mode === 'signup' ? '登録する' : '再設定メールを送る'}
              </Text>
            )}
          </Pressable>

          <View style={styles.linksRow}>
            {mode !== 'login' && (
              <Pressable onPress={() => switchMode('login')}>
                <Text style={styles.link}>ログインはこちら</Text>
              </Pressable>
            )}
            {mode !== 'signup' && (
              <Pressable onPress={() => switchMode('signup')}>
                <Text style={styles.link}>新規登録はこちら</Text>
              </Pressable>
            )}
            {mode !== 'reset' && (
              <Pressable onPress={() => switchMode('reset')}>
                <Text style={styles.link}>パスワードを忘れた場合</Text>
              </Pressable>
            )}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!info && <Text style={styles.info}>{info}</Text>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f2f2f7' },
  flex: { flex: 1, justifyContent: 'center' },
  card: { gap: 12, paddingHorizontal: 24 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6b6b70', textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#0a84ff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  linksRow: { gap: 8, marginTop: 8, alignItems: 'center' },
  link: { color: '#0a84ff', fontSize: 14 },
  error: { color: '#ff3b30', fontSize: 14, textAlign: 'center' },
  info: { color: '#34c759', fontSize: 14, textAlign: 'center' },
});
