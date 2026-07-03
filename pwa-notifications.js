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
