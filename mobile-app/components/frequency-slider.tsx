import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

const MIN_VALUE = 1;
const MAX_VALUE = 10;
const THUMB_SIZE = 28;

interface FrequencySliderProps {
  value: number;
  onChange: (value: number) => void;
}

// 既存 react-app/src/pages/TaskFormPage.jsx の <input type="range" min="1" max="10"> に相当。
// RNには標準のスライダー部品が無く、新しいネイティブ依存を増やさない方針のため、既にインストール済みの
// react-native-gesture-handler / react-native-reanimated だけで1〜10の離散値ドラッグスライダーを自作している。
export default function FrequencySlider({ value, onChange }: FrequencySliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const position = useSharedValue(0);
  const stepWidth = trackWidth > THUMB_SIZE ? (trackWidth - THUMB_SIZE) / (MAX_VALUE - MIN_VALUE) : 0;

  function handleLayout(event: LayoutChangeEvent) {
    setTrackWidth(event.nativeEvent.layout.width);
  }

  // トラック幅が確定した直後、および外部からvalueが変わった場合（編集時の初期値ロードなど）に
  // つまみの位置を追従させる。
  useEffect(() => {
    if (stepWidth <= 0) return;
    position.value = withSpring((value - MIN_VALUE) * stepWidth);
  }, [value, stepWidth, position]);

  const commitValue = useCallback(
    (nextValue: number) => {
      onChange(nextValue);
    },
    [onChange],
  );

  const pan = Gesture.Pan()
    .onChange((event) => {
      const next = Math.min(Math.max(position.value + event.changeX, 0), trackWidth - THUMB_SIZE);
      position.value = next;
    })
    .onEnd(() => {
      if (stepWidth <= 0) return;
      const rawStep = Math.round(position.value / stepWidth);
      const clampedStep = Math.min(Math.max(rawStep, 0), MAX_VALUE - MIN_VALUE);
      position.value = withSpring(clampedStep * stepWidth);
      runOnJS(commitValue)(clampedStep + MIN_VALUE);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.track} onLayout={handleLayout}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.thumb, thumbStyle]} />
        </GestureDetector>
      </View>
      <Text style={styles.valueText}>{value}回</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12 },
  track: {
    flex: 1,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#e5e5ea",
    justifyContent: "center",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: "#0a84ff",
  },
  valueText: { fontSize: 15, fontWeight: "700", color: "#1c1c1e", width: 40, textAlign: "right" },
});
