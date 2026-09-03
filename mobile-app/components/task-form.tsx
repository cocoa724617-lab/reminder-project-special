import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import CalendarDatePicker from "@/components/calendar-date-picker";
import FrequencySlider from "@/components/frequency-slider";
import SegmentedControl from "@/components/segmented-control";
import TimeSelect from "@/components/time-select";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/contexts/auth-context";
import { useLabelNames, useTask } from "@/hooks/use-tasks";
import { deleteTask, saveTask } from "@/services/task-service";
import { toDateKey } from "@/utils/date-utils";
import { TASK_LABELS, getTaskLabel, normalizeImportance, normalizeUrgency } from "@/utils/task-labels";
import type {
  FixedReminder,
  FixedReminderUnit,
  NotificationVolume,
  RepeatFrequency,
  Task,
  TaskColor,
  TaskPriority,
  TaskUrgency,
} from "@/types/task";

const FIXED_REMINDER_GROUPS: { unit: FixedReminderUnit; label: string; values: number[] }[] = [
  { unit: "minutes", label: "分前", values: [1, 2, 3, 4, 5, 10, 15, 30] },
  { unit: "hours", label: "時間前", values: [1, 2, 3, 4, 8, 12] },
  { unit: "days", label: "日前", values: [1, 2, 3, 4, 5, 6] },
  { unit: "weeks", label: "週間前", values: [1, 2, 3, 4] },
];
const FIXED_REMINDER_UNITS = new Set<FixedReminderUnit>(FIXED_REMINDER_GROUPS.map((group) => group.unit));

// 期限からの相対オフセットとして計算できない古い形式（絶対日時 {date, time}）のデータは無視する。
function sanitizeFixedReminders(value: unknown): FixedReminder[] {
  return Array.isArray(value)
    ? value.filter(
        (r): r is FixedReminder =>
          !!r && typeof r === "object" && FIXED_REMINDER_UNITS.has(r.unit) && Number.isFinite(Number(r.value)),
      )
    : [];
}

function clampFrequencyCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(10, Math.max(1, Math.round(value)));
}

// 既存 task-form.html の legacyFrequencyFromCount と同じ仕様：
// 新しい「回数」入力を、通知バックエンドが今も参照する旧 small/medium/large 表現に変換する。
function legacyFrequencyFromCount(count: number): NotificationVolume {
  if (count <= 3) return "small";
  if (count <= 7) return "medium";
  return "large";
}

interface TaskFormState {
  name: string;
  color: TaskColor;
  priority: TaskPriority;
  urgency: TaskUrgency;
  description: string;
  dueDate: string;
  dueTimeEnabled: boolean;
  dueTime: string;
  repeatEnabled: boolean;
  repeatFrequency: Exclude<RepeatFrequency, "none">;
  notifyEnabled: boolean;
  frequencyUnit: "day" | "week";
  frequencyCount: number;
  fixedReminders: FixedReminder[];
}

const emptyFormState: TaskFormState = {
  name: "",
  color: "none",
  priority: "medium",
  urgency: "today",
  description: "",
  dueDate: "",
  dueTimeEnabled: false,
  dueTime: "18:00",
  repeatEnabled: false,
  repeatFrequency: "weekly",
  notifyEnabled: true,
  frequencyUnit: "day",
  frequencyCount: 3,
  fixedReminders: [],
};

// 既存 task-form.html の populateForm と同じフォールバック仕様で、編集対象タスクをフォームの初期値へ変換する。
function buildFormFromTask(existingTask: Task): TaskFormState {
  const freq = existingTask.frequency || "medium";
  const fallbackCount = freq === "small" ? 1 : freq === "large" ? 6 : 3;
  const repeat = existingTask.repeat && existingTask.repeat !== "none" ? existingTask.repeat : "weekly";

  return {
    name: existingTask.name || existingTask.title || "",
    color: existingTask.color || "none",
    priority: normalizeImportance(existingTask.priority || existingTask.importance || existingTask.priorityLevel || "medium"),
    urgency: normalizeUrgency(existingTask.urgency),
    description: existingTask.description || existingTask.memo || "",
    dueDate: existingTask.dueDate || existingTask.date || "",
    dueTimeEnabled: !!existingTask.dueTime,
    dueTime: existingTask.dueTime || "18:00",
    repeatEnabled: !!existingTask.repeat && existingTask.repeat !== "none",
    repeatFrequency: repeat as Exclude<RepeatFrequency, "none">,
    notifyEnabled: existingTask.enabled !== false,
    frequencyUnit: existingTask.frequencyUnit || existingTask.randomFrequencyUnit || "day",
    frequencyCount: clampFrequencyCount(existingTask.frequencyCount || existingTask.randomFrequencyCount || fallbackCount),
    fixedReminders: sanitizeFixedReminders(existingTask.fixedReminders),
  };
}

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];
const URGENCY_OPTIONS: { value: TaskUrgency; label: string }[] = [
  { value: "today", label: "今日やる" },
  { value: "thisWeek", label: "今週中" },
  { value: "whenFree", label: "余裕があれば" },
];
const REPEAT_OPTIONS: { value: Exclude<RepeatFrequency, "none">; label: string }[] = [
  { value: "daily", label: "毎日" },
  { value: "weekly", label: "毎週" },
  { value: "monthly", label: "毎月" },
  { value: "yearly", label: "毎年" },
];

