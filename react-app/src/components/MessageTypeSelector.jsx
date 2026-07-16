import { POSTPONE_MESSAGE_TYPES } from "../utils/postponeMessages.js";

// 既存 notification-settings.html の「「後でやる」を押したときのメッセージ」と同じ4択。
function MessageTypeSelector({ value, onChange }) {
  return (
    <>
      <h2>「後でやる」を押したときのメッセージ</h2>
      <p>気分に合わせて、後回しにしたときの言葉のトーンを選べます。</p>
      <div className="choice-chip-row">
        {Object.entries(POSTPONE_MESSAGE_TYPES).map(([key, meta]) => (
          <label key={key} className={`choice-chip${value === key ? " is-selected" : ""}`}>
            <input
              type="radio"
              name="message-type"
              value={key}
              checked={value === key}
              onChange={() => onChange(key)}
              className="choice-chip-input"
            />
            {meta.label}
          </label>
        ))}
      </div>
    </>
  );
}

export default MessageTypeSelector;
