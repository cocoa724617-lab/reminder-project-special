import { useState } from "react";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function toDateStr(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateStr(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

// 常時表示のカレンダーグリッドから日付を選ぶ。valueは"YYYY-MM-DD"、onChangeにも同形式で返す。
function CalendarDatePicker({ value, onChange }) {
  const today = new Date();
  const parsedValue = parseDateStr(value);
  const initial = parsedValue || { y: today.getFullYear(), m: today.getMonth() + 1 };
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m);
  const [syncedValue, setSyncedValue] = useState(value);

  // 外部操作(前日/翌日ボタンなど)でvalueが変わった時だけ表示月を選択日に合わせる
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (parsedValue) {
      setViewYear(parsedValue.y);
      setViewMonth(parsedValue.m);
    }
  }

  function shiftMonth(delta) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
  }

  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className="calendar-picker">
      <div className="calendar-picker-header">
        <button type="button" className="calendar-nav-button" aria-label="前の月" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <span className="calendar-picker-title">
          {viewYear}年{viewMonth}月
        </span>
        <button type="button" className="calendar-nav-button" aria-label="次の月" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>
      <div className="calendar-picker-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="calendar-picker-grid">
        {cells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} className="calendar-day is-empty" />;
          const dateStr = toDateStr(viewYear, viewMonth, day);
          const isSelected = dateStr === value;
          const isToday = dateStr === todayStr;
          return (
            <button
              key={dateStr}
              type="button"
              className={`calendar-day${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`}
              onClick={() => onChange(dateStr)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CalendarDatePicker;
