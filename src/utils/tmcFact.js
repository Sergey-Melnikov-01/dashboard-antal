// Парсер для DB_TMC_FACT — фактически имеющиеся материалы по каждому участку (для карты).
// Заголовки в листе имеют вид "2026 <материал> [План]" / "2026 <материал> [Факт]";
// группировка "Склад (НЗС)" / "Закуп" в самих данных не сохраняется (row 1 с объединёнными
// заголовками не отдаётся Apps Script'ом), поэтому она зашита здесь статическим списком.

const unitFor = (name) => {
  const n = name.toLowerCase();
  if (n.includes('кабель') || n.includes('труба') || n.includes('лента')) return 'м';
  return 'шт';
};

// key   — точный заголовок колонки "Факт" в листе (с префиксом "2026 " и суффиксом " [Факт]")
// full  — чистое название материала для тултипа при наведении
// short — короткое название для отображения в списке
const material = (fullName, short, keyOverride) => ({
  key: `2026 ${keyOverride || fullName} [Факт]`,
  full: fullName,
  short,
  unit: unitFor(fullName),
});

const GROUPS = [
  {
    groupKey: 'sklad',
    groupLabel: 'Склад (НЗС)',
    materials: [
      material('Бронированный оптический кабель ОК-48(40G.652D+8G.654C)', 'Кабель ОК-48'),
      material('Камера оперативного доступа (КОД)', 'КОД'),
      material('Лента предупредительная оранжевая', 'Лента предупредительная'),
      material('Шаровый маркер типа EMS1401', 'Маркер EMS1401'),
      material('Столбик пластиковый указательный, высотой 1,8м', 'Столбик 1,8м'),
      material('Муфта оптическая OK-FOSC-400A4-48F (на 48 волокна)', 'Муфта OK-FOSC-400A4-48F'),
      material('Труба ПНД ф63 мм', 'Труба ПНД ф63'),
    ],
  },
  {
    groupKey: 'zakup',
    groupLabel: 'Закуп',
    materials: [
      material('Бронированный кабеля гибридный ВОК48 652D+8G.654C', 'Кабель ВОК48'),
      material('Бронированный кабеля гибридный ВОК32 (G652D+8G.654C)', 'Кабель ВОК32'),
      material('Труба полиэтиленовая рифлёная', 'Труба рифлёная'),
      // у этих четырёх материалов заголовок в листе отличается суффиксом "(Закуп)" — он нужен был
      // только чтобы разрулить коллизию имён со "Складом (НЗС)"; в отображении он не нужен
      material('Камера оперативного доступа (КОД)', 'КОД', 'Камера оперативного доступа (КОД) (Закуп)'),
      material('Сигнальная лента ЛСО-40 40*500 м', 'Лента ЛСО-40'),
      material('Шаровый маркер типа EMS1401', 'Маркер EMS1401', 'Шаровый маркер типа EMS1401 (Закуп)'),
      material('Столбик пластиковый указательный', 'Столбик указательный'),
      material('Муфта оптическая OK-FOSC-400A4-48F (на 48 волокна)', 'Муфта OK-FOSC-400A4-48F', 'Муфта оптическая OK-FOSC-400A4-48F (на 48 волокна) (Закуп)'),
      material('Датчик для обнаружения воды в оптической муфте WolfGmbH', 'Датчик воды WolfGmbH'),
      material('Труба ПНД ф63 мм', 'Труба ПНД ф63', 'Труба ПНД ф63 мм (Закуп)'),
      material('Адаптер герметичного ввода 40мм', 'Адаптер 40мм'),
      material('Муфта соединительная (фитинг)', 'Муфта-фитинг'),
      material('Муфта фитинг Hawle', 'Муфта Hawle'),
    ],
  },
];

const SUMMARY_ROW_NAME = 'Магистральные ВОЛС 2026-2027';

const getParticipok = (row) => {
  const raw = row['Название'] ?? row['Название '] ?? row['Участок'] ?? row['Участок '] ?? '';
  return String(raw).trim();
};

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : null;
};

// Возвращает Map<Название участка, { groups: [{ groupKey, groupLabel, items:[{short, full, unit, qty}] }] }>
// Участки без данных, и группы/материалы с пустым или нулевым значением — просто не попадают в результат.
export function buildTmcFactByParticipok(data) {
  const map = new Map();
  (data || []).forEach((row) => {
    const name = getParticipok(row);
    if (!name || name === SUMMARY_ROW_NAME) return;

    const groups = GROUPS.map((g) => {
      const items = g.materials
        .map((m) => {
          const qty = toNum(row[m.key]);
          if (!qty) return null;
          return { short: m.short, full: m.full, unit: m.unit, qty };
        })
        .filter(Boolean);
      return { groupKey: g.groupKey, groupLabel: g.groupLabel, items };
    }).filter((g) => g.items.length > 0);

    if (groups.length > 0) {
      map.set(name, { groups });
    }
  });
  return map;
}
