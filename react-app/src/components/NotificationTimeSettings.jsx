import TimeSelect from "./TimeSelect.jsx";

// 既存 notification-settings.html の「①通知をランダムに実行していい時間帯」と同じ項目。
function NotificationTimeSettings({ startTime, endTime, onChangeStartTime, onChangeEndTime }) {
  return (
    <>
      <h2>① 通知をランダムに実行していい時間帯（起きている時間）</h2>
      <div className="form-group">
        <label>開始時刻</label>
        <TimeSelect value={startTime} onChange={onChangeStartTime} />
      </div>
      <div className="form-group">
        <label>終了時刻</label>
        <TimeSelect value={endTime} onChange={onChangeEndTime} />
      </div>
    </>
  );
}

export default NotificationTimeSettings;
