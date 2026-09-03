import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import MetaPillRow from "@/components/meta-pill-row";
import { formatDate, formatDateTimeJa } from "@/utils/date-utils";
import { getReminderLabel, getTaskLabel, getTaskTitle, type RepeatCycleStatus } from "@/utils/task-labels";
import type { CompletedTask, LabelNames, Task } from "@/types/task";

type TaskCardVariant = "active" | "completed" | "postponed";

interface TaskCardProps {
  task: Task | CompletedTask;
  variant?: TaskCardVariant;
  labelNames: LabelNames;
  cycleStatus?: RepeatCycleStatus | null;
  onComplete?: (task: Task) => void | Promise<void>;
  onDelete?: (task: Task | CompletedTask) => void | Promise<void>;
  onEdit?: (task: Task) => void;
  // Phase3（後でやる機能）で使う。Phase2では渡す画面が無いため常にundefined＝フッターのピルは出ない。
  onPostpone?: (task: Task) => void;
}

// 既存 react-app/src/components/TaskCard.jsx のRN版。
// タスク一覧・（Phase3以降の）あとで一覧・完了済み一覧で共用する想定は変わらない。
//
// Web版との構造上の違い：
// - カード全体を包む<div onClick>とボタン側のevent.stopPropagation()の組は、RNでは丸ごと不要になる。
//   内側のPressable（完了円・削除アイコン・詳細トグル）がタッチを受け取った時点で、外側のPressable
//   （カード本体）のonPressはそもそも呼ばれないため（DOMのイベントバブリングに相当する仕組みがない）。
// - hoverで出していたtitle属性（次回まで完了済みですツールチップ）はRNに無いため削除。
//   同じ情報はcycleStatusのピル文言（次回：…）として既に見えているので実害はない。
export default function TaskCard({
  task,
  variant = "active",
  labelNames,
  cycleStatus = null,
  onComplete,
  onDelete,
  onEdit,
  onPostpone,
}: TaskCardProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  // 重要度・予定・メモなどの副次情報はデフォルトで畳んでおき、タップした人にだけ見せる。
  const [isExpanded, setIsExpanded] = useState(false);

  const labelMeta = getTaskLabel(task.color, labelNames);
  const isArchived = variant === "completed";
  const isDone = isArchived || !!cycleStatus;
  const canEdit = typeof onEdit === "function" && !isArchived;

  async function handleCompletePress() {
    if (isDone || isCompleting || typeof onComplete !== "function") return;
    setIsCompleting(true);
    try {
      await onComplete(task as Task);
    } finally {
      setIsCompleting(false);
    }
  }

  const completeCircle = (
    <Pressable
      onPress={handleCompletePress}
      disabled={isDone || isCompleting}
      hitSlop={8}
      style={[styles.completeCircle, isArchived && styles.completeCircleDone]}
      accessibilityRole="button"
      accessibilityLabel={isArchived ? "完了済み" : cycleStatus ? "次回まで完了済み" : "タスクを完了にする"}>
      {isArchived && <IconSymbol name="checkmark" size={16} color="#fff" />}
    </Pressable>
  );

  const deleteButton = onDelete && (
    <Pressable
      onPress={() => onDelete(task)}
      hitSlop={8}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel="タスクを削除">
      <IconSymbol name="trash" size={18} color="#ff3b30" />
    </Pressable>
  );

  if (variant === "completed") {
    const memo = task.memo || task.description || "";
    return (
      <View style={[styles.card, { borderLeftColor: labelMeta.color }]}>
        <View style={styles.mainRow}>
          {completeCircle}
          <View style={styles.info}>
            <Text style={[styles.title, styles.titleDone]}>{getTaskTitle(task, "無題のタスク")}</Text>
            <Text style={styles.remindText}>完了日：{formatDate((task as CompletedTask).deletedAt)}</Text>
            {task.color && task.color !== "none" && (
              <View style={styles.labelPill}>
                <Text style={[styles.labelPillText, { color: labelMeta.color }]}>{labelMeta.name}</Text>
              </View>
            )}
            {!!memo && <Text style={styles.memoText}>{memo}</Text>}
            {(task.laterCount || 0) > 0 && (
              <Text style={styles.memoText}>あとでやるから完了（{task.laterCount}回後回し）</Text>
            )}
          </View>
        </View>
        {deleteButton && <View style={styles.footer}>{deleteButton}</View>}
      </View>
    );
  }

  const later = String(task.status || "").trim() === "後でやる";
  const memo = task.memo || task.description || "";
  // 既存 atodeyaru.html 一覧モードのカードを拡張したもの：元の期限・あとでやるにした時間・
  // 後回し回数・最後に後回しにした日を追加表示する。アクションはactiveと同じ完了/あとでやる/編集/削除。
  const isPostponed = variant === "postponed";

  const detailsToggle = (
    <Pressable onPress={() => setIsExpanded((prev) => !prev)} style={styles.detailsToggle}>
      <Text style={styles.detailsToggleText}>{isExpanded ? "詳細を閉じる" : "詳細を見る"}</Text>
      <IconSymbol
        name="chevron.right"
        size={14}
        color="#8e8e93"
        style={{ transform: [{ rotate: isExpanded ? "90deg" : "0deg" }] }}
      />
    </Pressable>
  );

  return (
    <View style={[styles.card, { borderLeftColor: labelMeta.color }]}>
      <Pressable style={styles.mainRow} onPress={canEdit ? () => onEdit!(task as Task) : undefined} disabled={!canEdit}>
        {completeCircle}
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <View style={[styles.colorDot, { backgroundColor: labelMeta.color }]} />
            <Text style={styles.title}>{getTaskTitle(task, "(無題)")}</Text>
          </View>

          {isPostponed ? (
            <Text style={styles.remindText}>
              📅 元の期限：{task.dueDate || task.date || "未設定"}
              {task.dueTime ? ` ${task.dueTime}` : ""}
            </Text>
          ) : (
            <>
              <Text style={styles.remindText}>📅 {getReminderLabel(task)}</Text>
              {cycleStatus ? (
                <View style={[styles.statusPill, styles.statusPillCycle]}>
                  <Text style={styles.statusPillText}>次回：{formatDateTimeJa(cycleStatus.nextDueDate)}</Text>
                </View>
              ) : (
                <View style={[styles.statusPill, later ? styles.statusPillLater : styles.statusPillPending]}>
                  <Text style={styles.statusPillText}>{later ? "後でやる" : "未完了"}</Text>
                </View>
              )}
            </>
          )}

          {detailsToggle}
          {isExpanded && (
            <View style={styles.detailsPanel}>
              <MetaPillRow task={task as Task} labelNames={labelNames} />
              <Text style={styles.memoText}>メモ：{memo || "なし"}</Text>
              {isPostponed && (
                <>
                  <Text style={styles.memoText}>あとでやるにした時間：{task.laterTime || "未設定"}</Text>
                  <Text style={styles.memoText}>後回しにした回数：{task.laterCount || 0}回</Text>
                  <Text style={styles.memoText}>
                    最後に後回しにした日：{formatDate(task.lastPostponedAt, "記録なし")}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      </Pressable>

      {(!isDone || deleteButton) && (
        <View style={styles.footer}>
          {!isDone && typeof onPostpone === "function" && (
            <Pressable onPress={() => onPostpone(task as Task)} style={styles.postponePill}>
              <Text style={styles.postponePillText}>🕒 あとでやる</Text>
            </Pressable>
          )}
          {deleteButton}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  mainRow: { flexDirection: "row", gap: 10 },
  info: { flex: 1, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  titleDone: { color: "#8e8e93", textDecorationLine: "line-through" },
  remindText: { fontSize: 13, color: "#6b6b70" },
  memoText: { fontSize: 13, color: "#6b6b70" },
  completeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#c7c7cc",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  completeCircleDone: { backgroundColor: "#34c759", borderColor: "#34c759" },
  iconButton: { padding: 6 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5ea",
  },
  postponePill: {
    backgroundColor: "#f1e8d9",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  postponePillText: { fontSize: 13, fontWeight: "600", color: "#6b6b70" },
  statusPill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  statusPillText: { fontSize: 11.5, fontWeight: "700" },
  statusPillPending: { backgroundColor: "#eef4ff" },
  statusPillLater: { backgroundColor: "#fff4e5" },
  statusPillCycle: { backgroundColor: "#eafaf0" },
  detailsToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  detailsToggleText: { fontSize: 12, color: "#8e8e93", fontWeight: "600" },
  detailsPanel: { marginTop: 4, gap: 4 },
  labelPill: { alignSelf: "flex-start", backgroundColor: "#f1e8d9", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  labelPillText: { fontSize: 11.5, fontWeight: "800" },
});
