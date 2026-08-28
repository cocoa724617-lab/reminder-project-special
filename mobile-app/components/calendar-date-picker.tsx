import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const CELL_WIDTH = `${100 / 7}%` as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function parseDateStr(value: string | null | undefined): { y: number; m: number; d: number } | null {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

interface CalendarDatePickerProps {
  value?: string | null;
  onChange: (dateStr: string) => void;
}

// 既存 react-app/src/components/CalendarDatePicker.jsx のRN版。
// 常時表示のカレンダーグリッドから日付を選ぶ。valueは"YYYY-MM-DD"、onChangeにも同形式で返す。
// Web版はレンダー中に value !== syncedValue を比較して表示月を同期する特殊なテクニック
// （Reactの「レンダー中に安全にstateを更新する」公式パターン）を使っていたが、このコンポーネントは
// 今回RN向けに新規で書き起こすため、素直な useEffect による同期に置き換えている。
export default function CalendarDatePicker({ value, onChange }: CalendarDatePickerProps) {
  const today = new Date();
  const parsedValue = parseDateStr(value);
  const [viewYear, setViewYear] = useState(parsedValue?.y ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedValue?.m ?? today.getMonth() + 1);

  useEffect(() => {
    const parsed = parseDateStr(value);
    if (parsed) {
      setViewYear(parsed.y);
      setViewMonth(parsed.m);
    }
  }, [value]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.navButton} accessibilityLabel="前の月">
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {viewYear}年{viewMonth}月
        </Text>
        <Pressable onPress={() => shiftMonth(1)} hitSlop={8} style={styles.navButton} accessibilityLabel="次の月">
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <Text key={label} style={styles.weekdayText}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, index) => {
          if (day === null) return <View key={`blank-${index}`} style={styles.cell} />;
          const dateStr = toDateStr(viewYear, viewMonth, day);
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;
          return (
            <Pressable
              key={dateStr}
              onPress={() => onChange(dateStr)}
              style={[styles.cell, styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]}>
              <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navButton: { padding: 8 },
  navButtonText: { fontSize: 20, color: "#0a84ff" },
  title: { fontSize: 15, fontWeight: "700", color: "#1c1c1e" },
  weekdayRow: { flexDirection: "row" },
  weekdayText: { width: CELL_WIDTH, textAlign: "center", fontSize: 12, color: "#8e8e93" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: CELL_WIDTH, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayCell: { borderRadius: 999 },
  dayCellSelected: { backgroundColor: "#0a84ff" },
  dayCellToday: { borderWidth: 1, borderColor: "#0a84ff" },
  dayText: { fontSize: 14, color: "#1c1c1e" },
  dayTextSelected: { color: "#fff", fontWeight: "700" },
});
