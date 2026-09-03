import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import PostponeLimitModal from '@/components/postpone-limit-modal';
import PostponeMessage from '@/components/postpone-message';
import PostponeTimeSelector from '@/components/postpone-time-selector';
import { POSTPONE_LIMIT, usePostponeTask } from '@/hooks/use-postpone-task';
import { pickPostponeMessage } from '@/utils/postpone-messages';
import { getTaskTitle } from '@/utils/task-labels';

// 既存 react-app/src/pages/PostponePage.jsx のExpo版。
// messageType（「後でやる」メッセージのトーン設定）はPhase4で通知設定画面を作るまで固定で"normal"を使う
// （Web版の実際のフォールバック値 (settings?.messageType) || "normal" と同じデフォルト）。
// 設定読み込み待ちが無くなった分、Web版にあった「設定の読み込み完了後に1回だけ抽選する」という
// 2段階の同期は不要になり、素直な遅延初期化のuseStateだけで済む。
export default function PostponeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { task, isLoading, error, isSaving, postpone, doNow } = usePostponeTask(id);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [pendingLaterTime, setPendingLaterTime] = useState<string | null>(null);
  const [isLimitModalVisible, setIsLimitModalVisible] = useState(false);
  const [pickedMessage] = useState(() => pickPostponeMessage('normal'));

  if (!id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>対象のタスクが指定されていません。</Text>
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkButtonText}>タスク一覧へ戻る</Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>タスクの取得に失敗しました。時間をおいて再度お試しください。</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          対象のタスクが見つかりませんでした。すでに完了・削除されているか、URLが正しくない可能性があります。
        </Text>
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkButtonText}>タスク一覧へ戻る</Text>
        </Pressable>
      </View>
    );
  }

  async function commitPostpone(laterTime: string) {
    try {
      await postpone(laterTime);
      router.back();
    } catch {
      Alert.alert('後でやる設定の保存に失敗しました。時間をおいて再度お試しください。');
    }
  }

  async function handleSelect(laterTime: string) {
    // 上のif (!task) returnによる絞り込みは、この関数（クロージャ）の中までは効かないため再ガードする。
    if (isSaving || !task) return;
    setSelectedValue(laterTime);

    if ((task.laterCount || 0) >= POSTPONE_LIMIT) {
      setPendingLaterTime(laterTime);
      setIsLimitModalVisible(true);
      return;
    }

    await commitPostpone(laterTime);
  }

  async function handleDoNow() {
    if (isSaving) return;
    setIsLimitModalVisible(false);
    try {
      await doNow();
      router.back();
    } catch {
      Alert.alert('更新に失敗しました。時間をおいて再度お試しください。');
    }
  }

  // 上限モーダルの「期限を変更する」：このpostpone画面自体もモーダル表示のため、上に別のモーダルを
  // 積むpushではなく、現在のスタック位置をtask/[id]へ置き換えるreplaceを使う。こうすることで、
  // 編集フォームを保存/キャンセルしてrouter.back()した時に、postpone画面へは戻らず
  // 呼び出し元（タスク一覧・あとでタブ等）へ直接戻る（後でやるフロー自体は「変更」で終了する意図のため）。
  function handleEditDue() {
    setIsLimitModalVisible(false);
    router.replace({ pathname: '/task/[id]', params: { id } });
  }

  async function handleConfirmPostpone() {
    setIsLimitModalVisible(false);
    if (pendingLaterTime) await commitPostpone(pendingLaterTime);
  }

  return (
    <View style={styles.container}>
      <PostponeMessage taskTitle={getTaskTitle(task, '無題のタスク')} message={pickedMessage} />
      <PostponeTimeSelector selectedValue={selectedValue} onSelect={handleSelect} disabled={isSaving} />

      <Pressable style={styles.cancelButton} onPress={() => router.back()} disabled={isSaving}>
        <Text style={styles.cancelButtonText}>キャンセルして一覧へ戻る</Text>
      </Pressable>

      <PostponeLimitModal
        visible={isLimitModalVisible}
        laterCount={task.laterCount || 0}
        isSaving={isSaving}
        onDoNow={handleDoNow}
        onEditDue={handleEditDue}
        onConfirmPostpone={handleConfirmPostpone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24, gap: 16 },
  errorText: { color: '#ff3b30', textAlign: 'center' },
  cancelButton: { marginTop: 32, alignItems: 'center', paddingVertical: 14 },
  cancelButtonText: { color: '#8e8e93', fontSize: 15 },
  linkButton: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: '#f2f2f7', borderRadius: 10 },
  linkButtonText: { color: '#0a84ff', fontSize: 15, fontWeight: '600' },
});
