// Парсинг даты в формате "ДД.ММ.ГГГГ" из Google Sheets
export const parseDate = s => {
  if (!s) return new Date();
  const [d, m, y] = String(s).split('.');
  return new Date(y, m - 1, d);
};

// Безопасное приведение к числу
export const toNum = v => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// Форматирование валюты (например: "1 200 000 тнг")
export const formatCurrency = (val) => {
  if (!val && val !== 0) return '0 тнг';
  return Math.round(val).toLocaleString('ru-RU') + ' тнг';
};