import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { parseSpiderPlan } from '../utils/parseSpiderPlan';

// ─────────────────────────────────────────────────────────────
// Вторая скрытая вкладка: план работ по данным Spider (Зелёная ветка).
// Данные — из листа DB_SpiderPlan (Google Sheets), проп spiderPlanData.
// Открывается/закрывается в App.jsx (клавиша «Ф»/«A», крестик — как у вкладки «Прогноз»).
// Внутри вкладки: Линейная часть / ГНБ / МУС.
// ─────────────────────────────────────────────────────────────

const DEADLINE = '2026-11-15'; // целевая дата завершения (ISO — сравнение строк корректно)
const ACCENT = '#2de2a6';
const WARN = '#fb923c';

// Девять максимально различимых цветов: только один зелёный (малая механизация — первая бригада)
const BRIGADE_COLORS = [
  '#2de2a6', // зелёный
  '#2563eb', // синий
  '#ec4899', // розовый
  '#facc15', // жёлтый
  '#a855f7', // фиолетовый
  '#f97316', // оранжевый
  '#dc2626', // красный
  '#22d3ee', // голубой
  '#cbd5e1', // светло-серый
];

const dm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
const sum = (arr) => arr.reduce((s, v) => s + (v || 0), 0);
const fmt = (n, d = 1) => (n ? Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d }) : '');
const isPast = (w) => w.end > DEADLINE; // неделя заканчивается после 15.11

const periodText = (w, weeks) => {
  const a = w.findIndex((v) => v > 0);
  if (a < 0) return '—';
  let b = w.length - 1;
  while (b > a && !(w[b] > 0)) b--;
  return `${dm(weeks[a].start)} – ${dm(weeks[b].end)}`;
};

const lastActiveIdx = (w) => {
  for (let i = w.length - 1; i >= 0; i--) if (w[i] > 0) return i;
  return -1;
};

