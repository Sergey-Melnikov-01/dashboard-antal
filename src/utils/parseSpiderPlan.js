// src/utils/parseSpiderPlan.js
// Разбор листа DB_SpiderPlan (выгрузка Spider: план работ по бригадам) в структуру для SpiderPlanTab.
//
// Ожидаемые колонки:
//   «Код WBS» | «Название» | «Вид работ» | «Единица объёма» | «28.09.26 Объём» | «05.10.26 Объём» | ...
// • Колонки-недели определяются по дате в заголовке — их число и даты могут меняться.
// • Колонка «Вид работ» (укладка трубы / задувка кабеля / бронированный кабель / ...) используется
//   для линейной части. Если её нет (старый формат) — линейная часть показывается одним списком.
//
// Иерархия строится ПО ПОРЯДКУ СТРОК и глубине кода WBS, а не по совпадению префиксов кодов:
// в выгрузке бывают повторяющиеся коды (одна бригада — несколько видов работ), и префиксы не
// всегда совпадают с вложенностью.
//
// Принимает данные в любом из двух видов, которые отдаёт Apps Script:
//   • массив объектов  [{ "Код WBS": "2.1.1", "Название": "...", "28.09.26 Объём": 107.9, ... }]
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
const hasAny = (w) => w.some((v) => v !== 0);
const addTo = (acc, w) => w.forEach((v, i) => { acc[i] += v; });

const normType = (t) => {
  const s = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
};

// Порядок видов работ в отчёте; незнакомые идут после, «не указан» — в конце
const TYPE_ORDER = ['укладка трубы', 'задувка кабеля', 'бронированный кабель', 'остатки по укладке трубы'];
const typeRank = (t) => {
  if (!t) return 999;
  const i = TYPE_ORDER.indexOf(t.toLowerCase());
  return i >= 0 ? i : 100;
};

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
  const cUnit = findCol(/единиц/i, -1);
  // «Вид работ»: по названию заголовка, либо безымянная колонка C между названием и единицей
  let cType = findCol(/вид\s*работ|тип\s*работ/i, -1);
  if (cType < 0 && header[2] === '' && cUnit !== 2) cType = 2;

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
      if (nxt < end) end = nxt;
    }
    return { start: iso(c.start), end: iso(end) };
  });
  const zero = () => new Array(weeks.length).fill(0);

  // ── 3. дерево по порядку строк (стек по глубине кода)
  const root = { depth: 0, children: [] };
  const stack = [root];
  let count = 0;
  body.forEach((r) => {
    const code = String(r[cCode] == null ? '' : r[cCode]).trim();
    if (!code) return;
    const node = {
      code,
      depth: code.split('.').length,
      name: String(r[cName] == null ? '' : r[cName]).replace(/\s+/g, ' ').trim(),
      unit: cUnit >= 0 ? String(r[cUnit] == null ? '' : r[cUnit]).trim() : '',
      type: cType >= 0 ? normType(r[cType]) : '',
      w: weekCols.map((c) => round3(num(r[c.i]))),
      children: [],
      parent: null,
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= node.depth) stack.pop();
    node.parent = stack[stack.length - 1];
    node.parent.children.push(node);
    stack.push(node);
    count++;
  });
  if (count === 0) return null;

  const all = [];
  const walk = (n) => { n.children.forEach((c) => { all.push(c); walk(c); }); };
  walk(root);

  const leavesOf = (n) => {
    const out = [];
    const rec = (x) => (x.children.length ? x.children.forEach(rec) : out.push(x));
    n.children.forEach(rec);
    return out;
  };
  // У участков берём только собственные значения: вложенные работы бывают в м3/шт, их нельзя суммировать с км.
  // У строки бригады — свои значения, а если они пусты — сумма участков.
  const brigadeW = (b) => {
    if (hasAny(b.w)) return b.w;
    const acc = zero();
    b.children.forEach((c) => addTo(acc, c.w));
    return acc;
  };
  const task = (x) => ({ name: x.name, unit: x.unit, w: x.w });

  // ── 4. три блока ветки (глубина 3) — по названию, а не по жёстким кодам
  const blocks = all.filter((n) => n.depth === 3);
  const pick = (re) => blocks.find((b) => re.test(b.name.toLowerCase()));
  const linearBlock = pick(/линейн/);
  const gnbBlock = pick(/пересечен/);
  const musBlock = pick(/мус/);
  const branch = all.find((n) => n.depth === 2);

  // Линейная часть: строка = бригада × вид работ; внутри — участки
  const linear = linearBlock
    ? linearBlock.children.map((b) => ({
        name: b.name,
        type: b.type,
        w: brigadeW(b),
        sections: b.children.map((s) => ({ name: s.name, w: s.w })),
      }))
    : [];
  linear.sort((a, b) => typeRank(a.type) - typeRank(b.type)); // сортировка стабильная: порядок внутри вида сохраняется
  const hasWorkTypes = linear.some((r) => r.type);
  const untyped = hasWorkTypes ? linear.filter((r) => !r.type).map((r) => r.name) : [];

  // ГНБ: бригады → участки → задачи
  const gnb = gnbBlock
    ? gnbBlock.children.map((b) => ({
        name: b.name,
        sections: b.children.map((s) => ({ name: s.name, tasks: s.children.map(task) })),
      }))
    : [];

  // МУС: узлы → листовые работы с названием группы (цепочка родителей без повторов)
  const mus = musBlock
    ? musBlock.children.map((n) => ({
        name: n.name,
        items: leavesOf(n).map((lf) => {
          const chain = [];
          for (let p = lf.parent; p && p !== n; p = p.parent) chain.push(p.name);
          chain.reverse();
          const parts = [];
          chain.forEach((c) => { if (c && parts[parts.length - 1] !== c) parts.push(c); });
          if (parts.length && parts[parts.length - 1] === lf.name) parts.pop();
          return { ...task(lf), group: parts.join(' › ') };
        }),
      }))
    : [];

  return { title: branch ? branch.name : '', weeks, linear, gnb, mus, hasWorkTypes, untyped };
}
