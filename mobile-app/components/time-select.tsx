import { useEffect, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const PANEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTimeStr(value: string | null | undefined): { hour: number; minute: number } {
  const match = String(value || "").match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Math.min(23, Number(match[1])), minute: Math.min(59, Number(match[2])) };
}

interface TimeSelectProps {
  value?: string | null;
  onChange: (timeStr: string) => void;
}

// 既存 react-app/src/components/TimeSelect.jsx のRN版。
// Web版は時・分それぞれ独立した<select>（ネイティブのドロップダウン）だったが、RNには標準部品が無いため、
// 2列の縦スクロールリストとして自作している。選択中の値は行のハイライト＋マウント時の自動スクロールで示す
// （新しいネイティブ依存は増やさない）。
export default function TimeSelect({ value, onChange }: TimeSelectProps) {
  const { hour, minute } = parseTimeStr(value);
  const hourScrollRef = useRef<ScrollView>(null);
  const minuteScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // マウント時点の値へ一度だけスクロールする（以降はユーザーのスクロール操作を尊重し、
    // 選択中セルの再レンダーのたびに勝手にスクロール位置を戻さない）。
    hourScrollRef.current?.scrollTo({ y: hour * ROW_HEIGHT, animated: false });
    minuteScrollRef.current?.scrollTo({ y: minute * ROW_HEIGHT, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(nextHour: number, nextMinute: number) {
    onChange(`${pad2(nextHour)}:${pad2(nextMinute)}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.panelWrapper}>
        <ScrollView
          ref={hourScrollRef}
          style={styles.panel}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast">
          {Array.from({ length: 24 }, (_, h) => (
            <Pressable key={h} style={styles.row} onPress={() => update(h, minute)}>
              <Text style={[styles.rowText, h === hour && styles.rowTextSelected]}>{pad2(h)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.colon}>:</Text>

      <View style={styles.panelWrapper}>
        <ScrollView
          ref={minuteScrollRef}
          style={styles.panel}
          showsVerticalScrollIndicator={false}
          snapToInterval={ROW_HEIGHT}
          decelerationRate="fast">
          {Array.from({ length: 60 }, (_, m) => (
            <Pressable key={m} style={styles.row} onPress={() => update(hour, m)}>
              <Text style={[styles.rowText, m === minute && styles.rowTextSelected]}>{pad2(m)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  panelWrapper: { height: PANEL_HEIGHT, width: 72, borderRadius: 10, backgroundColor: "#f2f2f7", overflow: "hidden" },
  panel: { flex: 1 },
  row: { height: ROW_HEIGHT, alignItems: "center", justifyContent: "center" },
  rowText: { fontSize: 16, color: "#8e8e93" },
  rowTextSelected: { color: "#0a84ff", fontWeight: "700", fontSize: 18 },
  colon: { fontSize: 20, fontWeight: "700", color: "#1c1c1e" },
});