// ───────────── Таблица план по неделям (общая для всех вкладок) ─────────────
const PlanTable = ({ weeks, rows, totalRow, totalLabel = 'Итого' }) => {
  const [open, setOpen] = useState({});
  const parentMax = useMemo(() => Math.max(1, ...rows.map((r) => Math.max(0, ...r.w))), [rows]);

  const th = (extra = {}) => ({
    padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textAlign: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap', ...extra,
  });

  const cell = (v, max, isTotal) => ({
    padding: '6px 4px', fontSize: 12, textAlign: 'center', minWidth: 54,
    color: v ? '#e2e8f0' : 'transparent',
    background: v && !isTotal ? `rgba(45,226,166,${Math.min(0.55, 0.08 + (v / max) * 0.5)})` : 'transparent',
    fontWeight: isTotal ? 800 : 500,
  });

  const stickyCol = (bg) => ({
    position: 'sticky', left: 0, zIndex: 1, background: bg, textAlign: 'left',
    minWidth: 280, maxWidth: 360,
  });

  const renderRow = (r, level, key) => {
    if (r.header) {
      return (
        <tr key={key}>
          <td colSpan={weeks.length + 3} style={{
            ...stickyCol('#101826'), padding: '6px 10px 6px ' + (14 + level * 16) + 'px',
            fontSize: 11, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.4,
            background: '#101826', borderTop: '1px solid rgba(255,255,255,0.04)',
          }}>
            {r.label}
          </td>
        </tr>
      );
    }
    const hasKids = r.children && r.children.length > 0;
    const isOpen = !!open[key];
    const rowMax = level === 0 ? parentMax : Math.max(1, ...r.w);
    const bg = level === 0 ? '#1a2332' : '#141c2b';
    return (
      <FragmentRows key={key}>
        <tr
          onClick={hasKids ? () => setOpen((o) => ({ ...o, [key]: !o[key] })) : undefined}
          style={{ cursor: hasKids ? 'pointer' : 'default', borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <td style={{
            ...stickyCol(bg), padding: '7px 10px 7px ' + (10 + level * 16) + 'px',
            fontSize: level === 0 ? 13 : 12, fontWeight: level === 0 ? 700 : 500,
            color: level === 0 ? '#fff' : '#cbd5e1',
          }}>
            {hasKids && <span style={{ color: ACCENT, marginRight: 6 }}>{isOpen ? '▾' : '▸'}</span>}
            {r.label}
            {r.unit ? <span style={{ color: '#64748b', marginLeft: 6, fontSize: 11 }}>{r.unit}</span> : null}
          </td>
          <td style={{ padding: '6px 8px', fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {periodText(r.w, weeks)}
          </td>
          {weeks.map((w, i) => (
            <td key={i} style={{
              ...cell(r.w[i], rowMax, false),
              borderLeft: i > 0 && isPast(w) && !isPast(weeks[i - 1]) ? `2px solid ${WARN}` : undefined,
            }}>
              {fmt(r.w[i], r.dec ?? 1)}
            </td>
          ))}
          <td style={{ padding: '6px 10px', fontSize: 12, fontWeight: 800, color: ACCENT, textAlign: 'right', whiteSpace: 'nowrap' }}>
            {r.total ? fmt(r.total, r.dec ?? 1) : ''}
          </td>
        </tr>
        {hasKids && isOpen && r.children.map((c, ci) => renderRow(c, level + 1, `${key}/${ci}`))}
      </FragmentRows>
    );
  };

  return (
    <div style={{ overflow: 'auto', maxHeight: '62vh', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 3, background: '#0f1724' }}>
          <tr>
            <th style={{ ...th({ textAlign: 'left', padding: '8px 10px' }), ...stickyCol('#0f1724') }}>Название</th>
            <th style={th()}>Период</th>
            {weeks.map((w, i) => (
              <th key={i} title={`${dm(w.start)} – ${dm(w.end)}`} style={th({
                color: isPast(w) ? WARN : '#94a3b8',
                borderLeft: i > 0 && isPast(w) && !isPast(weeks[i - 1]) ? `2px solid ${WARN}` : undefined,
              })}>
                {dm(w.start)}
              </th>
            ))}
            <th style={th({ textAlign: 'right', padding: '8px 10px' })}>{totalLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => renderRow(r, 0, String(i)))}
          {totalRow && (
            <tr style={{ borderTop: '2px solid rgba(45,226,166,0.35)' }}>
              <td style={{ ...stickyCol('#0f1724'), padding: '9px 10px', fontSize: 13, fontWeight: 800, color: ACCENT }}>
                {totalRow.label}
              </td>
              <td />
              {weeks.map((w, i) => (
                <td key={i} style={{
                  ...cell(totalRow.w[i], 1, true), color: totalRow.w[i] ? ACCENT : 'transparent',
                  borderLeft: i > 0 && isPast(w) && !isPast(weeks[i - 1]) ? `2px solid ${WARN}` : undefined,
                }}>
                  {fmt(totalRow.w[i])}
                </td>
              ))}
              <td style={{ padding: '6px 10px', fontSize: 13, fontWeight: 800, color: ACCENT, textAlign: 'right' }}>
                {fmt(totalRow.total)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// tbody допускает только <tr>; обёртка-фрагмент для группы строк
const FragmentRows = ({ children }) => <>{children}</>;

const Kpi = ({ label, value, sub, color = '#fff' }) => (
  <div style={{
    flex: '1 1 180px', background: '#1a2332', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 14, padding: '14px 16px',
  }}>
    <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    {sub ? <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div> : null}
  </div>
);

// ───────────── Локальный тултип (как в остальных графиках: тёмная тема) ─────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const items = payload.filter((p) => p.value > 0);
  if (!items.length) return null;
  const total = sum(items.map((p) => p.value));
  return (
    <div style={{
      background: '#0f1724', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
      padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', fontSize: 12, color: '#e2e8f0',
    }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Неделя с {label}</div>
      {items.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: p.color }}>{p.dataKey}</span>
          <span>{fmt(p.value)} км</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 6, fontWeight: 800 }}>
        Итого: {fmt(total)} км
      </div>
    </div>
  );
};

// ───────────── Вкладка: Линейная часть ─────────────
const LinearView = ({ weeks, plan }) => {
  const { linear, linearTotal } = plan;

  const rows = useMemo(() => linear.map((b) => ({
    label: b.name, w: b.w, total: sum(b.w),
    children: b.sections.map((s) => ({ label: s.name, w: s.w, total: sum(s.w) })),
  })), [linear]);

  const total = sum(linearTotal);
  const beforeKm = sum(linearTotal.filter((_, i) => !isPast(weeks[i])));
  const afterKm = total - beforeKm;
  const peakIdx = linearTotal.reduce((m, v, i, a) => (v > a[m] ? i : m), 0);

  const chartData = weeks.map((w, i) => {
    const row = { name: dm(w.start) };
    linear.forEach((b) => { row[b.name] = b.w[i] || 0; });
    return row;
  });
  const lastIdx = lastActiveIdx(linearTotal);
  const visible = chartData.slice(0, Math.max(lastIdx + 1, 1));

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <Kpi label="План линейной части" value={`${fmt(total)} км`} sub={`${linear.length} бригад`} />
        <Kpi label="До 15.11 включительно" value={`${fmt(beforeKm)} км`} color={ACCENT}
          sub={`${total ? ((beforeKm / total) * 100).toFixed(1) : 0}% плана Spider`} />
        <Kpi label="После 15.11" value={`${fmt(afterKm)} км`} color={afterKm > 0 ? WARN : ACCENT}
          sub={lastIdx >= 0 ? `последняя неделя с ${dm(weeks[lastIdx].start)}` : ''} />
        <Kpi label="Пик недели" value={`${fmt(linearTotal[peakIdx])} км`} sub={`неделя с ${dm(weeks[peakIdx].start)}`} />
      </div>

      <div style={{ background: '#1a2332', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px 8px 6px', marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, margin: '0 10px 8px', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          План по неделям и бригадам, км
        </div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visible} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {linear.map((b, i) => (
                <Bar key={b.code} dataKey={b.name} stackId="km" fill={BRIGADE_COLORS[i % BRIGADE_COLORS.length]} stroke="#1a2332" strokeWidth={1} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <PlanTable weeks={weeks} rows={rows} totalRow={{ label: 'Итого, км', w: linearTotal, total }} totalLabel="Итого, км" />
    </>
  );
};

// ───────────── Вкладка: ГНБ ─────────────
const GnbView = ({ weeks, plan }) => {
  const { gnb } = plan;
  const isPipe = (t) => t.name.startsWith('Прокладка трубы');
  const zero = () => new Array(weeks.length).fill(0);

  const rows = useMemo(() => gnb.map((b) => {
    const pipe = zero();
    b.sections.forEach((s) => s.tasks.filter(isPipe).forEach((t) => t.w.forEach((v, i) => { pipe[i] += v; })));
    const children = [];
    b.sections.forEach((s) => {
      const secPipe = zero();
      s.tasks.filter(isPipe).forEach((t) => t.w.forEach((v, i) => { secPipe[i] += v; }));
      children.push({ header: true, label: s.name });
      s.tasks.forEach((t) => children.push({
        label: t.name, unit: t.unit, w: t.w, dec: 0,
        total: t.unit === '%' ? 0 : sum(t.w),
      }));
    });
    return { label: b.name, w: pipe, total: sum(pipe), dec: 0, children };
  }), [gnb]);

  const totalPipe = zero();
  rows.forEach((r) => r.w.forEach((v, i) => { totalPipe[i] += v; }));

  const sectionCount = gnb.reduce((s, b) => s + b.sections.length, 0);
  const lateBrigades = rows.filter((r) => { const li = lastActiveIdx(r.w); return li >= 0 && isPast(weeks[li]); }).length;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <Kpi label="Бригад ГНБ" value={gnb.length} sub={`${sectionCount} участков`} />
        <Kpi label="Прокладка трубы ГНБ" value={`${fmt(sum(totalPipe), 0)} м`} color={ACCENT} sub="по плану Spider" />
        <Kpi label="Работы после 15.11" value={`${lateBrigades} из ${gnb.length}`} color={lateBrigades ? WARN : ACCENT} sub="бригад" />
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        В строке бригады — «Прокладка трубы ПНД методом ГНБ», м/неделю. Нажмите на бригаду, чтобы увидеть участки и все виды работ.
      </div>
      <PlanTable weeks={weeks} rows={rows} totalRow={{ label: 'Итого, м трубы', w: totalPipe, total: sum(totalPipe) }} totalLabel="Итого, м" />
    </>
  );
};

// ───────────── Вкладка: МУС ─────────────
const MusView = ({ weeks, plan }) => {
  const { mus } = plan;
  const zero = () => new Array(weeks.length).fill(0);

  const rows = useMemo(() => mus.map((n) => {
    const cnt = zero();
    n.items.forEach((t) => t.w.forEach((v, i) => { if (v > 0) cnt[i] += 1; }));
    const children = [];
    let lastGroup = null;
    n.items.forEach((t) => {
      if (t.group !== lastGroup) {
        lastGroup = t.group;
        if (t.group) children.push({ header: true, label: t.group });
      }
      children.push({ label: t.name, unit: t.unit, w: t.w, dec: 2, total: t.unit === '%' || !t.unit ? 0 : sum(t.w) });
    });
    return { label: n.name, w: cnt, total: 0, dec: 0, children };
  }), [mus]);

  const total = zero();
  rows.forEach((r) => r.w.forEach((v, i) => { total[i] += v; }));
  const late = rows.filter((r) => { const li = lastActiveIdx(r.w); return li >= 0 && isPast(weeks[li]); }).length;
  const lastIdx = lastActiveIdx(total);

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
        <Kpi label="Узлов МУС / ЦОД" value={mus.length} sub={`${sum(mus.map((n) => n.items.length))} видов работ`} />
        <Kpi label="Работы после 15.11" value={`${late} из ${mus.length}`} color={late ? WARN : ACCENT} sub="узлов" />
        <Kpi label="Последняя неделя плана" value={lastIdx >= 0 ? dm(weeks[lastIdx].start) : '—'} sub={lastIdx >= 0 ? `до ${dm(weeks[lastIdx].end)}` : ''} />
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
        В строке узла — число видов работ, запланированных на неделю. Нажмите на узел, чтобы увидеть объёмы по каждой работе.
      </div>
      <PlanTable weeks={weeks} rows={rows} totalRow={{ label: 'Всего работ в неделю', w: total, total: 0 }} totalLabel="" />
    </>
  );
};

// ───────────── Основное содержимое вкладки ─────────────
export const SpiderPlanTab = ({ spiderPlanData }) => {
  const [tab, setTab] = useState('linear');
  const plan = useMemo(() => parseSpiderPlan(spiderPlanData), [spiderPlanData]);
  const weeks = plan ? plan.weeks : [];

  // Диагностика для пустого состояния: что реально пришло с сервера
  const diag = useMemo(() => {
    const rows = Array.isArray(spiderPlanData) ? spiderPlanData : null;
    if (!rows || rows.length === 0) return 'пришло 0 строк: в ответе API нет ключа DB_SpiderPlan (скрипт не обновлён или ответ из серверного кэша) либо лист пуст.';
    const head = Array.isArray(rows[0]) ? rows[0] : Object.keys(rows[0]);
    if (/^\d+(\.\d+)*$/.test(String(head[0]).trim())) {
      return 'в качестве заголовков пришла строка данных (' + head.slice(0, 3).map(String).join(' | ') + '): шапка «Код WBS…» должна лежать во 2-й строке листа, 1-я строка API пропускается — вставьте пустую строку сверху.';
    }
    const hasWeeks = head.some((h) => /\d{2}\.\d{2}\.\d{2}/.test(String(h)));
    return `Получено строк: ${rows.length}. Заголовки: ${head.slice(0, 6).map(String).join(' | ')}${head.length > 6 ? ' …' : ''}. `
      + (hasWeeks ? 'Колонки-недели найдены.' : 'Колонок с датами вида «01.10.26 Объём» не найдено.');
  }, [spiderPlanData]);

  const tabBtn = (id, label) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      style={{
        padding: '8px 18px', fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${tab === id ? ACCENT : 'rgba(255,255,255,0.1)'}`,
        background: tab === id ? ACCENT : 'transparent', color: tab === id ? '#0b1120' : '#cbd5e1',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
          План работ Spider · {(plan && plan.title) || 'Зелёная ветка'}
        </div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
          {plan
            ? `Недельный план с ${dm(weeks[0].start)} по ${dm(weeks[weeks.length - 1].end)} · оранжевая черта — граница 15.11`
            : 'Источник: лист DB_SpiderPlan (Google Sheets)'}
        </div>
      </div>

      {!plan ? (
        <div style={{
          background: '#1a2332', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14,
          padding: 24, color: '#cbd5e1', fontSize: 14, lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 800, color: WARN, marginBottom: 6 }}>Нет данных DB_SpiderPlan</div>
          Проверьте, что лист DB_SpiderPlan заполнен (шапка: «Код WBS», «Название», «Единица объёма»,
          затем колонки вида «01.10.26 Объём»), а в doGet() Apps Script есть строка
          <code style={{ color: ACCENT }}> DB_SpiderPlan: sheetToJson("DB_SpiderPlan")</code> и скрипт переопубликован.
          <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>Диагностика: {diag}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {tabBtn('linear', 'Линейная часть')}
            {tabBtn('gnb', 'ГНБ (пересечения)')}
            {tabBtn('mus', 'МУС / ЦОД')}
          </div>

          {tab === 'linear' && <LinearView weeks={weeks} plan={plan} />}
          {tab === 'gnb' && <GnbView weeks={weeks} plan={plan} />}
          {tab === 'mus' && <MusView weeks={weeks} plan={plan} />}
        </>
      )}
    </div>
  );
};

export default SpiderPlanTab;
