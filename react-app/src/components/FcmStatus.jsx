// 既存 notification-settings.html の updatePermissionStatus() と同じ表示仕様。
// isSupported / permission / error / isRequesting は useFcmToken() の戻り値をそのまま渡す想定。
function FcmStatus({ isSupported, permission, error, isRequesting, onRequestPermission }) {
  if (!isSupported) {
    return <p>この環境では通知に対応していません。</p>;
  }

  return (
    <div id="permission-section">
      {permission === "granted" && <p>通知が使える状態です。</p>}

      {permission === "denied" && (
        <p className="notification-status-blocked">
          この端末・ブラウザで通知がブロックされています。ボタンを押しても許可画面は出ません。ブラウザ(またはiPhoneの設定アプリ)のサイト設定から通知を許可し、このページを開き直してください。
        </p>
      )}

      {permission !== "granted" && permission !== "denied" && (
        <button type="button" className="btn-secondary" onClick={onRequestPermission} disabled={isRequesting}>
          {isRequesting ? "確認中…" : "通知を許可する"}
        </button>
      )}

      {error && <p className="notification-status-blocked">{error.message || String(error)}</p>}
    </div>
  );
}

export default FcmStatus;
