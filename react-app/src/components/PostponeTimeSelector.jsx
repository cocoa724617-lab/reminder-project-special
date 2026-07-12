// 既存 atodeyaru.html の .later-time-options / .later-time-button と同じ選択肢。
// 元実装にカスタム日時入力は無いため、ここでもプリセットのみを実装している。
const TIME_OPTIONS = ["10分後", "30分後", "1時間後", "今日の夜", "明日の朝"];

function PostponeTimeSelector({ selectedValue, onSelect, disabled }) {
  return (
    <div className="later-time-options" role="group" aria-label="あとでやる時間">
      {TIME_OPTIONS.map((value) => (
        <button
          key={value}
          type="button"
          className={`later-time-button${selectedValue === value ? " is-selected" : ""}`}
          aria-pressed={selectedValue === value}
          disabled={disabled}
          onClick={() => onSelect(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}

export default PostponeTimeSelector;
