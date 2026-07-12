import { usePwaEnvironment } from "../hooks/usePwaEnvironment.js";
import { useFcmToken } from "../hooks/useFcmToken.js";
import IosInstallBanner from "./IosInstallBanner.jsx";
import FcmStatus from "./FcmStatus.jsx";

// 既存 notification-settings.html の #push-notification-section と同じ構成。
// iOSでホーム画面追加が必要な場合はバナーのみ表示し、それ以外は許可状態・許可ボタンを表示する。
function NotificationPermissionCard() {
  const pwaEnv = usePwaEnvironment();
  const fcm = useFcmToken();

  return (
    <section className="card" id="push-notification-section">
      <h2>通知の利用状況</h2>
      <IosInstallBanner show={pwaEnv.needsIosInstall} />
      {!pwaEnv.needsIosInstall && (
        <FcmStatus
          isSupported={fcm.isSupported}
          permission={fcm.permission}
          error={fcm.error}
          isRequesting={fcm.isRequesting}
          onRequestPermission={fcm.requestPermission}
        />
      )}
    </section>
  );
}

export default NotificationPermissionCard;
