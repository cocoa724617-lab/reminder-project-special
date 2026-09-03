import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

import { STATUS_IMAGES } from "@/constants/status-images";
import { subscribeCelebrations, type CelebrationEvent } from "@/utils/celebrate";
import type { StatusKey } from "@/utils/user-status-utils";

// 既存 celebrate.js の完了トースト(1800ms)・ステータス発見トースト(2600ms)と同じ表示時間。
const COMPLETION_DURATION = 1800;
const DISCOVERY_DURATION = 2600;
const FADE_DURATION = 250;

// utils/celebrate.ts のイベントバスを購読して表示するグローバルなトースト。app/_layout.tsxの
// ルート直下に1つだけマウントする。Web版は複数のトーストが同時にDOMへ積み重なる作りだったが、
// RN版はキューにためて1件ずつ順番に表示する（newlyDiscovered.forEach(...)で複数件が同じtickで
// 積まれることがあるため、重ねて出すより見やすいという判断）。
export default function CelebrationToast() {
  const [queue, setQueue] = useState<CelebrationEvent[]>([]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    return subscribeCelebrations((event) => {
      setQueue((prev) => [...prev, event]);
    });
  }, []);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current) return undefined;

    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: FADE_DURATION, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }),
    ]).start();

    const duration = current.type === "discovery" ? DISCOVERY_DURATION : COMPLETION_DURATION;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: FADE_DURATION, useNativeDriver: true }),
      ]).start(() => {
        setQueue((prev) => prev.slice(1));
      });
    }, duration);

    return () => clearTimeout(timer);
    // current自体（新しいid）が変わった時だけ発火させたいので、opacity/translateYは依存に含めない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (!current) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.toast,
          current.type === "discovery" && styles.toastDiscovery,
          { opacity, transform: [{ translateY }] },
        ]}>
        {current.type === "discovery" ? (
          <>
            <Image source={STATUS_IMAGES[current.statusKey as StatusKey]} style={styles.discoveryImage} />
            <View>
              <Text style={styles.discoveryLabel}>新しいステータスを発見！</Text>
              <Text style={styles.discoveryName}>{current.name}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.completionText}>{current.message}</Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 110,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(28,28,30,0.92)",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
    maxWidth: "88%",
  },
  toastDiscovery: { borderRadius: 16, paddingVertical: 10 },
  completionText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  discoveryImage: { width: 40, height: 40, borderRadius: 20 },
  discoveryLabel: { color: "#fff", fontSize: 11, opacity: 0.8 },
  discoveryName: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
