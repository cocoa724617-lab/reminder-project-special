import { useState } from "react";

// 既存 pwa-notifications.js の verbatim 移植。
export function isStandaloneDisplayMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIosDevice() {
  const ua = window.navigator.userAgent;
  const isIphoneOrIpad = /iPad|iPhone|iPod/.test(ua);
  const isIpadOS13Plus = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return isIphoneOrIpad || isIpadOS13Plus;
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// PWA・iOS環境判定をまとめて返すフック。ブラウザ環境やdisplay-modeはページ表示中に変わらない前提
// （既存実装も一度だけ判定していた）なので、遅延初期化のuseStateで1回だけ計算する。
export function usePwaEnvironment() {
  const [env] = useState(() => {
    const isIos = isIosDevice();
    const isStandalone = isStandaloneDisplayMode();
    const pushSupported = isPushSupported();
    // iPhoneはホーム画面追加（standalone起動）でないとPush通知が使えない既存仕様。
    const needsIosInstall = isIos && !isStandalone;

    let unavailableReason = null;
    if (!pushSupported) {
      unavailableReason = "unsupported";
    } else if (needsIosInstall) {
      unavailableReason = "ios-needs-install";
    }

    return { isIos, isStandalone, isPushSupported: pushSupported, needsIosInstall, unavailableReason };
  });

  return env;
}
