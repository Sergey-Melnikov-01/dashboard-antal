// Названия 14 этапов ПИР для объектов МУС (лист DB_PIR_MUS)
export const MUS_STAGE_NAMES = [
  'Выбор площадки под размещение МУС',
  'Проверка земельно-кадастрового статуса участка',
  'Формирование схемы отвода земельного участка',
  'Разработка землеустроительного проекта',
  'Согласование землеустроительного проекта',
  'Рассмотрение материалов земельной комиссией',
  'Инженерно-геологические изыскания',
  'Решения о предоставлении земельного участка',
  'Формирование земельного участка',
  'Оформление права временного возмездного землепользования',
  'Изготовление идинтификационного документа на земучасток',
  'Государственная регистрация права землепользования',
  'Получение правоустанавливающих документов',
  'Получение ТУ на подключение к ЭС',
];

// Те же цвета/подписи веток, что и на вкладке "Ветки" (DB_PIR_VOLS)
export const MUS_BRANCH_META = {
  green: { label: 'Зелёная ветка', color: '#4ade80' },
  red: { label: 'Красная ветка', color: '#f87171' },
  blue: { label: 'Синяя ветка', color: '#60a5fa' },
};

// Эталонные цвета заливки ячейки "Наименование МУС" в Google Таблице
const REFERENCE_COLORS = {
  green: { r: 0x6a, g: 0xa8, b: 0x4f }, // #6AA84F
  blue:  { r: 0x6d, g: 0x9e, b: 0xeb }, // #6D9EEB
  red:   { r: 0xe0, g: 0x66, b: 0x66 }, // #E06666
};

// Определяет ветку по HEX-цвету заливки ячейки (с запасом на небольшие расхождения цвета)
export function classifyMusBranch(hex) {
  if (!hex) return null;
  const clean = String(hex).replace('#', '').trim();
  if (clean.length < 6) return null;
  // Поддерживаем и 6-значный HEX (RRGGBB), и 8-значный ARGB (берём последние 6)
  const rgbHex = clean.length === 8 ? clean.slice(2) : clean.slice(0, 6);
  const r = parseInt(rgbHex.slice(0, 2), 16);
  const g = parseInt(rgbHex.slice(2, 4), 16);
  const b = parseInt(rgbHex.slice(4, 6), 16);
  if ([r, g, b].some(v => isNaN(v))) return null;

  // Белый/пустая заливка (заголовки, пустые строки) — не ветка
  if (r > 240 && g > 240 && b > 240) return null;

  let best = null;
  let bestDist = Infinity;
  Object.entries(REFERENCE_COLORS).forEach(([branch, ref]) => {
    const dist = Math.sqrt((r - ref.r) ** 2 + (g - ref.g) ** 2 + (b - ref.b) ** 2);
    if (dist < bestDist) { bestDist = dist; best = branch; }
  });
  // Порог — если цвет слишком далёк от всех трёх эталонов, считаем что это не ветка
  return bestDist < 90 ? best : null;
}

// Парсит "сырые" строки DB_PIR_MUS (массив массивов) + параллельный массив цветов заливки в структурированные объекты МУС
export function parseMusSheet(musData, musColors) {
  if (!Array.isArray(musData) || musData.length === 0) return [];
  const today = new Date();
  const objects = [];

  musData.forEach((row, idx) => {
    const cells = Array.isArray(row) ? row : Object.values(row || {});
    const name = String(cells[0] || '').trim();
    if (!name) return;

    const colorHex = Array.isArray(musColors) ? musColors[idx] : null;
    const branch = classifyMusBranch(colorHex);
    if (!branch) return; // заголовки и прочие нецветные строки пропускаем

    const region = String(cells[1] || '').trim();
    const district = String(cells[2] || '').trim();

    const stages = [];
    for (let i = 0; i < MUS_STAGE_NAMES.length; i++) {
      const planRaw = cells[9 + i * 2];
      const factRaw = cells[10 + i * 2];
      const planDate = planRaw ? String(planRaw).trim() : null;
      const factDate = factRaw ? String(factRaw).trim() : null;
      const done = factDate ? new Date(factDate) <= today : false;
      stages.push({ name: MUS_STAGE_NAMES[i], planDate, factDate, done });
    }
    const doneCount = stages.filter(s => s.done).length;

    objects.push({
      id: objects.length + 1,
      name,
      region,
      district,
      branch,
      stages,
      doneCount,
      totalStages: MUS_STAGE_NAMES.length,
      fullyDone: doneCount === MUS_STAGE_NAMES.length,
    });
  });

  return objects;
}
