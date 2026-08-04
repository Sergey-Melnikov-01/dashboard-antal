// Список задач (34 шт.) с их весами и разделами — лист "Метрики по МУС" (вкладка "УС")
// Сумма весов задач ≈ 100, поэтому сумма набранных баллов по объекту = % его готовности
export const US_SECTIONS = [
  {
    id: 1, name: 'Подготовительный этап',
    tasks: [
      { code: '1.1', name: 'Подготовка требований и эскизов МУС', weight: 2.5 },
      { code: '1.2', name: 'Выбор места участка МУС', weight: 0.5 },
      { code: '1.3', name: 'Получение правоустанавливающих документов на участок МУС', weight: 0.5 },
      { code: '1.4', name: 'Получение ТУ на подключение к электросетям', weight: 0.5 },
      { code: '1.5', name: 'Проведение и анализ ИГИ и ВЭЗ', weight: 0.5 },
      { code: '1.6', name: 'Проектирование МУС', weight: 0.5 },
      { code: '1.7', name: 'Проектирование ВЛЭП', weight: 1 },
      { code: '1.8', name: 'Выбор Поставщика оборудования', weight: 1 },
      { code: '1.9', name: 'Выбор Изготовителя контейнеров', weight: 1 },
      { code: '1.10', name: 'Выбор Исполнителя СМР МУС', weight: 1 },
      { code: '1.11', name: 'Выбор Исполнителя СМР ВЛЭП', weight: 1 },
    ],
  },
  {
    id: 2, name: 'Строительно-монтажные работы',
    tasks: [
      { code: '2.1', name: 'Строительство ограждения МУС', weight: 1 },
      { code: '2.2', name: 'Строительство фундаментов МУС', weight: 3 },
      { code: '2.3', name: 'Строительство кабельной канализации', weight: 2 },
      { code: '2.4', name: 'Монтаж системы заземления и молниезащиты', weight: 5 },
      { code: '2.5', name: 'Монтаж биобарьера и финишного слоя', weight: 2 },
      { code: '2.6', name: 'Строительство ВЛЭП', weight: 7 },
    ],
  },
  {
    id: 3, name: 'Изготовление, приобретение, доставка',
    tasks: [
      { code: '3.1', name: 'Приобретение "давальческого" сырья ТЛК, ДГУК, КТПН', weight: 6 },
      { code: '3.2', name: 'Изготовление ТЛК', weight: 16 },
      { code: '3.3', name: 'Изготовление ДГУК', weight: 12 },
      { code: '3.4', name: 'Изготовление КТПН', weight: 4 },
      { code: '3.5', name: 'Транспортировка оборудования на площадку МУС', weight: 2 },
    ],
  },
  {
    id: 4, name: 'Монтаж и установка на площадке МУС',
    tasks: [
      { code: '4.1', name: 'Монтаж ТЛК, ДГУК, КТПН на фундаменты', weight: 5 },
      { code: '4.2', name: 'Прокладка электрических кабелей КТПН-ТЛК, КТПН-ДГУК, ДГУК-ТЛК', weight: 1 },
      { code: '4.3', name: 'Прокладка телекоммуникационных кабелей КТПН-ТЛК, КТПН-ДГУК, ДГУК-ТЛК', weight: 1 },
      { code: '4.4', name: 'Подключение КТПН к ВЛЭП', weight: 2 },
      { code: '4.5', name: 'Монтаж внутреннего и внешнего навесного оборудования ДГУК', weight: 2 },
      { code: '4.6', name: 'Монтаж внутреннего и внешнего навесного оборудования ТЛК', weight: 3 },
      { code: '4.7', name: 'Настройка и пусконаладка энергетических и инженерных систем МУС', weight: 2 },
      { code: '4.8', name: 'Выполнение измерений', weight: 1 },
      { code: '4.9', name: 'Приёмо-сдаточные испытания МУС', weight: 2 },
      { code: '4.10', name: 'Устранение замечаний', weight: 1 },
    ],
  },
  {
    id: 5, name: 'Обеспечение готовности МУС к установке телекомм. оборудования',
    tasks: [
      { code: '5.1', name: 'Исполнительная документация', weight: 3 },
      { code: '5.12', name: 'ВОЛС', weight: 2 },
      { code: '5.13', name: 'ТЛК готов к установке телекоммуникационного оборудования', weight: 1 },
    ],
  },
  {
    id: 6, name: 'Удалённый мониторинг и видеонаблюдение',
    tasks: [
      { code: '6.1', name: 'Подключение инженерного оборудования к "сухим контактам" DWDM-оборудования', weight: 2 },
      { code: '6.2', name: 'Подключение инженерного оборудования к служебной LAN', weight: 1 },
      { code: '6.3', name: 'Подключение системы видеонаблюдения к служебной LAN', weight: 1 },
    ],
  },
];

// Плоский список всех задач (без разбивки на разделы) — удобно для парсинга по коду
export const US_TASKS = US_SECTIONS.flatMap(s => s.tasks.map(t => ({ ...t, sectionId: s.id, sectionName: s.name })));

export const US_BRANCH_META = {
  green: { label: 'Зелёная ветка', color: '#4ade80' },
  red: { label: 'Красная ветка', color: '#f87171' },
  blue: { label: 'Синяя ветка', color: '#60a5fa' },
};

// Парсит "сырой" лист одной ветки (DB_US_GREEN/BLUE/RED, массив массивов из getDataRange().getValues())
// Структура: строка 1 — имена объектов (каждое на 3 колонки, начиная с колонки D/индекс 3),
// строка 2 — подписи "% выполнения"/"баллы"/"тенге", строки 3+ — задачи (у задач в 3-й колонке проставлен вес)
export function parseUsSheet(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length < 3) return [];

  const nameRow = rawRows[0] || [];
  const objects = [];
  for (let col = 3; col < nameRow.length; col += 3) {
    const name = nameRow[col];
    if (!name) continue;
    objects.push({ name: String(name).trim(), colOffset: col, tasksByCode: {} });
  }

  for (let r = 2; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;
    const code = row[0];
    const weight = row[2];
    // Строки-заголовки разделов (например "2. СМР") не имеют собственного веса — пропускаем их,
    // сумма баллов по входящим в раздел задачам даст тот же итог
    if (weight === null || weight === undefined || weight === '' || isNaN(Number(weight))) continue;
    const codeStr = String(code).trim();
    objects.forEach(obj => {
      const pct = Number(row[obj.colOffset]) || 0;
      const points = Number(row[obj.colOffset + 1]) || 0;
      const money = Number(row[obj.colOffset + 2]) || 0;
      obj.tasksByCode[codeStr] = { pct, points, money };
    });
  }

  return objects.map((obj, i) => {
    const totalPoints = Object.values(obj.tasksByCode).reduce((s, t) => s + t.points, 0);
    const totalMoney = Object.values(obj.tasksByCode).reduce((s, t) => s + t.money, 0);
    return {
      id: i + 1,
      name: obj.name,
      tasksByCode: obj.tasksByCode,
      totalPercent: +totalPoints.toFixed(1),
      totalMoney,
      fullyDone: totalPoints >= 99.5, // сумма весов ≈100, берём с небольшим запасом на округление
    };
  });
}
