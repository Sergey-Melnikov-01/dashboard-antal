// src/utils/parseSpiderPlan.js
// Разбор листа DB_SpiderPlan (выгрузка Spider: план работ по бригадам) в структуру для SpiderPlanSecret.
//
// Ожидаемые колонки (как в выгрузке Spider):
//   «Код WBS» | «Название» | «Единица объёма» | «01.10.26 Объём» | «05.10.26 Объём» | ...
// Колонки-недели определяются по дате в заголовке, поэтому их число и даты могут меняться
// от выгрузки к выгрузке — править код не нужно.
//
// Принимает данные в любом из двух видов, которые отдаёт Apps Script:
//   • массив объектов  [{ "Код WBS": "2.1.1", "Название": "...", "01.10.26 Объём": 107.9, ... }]
//   • массив массивов  [[заголовки...], [строка...], ...]

const DAY = 24 * 3600 * 1000;

const num = (v) => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};
const round3 = (n) => Math.round(n * 1000) / 1000;

const iso = (d) => d.toISOString().slice(0, 10);

export function parseSpiderPlan(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return null;

  // ── 1. заголовки и тело таблицы
  let header;
  let body;
  if (Array.isArray(raw[0])) {
    header = raw[0].map((h) => String(h == null ? '' : h));
    body = raw.slice(1);
  } else {
    header = Object.keys(raw[0]);
    body = raw.map((r) => header.map((h) => r[h]));
  }

  const findCol = (re, fallback) => {
    const i = header.findIndex((h) => re.test(h));
    return i >= 0 ? i : fallback;
  };
  const cCode = findCol(/wbs|код/i, 0);
  const cName = findCol(/назван/i, 1);
  const cUnit = findCol(/единиц/i, 2);

  // ── 2. колонки-недели: в заголовке есть дата дд.мм.гг
  const weekCols = [];
  header.forEach((h, i) => {
    const m = /(\d{2})\.(\d{2})\.(\d{2})/.exec(h);
    if (m) weekCols.push({ i, start: new Date(Date.UTC(2000 + +m[3], +m[2] - 1, +m[1])) });
  });
  if (weekCols.length === 0) return null;
  weekCols.sort((a, b) => a.start - b.start);

  const weeks = weekCols.map((c, k) => {
    let end = new Date(c.start.getTime() + 6 * DAY);
    if (k + 1 < weekCols.length) {
      const nxt = new Date(weekCols[k + 1].start.getTime() - DAY);
      if (nxt < end) end = nxt; // первая неделя — неполная (01.10–04.10)
    }
    return { start: iso(c.start), end: iso(end) };
  });

  // ── 3. строки
  const rows = [];
  const byCode = new Map();
  body.forEach((r) => {
    const code = String(r[cCode] == null ? '' : r[cCode]).trim();
    if (!code) return;
    const row = {
      code,
      name: String(r[cName] == null ? '' : r[cName]).trim(),
      unit: String(r[cUnit] == null ? '' : r[cUnit]).trim(),
      w: weekCols.map((c) => round3(num(r[c.i]))),
    };
    rows.push(row);
    byCode.set(code, row);
  });
  if (rows.length === 0) return null;

  const parentOf = (code) => (code.includes('.') ? code.slice(0, code.lastIndexOf('.')) : null);
  const depth = (code) => code.split('.').length;
  const kids = new Map();
  rows.forEach((r) => {
    const p = parentOf(r.code);
    if (p == null) return;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(r);
  });
  const children = (code) => kids.get(code) || [];
  const leavesOf = (code) => {
    const out = [];
    const walk = (c) => children(c).forEach((ch) => (kids.has(ch.code) ? walk(ch.code) : out.push(ch)));
    walk(code);
    return out;
  };
  const task = (r) => ({ name: r.name, unit: r.unit, w: r.w });

  // ── 4. три блока ветки (глубина 3) находим по названию, а не по жёстким кодам
  const blocks = rows.filter((r) => depth(r.code) === 3);
  const pick = (re) => blocks.find((b) => re.test(b.name.toLowerCase()));
  const linearBlock = pick(/линейн/);
  const gnbBlock = pick(/пересечен/);
  const musBlock = pick(/мус/);

  const branchRow = rows.find((r) => depth(r.code) === 2);
  const title = branchRow ? branchRow.name : '';

  const zero = () => new Array(weeks.length).fill(0);

  // Линейная часть: бригады → участки
  const linear = linearBlock
    ? children(linearBlock.code).map((b) => ({
        code: b.code,
        name: b.name,
        w: b.w,
        sections: children(b.code).map((s) => ({ name: s.name, w: s.w })),
      }))
    : [];
  const linearTotal = linearBlock ? linearBlock.w : zero();

  // ГНБ: бригады → участки → задачи
  const gnb = gnbBlock
    ? children(gnbBlock.code).map((b) => ({
        code: b.code,
        name: b.name,
        sections: children(b.code).map((s) => ({ name: s.name, tasks: children(s.code).map(task) })),
      }))
    : [];

  // МУС: узлы → листовые работы с названием группы
  const mus = musBlock
    ? children(musBlock.code).map((n) => ({
        code: n.code,
        name: n.name,
        items: leavesOf(n.code).map((lf) => {
          const chain = [];
          let p = parentOf(lf.code);
          while (p && p !== n.code) {
            chain.push(byCode.get(p) ? byCode.get(p).name : '');
            p = parentOf(p);
          }
          chain.reverse();
          const parts = [];
          chain.forEach((c) => {
            if (c && parts[parts.length - 1] !== c) parts.push(c);
          });
          if (parts.length && parts[parts.length - 1] === lf.name) parts.pop();
          return { ...task(lf), group: parts.join(' › ') };
        }),
      }))
    : [];

  return { title, weeks, linearTotal, linear, gnb, mus };
}
