// 既存 notification-settings.html の「②通知を辞めてほしい時間を個別に設定する時間」と同じ項目。
// 保存時（NotificationSettingsPage側）で start/end が両方揃っている行だけを送る仕様は既存 collectExcludeTimes と同じ。
function QuietHoursSettings({ excludeTimes, onChange }) {
  function updateRange(index, key, value) {
    onChange(excludeTimes.map((range, i) => (i === index ? { ...range, [key]: value } : range)));
  }

  function addRange() {
    onChange([...excludeTimes, { start: "", end: "" }]);
  }

  function removeRange(index) {
    onChange(excludeTimes.filter((_, i) => i !== index));
  }

  return (
    <>
      <h2>② 通知を辞めてほしい時間を個別に設定する時間</h2>
      <div id="exclude-times-container">
        {excludeTimes.map((range, index) => (
          <div className="exclude-time-item" key={index}>
            <input
              type="time"
              aria-label="開始時刻"
              value={range.start}
              onChange={(event) => updateRange(index, "start", event.target.value)}
            />
            <span>～</span>
            <input
              type="time"
              aria-label="終了時刻"
              value={range.end}
              onChange={(event) => updateRange(index, "end", event.target.value)}
            />
            <button type="button" className="btn-secondary exclude-time-remove" onClick={() => removeRange(index)}>
              削除
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="add-fixed-reminder-button" onClick={addRange}>
        ＋ 時間帯を追加
      </button>
    </>
  );
}

export default QuietHoursSettings;