// 既存 react-app/src/pages/TaskFormPage.jsx のRN版。app/task/new.tsx と app/task/[id].tsx の
// 両方から呼ばれる共通フォーム（editIdの有無で新規/編集を切り替える）。
export default function TaskForm({ editId }: { editId?: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { task: existingTask, isLoading, error } = useTask(editId);
  const { labelNames } = useLabelNames();

  const [form, setForm] = useState<TaskFormState>(emptyFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [isNotifyDetailsOpen, setIsNotifyDetailsOpen] = useState(false);

  // Web版はレンダー中に「反映済みのtaskId」を比較する特殊なテクニックでフォームへ反映していたが、
  // RN版はtask/[id]へのナビゲーションごとに新しい画面インスタンスが作られる（パラメータが
  // 画面を維持したまま変わることが無い）ため、素直な useEffect で1回だけ反映すれば十分。
  useEffect(() => {
    if (existingTask) {
      setForm(buildFormFromTask(existingTask));
      setIsNotifyDetailsOpen(sanitizeFixedReminders(existingTask.fixedReminders).length > 0);
    }
  }, [existingTask]);

  function updateField<K extends keyof TaskFormState>(key: K, value: TaskFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function shiftDueDate(days: number) {
    const base = form.dueDate ? new Date(`${form.dueDate}T00:00:00`) : new Date();
    base.setDate(base.getDate() + days);
    updateField("dueDate", toDateKey(base));
  }

  // オフセットは期限（日付+時刻）を基準に計算するため、両方揃っていないと選べない。
  const canUseFixedReminders = !!form.dueDate && form.dueTimeEnabled;

  function toggleFixedReminderOption(unit: FixedReminderUnit, value: number) {
    setForm((prev) => {
      const isSelected = prev.fixedReminders.some((r) => r.unit === unit && r.value === value);
      const fixedReminders = isSelected
        ? prev.fixedReminders.filter((r) => !(r.unit === unit && r.value === value))
        : [...prev.fixedReminders, { unit, value }];
      return { ...prev, fixedReminders };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) {
      Alert.alert("タスク名を入力してください");
      return;
    }
    if (!currentUser) return;

    const frequency: NotificationVolume = form.notifyEnabled ? legacyFrequencyFromCount(form.frequencyCount) : "none";

    const taskObj: Omit<Partial<Task>, "id"> & { id: string | null } = {
      ...(existingTask || {}),
      id: editId || null,
      name: form.name,
      title: form.name,
      description: form.description,
      memo: form.description,
      enabled: form.notifyEnabled,
      status: existingTask?.status || "未完了",
      frequency,
      frequencyUnit: form.frequencyUnit,
      frequencyCount: form.frequencyCount,
      priority: form.priority,
      urgency: form.urgency,
      color: form.color,
      dueDate: form.dueDate || null,
      dueTime: form.dueTimeEnabled ? form.dueTime : null,
      repeat: form.repeatEnabled ? form.repeatFrequency : "none",
      // 実際のリマインダー予約(remindersコレクション)はCloud Functions側(onTaskWritten)が
      // このdueDate/dueTime/fixedRemindersから計算して作り直す。
      fixedReminders: canUseFixedReminders ? form.fixedReminders : [],
    };

    setIsSaving(true);
    try {
      await saveTask(currentUser.uid, taskObj);
      // Web版は保存後に alert("保存しました") を挟んでいたが、RNではモーダルが閉じること自体が
      // 保存完了の合図になるため、ブロッキングな確認ダイアログは省略している。
      router.back();
    } catch (err) {
      console.error("タスクの保存に失敗しました:", err);
      Alert.alert("保存に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDelete() {
    if (!currentUser || !editId) return;
    Alert.alert("このタスクを削除しますか？", "この操作は取り消せません。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTask(currentUser.uid, editId);
            router.back();
          } catch (err) {
            console.error("タスクの削除に失敗しました:", err);
            Alert.alert("削除に失敗しました。時間をおいて再度お試しください。");
          }
        },
      },
    ]);
  }

  if (editId && isLoading) {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.screenTitle}>{editId ? "タスクを編集" : "タスクを追加"}</Text>

      <TextInput
        style={styles.nameInput}
        placeholder="タスク名を入力"
        value={form.name}
        onChangeText={(text) => updateField("name", text)}
      />

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>色ラベル</Text>
        <View style={styles.colorRow}>
          {Object.entries(TASK_LABELS).map(([key, meta]) => {
            const isSelected = form.color === key;
            return (
              <Pressable
                key={key}
                onPress={() => updateField("color", key as TaskColor)}
                style={[styles.colorSwatch, { backgroundColor: meta.color }]}
                accessibilityLabel={labelNames[key as Exclude<TaskColor, "none">] || meta.name}>
                {isSelected && <IconSymbol name="checkmark" size={16} color="#fff" />}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.colorLabelText}>{getTaskLabel(form.color, labelNames).name}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>重要度</Text>
        <SegmentedControl options={PRIORITY_OPTIONS} value={form.priority} onChange={(v) => updateField("priority", v)} />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>優先度</Text>
        <SegmentedControl options={URGENCY_OPTIONS} value={form.urgency} onChange={(v) => updateField("urgency", v)} />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>メモ</Text>
        <TextInput
          style={styles.memoInput}
          placeholder="補足があれば自由に書けます"
          value={form.description}
          onChangeText={(text) => updateField("description", text)}
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={[styles.field, styles.sectionDivider]}>
        <Text style={styles.fieldLabel}>期限</Text>
        <View style={styles.dueDateRow}>
          <Pressable onPress={() => shiftDueDate(-1)} hitSlop={8} style={styles.dueDateSideButton} accessibilityLabel="前日">
            <Text style={styles.dueDateSideButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.dueDateValue}>{form.dueDate || "未設定"}</Text>
          <Pressable onPress={() => shiftDueDate(1)} hitSlop={8} style={styles.dueDateSideButton} accessibilityLabel="翌日">
            <Text style={styles.dueDateSideButtonText}>›</Text>
          </Pressable>
        </View>
        <CalendarDatePicker value={form.dueDate} onChange={(dateStr) => updateField("dueDate", dateStr)} />

        <View style={styles.switchRow}>
          <Text style={styles.fieldLabel}>時刻を指定する</Text>
          <Switch value={form.dueTimeEnabled} onValueChange={(v) => updateField("dueTimeEnabled", v)} />
        </View>
        {form.dueTimeEnabled && <TimeSelect value={form.dueTime} onChange={(timeStr) => updateField("dueTime", timeStr)} />}
      </View>

      <View style={[styles.field, styles.switchRow]}>
        <Text style={styles.fieldLabel}>繰り返す</Text>
        <Switch value={form.repeatEnabled} onValueChange={(v) => updateField("repeatEnabled", v)} />
      </View>
      {form.repeatEnabled && (
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>繰り返す頻度</Text>
          <SegmentedControl options={REPEAT_OPTIONS} value={form.repeatFrequency} onChange={(v) => updateField("repeatFrequency", v)} />
        </View>
      )}

      <View style={[styles.field, styles.switchRow, styles.sectionDivider]}>
        <Text style={styles.fieldLabel}>通知する</Text>
        <Switch value={form.notifyEnabled} onValueChange={(v) => updateField("notifyEnabled", v)} />
      </View>

      {form.notifyEnabled && (
        <View style={styles.field}>
          <Pressable onPress={() => setIsNotifyDetailsOpen((prev) => !prev)} style={styles.disclosureHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>通知の詳細設定</Text>
              <Text style={styles.disclosureSummary}>
                （{form.frequencyUnit === "week" ? `1週間に${form.frequencyCount}回` : `1日に${form.frequencyCount}回`}
                {form.fixedReminders.length > 0 && ` ・固定${form.fixedReminders.length}件`}）
              </Text>
            </View>
            <IconSymbol
              name="chevron.right"
              size={14}
              color="#8e8e93"
              style={{ transform: [{ rotate: isNotifyDetailsOpen ? "90deg" : "0deg" }] }}
            />
          </Pressable>

          {isNotifyDetailsOpen && (
            <View style={styles.disclosurePanel}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>ランダム通知の回数</Text>
                <SegmentedControl
                  options={[
                    { value: "day" as const, label: "1日" },
                    { value: "week" as const, label: "1週間" },
                  ]}
                  value={form.frequencyUnit}
                  onChange={(v) => updateField("frequencyUnit", v)}
                />
                <FrequencySlider value={form.frequencyCount} onChange={(v) => updateField("frequencyCount", clampFrequencyCount(v))} />
                <Text style={styles.hintText}>
                  {form.frequencyUnit === "week"
                    ? `1週間に${form.frequencyCount}回くらいランダム通知`
                    : `1日に${form.frequencyCount}回くらいランダム通知`}
                </Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>必ず通知する時間</Text>
                {!canUseFixedReminders ? (
                  <Text style={styles.hintText}>期限の日付と時刻を設定すると選べるようになります。</Text>
                ) : (
                  FIXED_REMINDER_GROUPS.map((group) => (
                    <View key={group.unit} style={styles.fixedReminderGroup}>
                      <Text style={styles.fixedReminderGroupLabel}>{group.label}</Text>
                      <View style={styles.fixedReminderOptionRow}>
                        {group.values.map((value) => {
                          const isSelected = form.fixedReminders.some((r) => r.unit === group.unit && r.value === value);
                          return (
                            <Pressable
                              key={value}
                              onPress={() => toggleFixedReminderOption(group.unit, value)}
                              style={[styles.fixedReminderOption, isSelected && styles.fixedReminderOptionSelected]}>
                              <Text style={[styles.fixedReminderOptionText, isSelected && styles.fixedReminderOptionTextSelected]}>
                                {value}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </View>
      )}

      <Pressable style={styles.saveButton} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>保存する</Text>}
      </Pressable>
      <Pressable style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>キャンセル</Text>
      </Pressable>
      {!!editId && (
        <Pressable style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>設定を削除</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, paddingBottom: 48, gap: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#ff3b30", textAlign: "center", paddingHorizontal: 24 },
  screenTitle: { fontSize: 20, fontWeight: "700", color: "#1c1c1e" },
  nameInput: {
    borderWidth: 1,
    borderColor: "#d1d1d6",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  field: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#1c1c1e" },
  sectionDivider: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e5e5ea" },
  colorRow: { flexDirection: "row", gap: 10 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  colorLabelText: { fontSize: 13, color: "#6b6b70" },
  memoInput: {
    borderWidth: 1,
    borderColor: "#d1d1d6",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 72,
    textAlignVertical: "top",
  },
  dueDateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  dueDateSideButton: { padding: 8 },
  dueDateSideButtonText: { fontSize: 20, color: "#0a84ff" },
  dueDateValue: { fontSize: 16, fontWeight: "700", color: "#1c1c1e" },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  disclosureHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  disclosureSummary: { fontSize: 12, color: "#8e8e93", marginTop: 2 },
  disclosurePanel: { gap: 18, marginTop: 12 },
  hintText: { fontSize: 12, color: "#8e8e93" },
  fixedReminderGroup: { gap: 6, marginTop: 8 },
  fixedReminderGroupLabel: { fontSize: 12, color: "#8e8e93", fontWeight: "600" },
  fixedReminderOptionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fixedReminderOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f2f2f7",
  },
  fixedReminderOptionSelected: { backgroundColor: "#0a84ff" },
  fixedReminderOptionText: { fontSize: 13, color: "#1c1c1e" },
  fixedReminderOptionTextSelected: { color: "#fff", fontWeight: "700" },
  saveButton: {
    backgroundColor: "#0a84ff",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { paddingVertical: 14, alignItems: "center" },
  cancelButtonText: { color: "#0a84ff", fontSize: 16 },
  deleteButton: { paddingVertical: 14, alignItems: "center" },
  deleteButtonText: { color: "#ff3b30", fontSize: 15 },
});
