// 既存 notification-settings.html の「①通知をランダムに実行していい時間帯」と同じ項目。
function NotificationTimeSettings({ startTime, endTime, onChangeStartTime, onChangeEndTime }) {
  return (
    <>
      <h2>① 通知をランダムに実行していい時間帯（起きている時間）</h2>
      <div className="form-group">
        <label htmlFor="start-time">開始時刻</label>
        <input
          id="start-time"
          type="time"
          value={startTime}
          onChange={(event) => onChangeStartTime(event.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="end-time">終了時刻</label>
        <input id="end-time" type="time" value={endTime} onChange={(event) => onChangeEndTime(event.target.value)} />
      </div>
    </>
  );
}

export default NotificationTimeSettings;
