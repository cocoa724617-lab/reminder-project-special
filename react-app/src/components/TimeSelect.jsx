function pad2(n) {
  return String(n).padStart(2, "0");
}

function parseTimeStr(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return { hour: 9, minute: 0 };
  return { hour: Math.min(23, Number(match[1])), minute: Math.min(59, Number(match[2])) };
}

// 時・分をそれぞれ独立したselectで選ぶ。ブラウザ標準のtime inputだと
// (特にモバイルの時計UIで)分単位の細かい選択がしづらいため、確実に1分刻みで選べるようにする。
function TimeSelect({ value, onChange }) {
  const { hour, minute } = parseTimeStr(value);

  function update(nextHour, nextMinute) {
    onChange(`${pad2(nextHour)}:${pad2(nextMinute)}`);
  }

  return (
    <div className="time-select">
      <select aria-label="時" value={hour} onChange={(event) => update(Number(event.target.value), minute)}>
        {Array.from({ length: 24 }, (_, h) => (
          <option key={h} value={h}>
            {pad2(h)}
          </option>
        ))}
      </select>
      <span className="time-select-colon">:</span>
      <select aria-label="分" value={minute} onChange={(event) => update(hour, Number(event.target.value))}>
        {Array.from({ length: 60 }, (_, m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default TimeSelect;
