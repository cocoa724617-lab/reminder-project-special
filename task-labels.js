// タスクの色ラベル定義。task.color にはここのキーを保存する。
export const TASK_LABELS = {
  none: { name: 'ラベルなし', color: '#c7c7cc' },
  urgent: { name: '緊急', color: '#ff3b30' },
  school: { name: '学校', color: '#0a84ff' },
  life: { name: '生活', color: '#34c759' },
  jobhunt: { name: '就活', color: '#bf5af2' },
  'think-later': { name: '後で考える', color: '#8e8e93' }
};

// ユーザーが設定画面で付け替えたラベル名（例：緑→家事）。ページ初期化時に setCustomLabelNames で読み込む。
let customLabelNames = {};

export function setCustomLabelNames(labelNames) {
  customLabelNames = labelNames || {};
}

export function getTaskLabel(value) {
  const key = value && TASK_LABELS[value] ? value : 'none';
  const meta = TASK_LABELS[key];
  return { name: customLabelNames[key] || meta.name, color: meta.color };
}

// タスクカードの左端に、色ラベルのアクセントバーを付ける
export function applyLabelBar(element, colorValue) {
  element.style.borderLeft = `4px solid ${getTaskLabel(colorValue).color}`;
}

// 過去に文字化けして保存された「高/低」(鬮樣/菴・) も引き続き高/低として扱う
export function normalizeImportance(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'high' || text === '高' || text.includes('高') || text.includes('鬮')) return 'high';
  if (text === 'low' || text === '低' || text.includes('低') || text.includes('菴')) return 'low';
  return 'medium';
}

export const IMPORTANCE_LABELS = { high: '高', medium: '中', low: '低' };

export function normalizeUrgency(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'thisweek' || text === 'this-week') return 'thisWeek';
  if (text === 'whenfree' || text === 'when-free') return 'whenFree';
  return 'today';
}

export const URGENCY_LABELS = {
  today: '今日やる',
  thisWeek: '今週中',
  whenFree: '余裕があれば'
};

export const REPEAT_LABELS = {
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
  yearly: '毎年'
};

export function isRepeatingTask(task) {
  return !!(task && task.repeat && task.repeat !== 'none');
}
