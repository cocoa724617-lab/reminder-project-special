import { TASK_LABELS, CUSTOMIZABLE_LABEL_KEYS } from "../utils/taskLabels.js";

// 既存 notification-settings.html の「色ラベルの名前」と同じ項目。
function LabelNameSettings({ labelNames, onChange }) {
  function updateName(key, value) {
    onChange({ ...labelNames, [key]: value });
  }

  return (
    <>
      <h2>色ラベルの名前</h2>
      <p>色ごとに好きな名前を付けられます（例：緑→家事）。</p>
      <div id="label-name-list">
        {CUSTOMIZABLE_LABEL_KEYS.map((key) => (
          <div className="label-name-row" key={key}>
            <span className="color-dot" style={{ background: TASK_LABELS[key].color }}></span>
            <input
              type="text"
              value={labelNames[key] ?? TASK_LABELS[key].name}
              onChange={(event) => updateName(key, event.target.value)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

export default LabelNameSettings;
