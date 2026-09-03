import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import LabelNameSettings from '@/components/label-name-settings';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth-context';
import { useLabelNames } from '@/hooks/use-tasks';
import { saveLabelNames } from '@/services/user-service';
import { normalizeLabelNames } from '@/utils/task-labels';
import type { LabelNames } from '@/types/task';

// 既存 react-app/src/pages/NotificationSettingsPage.jsx のうち、Phase3で扱う「色ラベルの名前」部分と、
// 完了済みタスク・実績への導線をまとめた設定タブ本実装。
// 通知時間帯・後でやるメッセージのトーン・通知許可などはPhase4（通知関連の移植）で追加する。
// app/index.tsx（Phase1の確認画面）を削除した際に引き継いだログアウトはそのまま残す。
export default function SettingsScreen() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const { labelNames, refetch: refetchLabelNames } = useLabelNames();

  const [form, setForm] = useState<LabelNames>({});
  const [isSaving, setIsSaving] = useState(false);

  // labelNamesの読み込み完了時にフォームへ反映する（task-form.tsxの既存タスク反映と同じ1回だけのuseEffect）。
  useEffect(() => {
    setForm(labelNames);
  }, [labelNames]);

  async function handleSaveLabelNames() {
    if (!currentUser || isSaving) return;
    setIsSaving(true);
    try {
      const normalized = normalizeLabelNames(form);
      await saveLabelNames(currentUser.uid, normalized);
      // 保存直後にHome/タスク一覧/あとでタブへ戻った時に最新の名前を拾えるよう、まずここでも取得し直す。
      await refetchLabelNames();
      Alert.alert('保存しました');
    } catch (err) {
      console.error('ラベル名の保存に失敗しました:', err);
      Alert.alert('保存に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setIsSaving(false);
    }
  }

  function handleLogout() {
    Alert.alert('ログアウトしますか？', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'ログアウト', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.email}>{currentUser?.email}</Text>

      <View style={styles.card}>
        <LabelNameSettings labelNames={form} onChange={setForm} />
        <Pressable style={styles.saveButton} onPress={handleSaveLabelNames} disabled={isSaving}>
          {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>保存</Text>}
        </Pressable>
      </View>

      <View style={styles.linkCard}>
        <Pressable style={styles.linkRow} onPress={() => router.push('/completed')}>
          <Text style={styles.linkText}>完了済みタスク</Text>
          <IconSymbol name="chevron.right" size={16} color="#c7c7cc" />
        </Pressable>
        <View style={styles.linkDivider} />
        <Pressable style={styles.linkRow} onPress={() => router.push('/stats')}>
          <Text style={styles.linkText}>実績を見る</Text>
          <IconSymbol name="chevron.right" size={16} color="#c7c7cc" />
        </Pressable>
      </View>

      <Text style={styles.note}>通知設定などはPhase4で追加予定です。</Text>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  content: { padding: 20, gap: 20, paddingBottom: 48 },
  email: { fontSize: 15, color: '#1c1c1e', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 16 },
  saveButton: { backgroundColor: '#0a84ff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  linkCard: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: { fontSize: 15, color: '#1c1c1e' },
  linkDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5ea', marginLeft: 16 },
  note: { fontSize: 12, color: '#8e8e93' },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff3b30',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});
