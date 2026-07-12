// 既存 #ios-install-banner (.ios-banner-card) と同じ表示。
// iPhoneはホーム画面追加（standalone起動）でないとPush通知に対応できないための案内。
function IosInstallBanner({ show }) {
  if (!show) return null;

  return (
    <div className="ios-banner-card">
      <span className="ios-banner-icon" aria-hidden="true">
        📲
      </span>
      <p>iPhoneで通知を受け取るには、共有ボタンから「ホーム画面に追加」してください。</p>
    </div>
  );
}

export default IosInstallBanner;
