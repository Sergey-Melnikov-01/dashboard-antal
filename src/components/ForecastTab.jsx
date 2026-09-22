import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { toNum } from '../utils/format';
import { card, lbl } from '../styles/theme';

// ─── ВРЕМЕННЫЕ ФИКСИРОВАННЫЕ ЗНАЧЕНИЯ ──────────────────────────────────────
// "Остаток трассы" задан вручную (Сергей передал готовые цифры). Всё
// остальное (Факт, средняя выработка в неделю, прогноз окончания, график)
// теперь считается автоматически из DB_KPI — при появлении новой колонки
// (новой недели) в листе пересчитается само, ничего в коде трогать не надо.
const REMAINING_PIPE = {
  favorite: 1052.3,  // км — осталось сделать (труба), СК «Фаворит»
  tekhno: 209.103,   // км — осталось сделать (труба), ТОО «Техностандарт-М»
};

// Единый акцентный цвет для обеих карточек
const ACCENT = '#2de2a6';

const CONTRACTOR_META = {
  favorite: { title: 'СК «Фаворит»', match: (name) => name.includes('Фаворит') },
  tekhno:   { title: 'ТОО «Техностандарт-М»', match: (name) => name.includes('Техностандарт') },
};

const MS_DAY = 24 * 60 * 60 * 1000;

const fmt = (n, digits = 1) => (n === null || n === undefined || Number.isNaN(n))
  ? '—'
  : Number(n).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const formatDateRu = (date) => {
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
};

// Заголовок недели в DB_KPI бывает двух видов: настоящая дата (первые
// колонки листа, приходит с бэкенда как ISO-строка после JSON.stringify)
// либо текстовый диапазон "dd.mm.yyyy - dd.mm.yyyy" / "dd.mm.yyyy-dd.mm.yyyy".
// Достаём из заголовка КОНЕЧНУЮ дату недели — на неё и будем ориентироваться.
const extractWeekEndDate = (header) => {
  if (header === null || header === undefined || header === '') return null;
  const str = String(header);
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = str.match(/\d{2}\.\d{2}\.\d{4}/g);
  if (dmy && dmy.length) {
    const [dd, mm, yyyy] = dmy[dmy.length - 1].split('.');
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }
  return null;
};

// Тултип для графика динамики трубы
const ForecastTooltip = ({ active, payload, label, color }) => {
  if (!active || !payload || !payload.length) return null;
  const val = payload[0]?.value;
  if (val === null || val === undefined) return null;
  return (
    <div style={{
      background: '#0f1724', color: '#e2e8f0', padding: '8px 10px', borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 24px rgba(2,6,23,0.6)', fontSize: 12,
    }}>
      <div style={{ marginBottom: 4, color: '#9ca3af' }}>{label}</div>
      <div style={{ color, fontWeight: 600 }}>Труба: {Number(val).toLocaleString('ru-RU')} км</div>
    </div>
  );
};

// Разбираем сырой DB_KPI (массив массивов, как отдаёт getDataRange().getValues()):
// строка 0 — заголовок ("Название" + даты/диапазоны недель по столбцам);
// далее — либо строка-заголовок подрядчика (только текст, без значений),
// либо строка участка (числа по неделям, накопительно не считаем — это
// именно недельные объёмы). Строки участков относим к последнему
// встреченному заголовку подрядчика.
function parseKpi(kpiData) {
  const empty = { favorite: null, tekhno: null };
  if (!Array.isArray(kpiData) || kpiData.length < 2) return empty;

  const headerRow = kpiData[0] || [];
  const weekHeaders = headerRow.slice(1);
  const weekCount = weekHeaders.length;
  if (weekCount === 0) return empty;

  const weekEndDates = weekHeaders.map(extractWeekEndDate);
  const weekLabels = weekHeaders.map((h, i) => formatDateRu(weekEndDates[i]) || String(h || ''));

  const sums = {
    favorite: new Array(weekCount).fill(0),
    tekhno: new Array(weekCount).fill(0),
  };

  let currentKey = null;
  for (let r = 1; r < kpiData.length; r++) {
    const row = kpiData[r] || [];
    const label = String(row[0] || '').trim();
    if (!label) continue;
    const values = row.slice(1, 1 + weekCount);
    const isHeaderRow = values.every(v => v === '' || v === null || v === undefined);

    if (isHeaderRow) {
      const matchedKey = Object.keys(CONTRACTOR_META).find(key => CONTRACTOR_META[key].match(label));
      currentKey = matchedKey || null; // строка вроде "Строительство магистрали ВОЛС" — сбрасываем контекст
      continue;
    }

    if (!currentKey) continue; // строка данных встретилась раньше, чем узнали подрядчика — пропускаем
    values.forEach((v, i) => { sums[currentKey][i] += toNum(v); });
  }

  const buildContractor = (key) => {
    const weeklySums = sums[key];
    const firstActiveIdx = weeklySums.findIndex(v => v > 0);

    // Недельная (не накопительная) выработка — именно то, что должно
    // рисоваться на графике: реальный объём за конкретную неделю,
    // линия должна идти то вверх, то вниз при просадках
    const weeklyTrend = weeklySums.map((v, i) => ({ date: weekLabels[i], pipeWeek: v }));

    const chartTrend = firstActiveIdx === -1 ? weeklyTrend : weeklyTrend.slice(firstActiveIdx);
    const factPipe = weeklySums.reduce((sum, v) => sum + v, 0); // сумма всех недельных значений
    const weeksElapsed = firstActiveIdx === -1 ? 0 : (weekCount - firstActiveIdx);
    const avgPipe = weeksElapsed > 0 ? factPipe / weeksElapsed : null;
    const lastWeekEndDate = weekEndDates[weekEndDates.length - 1];

    return { factPipe, avgPipe, chartTrend, lastWeekEndDate };
  };

  return { favorite: buildContractor('favorite'), tekhno: buildContractor('tekhno') };
}

// Вкладка «Прогноз»: слева КПИ-карточка + график Фаворита, справа —
// КПИ-карточка + график Техностандарта. Данные — из DB_KPI (понедельные
// объёмы по трубе, по каждому участку, с группировкой по подрядчику).
export const ForecastTab = ({ kpiData }) => {
  const parsed = useMemo(() => parseKpi(kpiData), [kpiData]);

  const perContractor = useMemo(() => {
    return Object.keys(CONTRACTOR_META).map(key => {
      const meta = CONTRACTOR_META[key];
      const p = parsed[key];
      const remainingPipe = REMAINING_PIPE[key];

      let forecastDays = null, forecastDateText = null;
      if (p && p.avgPipe && p.avgPipe > 0 && p.lastWeekEndDate) {
        const weeksLeft = remainingPipe / p.avgPipe;
        forecastDays = Math.round(weeksLeft * 7);
        forecastDateText = formatDateRu(new Date(p.lastWeekEndDate.getTime() + forecastDays * MS_DAY));
      }

      return {
        key,
        title: meta.title,
        accent: ACCENT,
        remainingPipe,
        factPipe: p ? p.factPipe : 0,
        avgPipe: p ? p.avgPipe : null,
        chartTrend: p ? p.chartTrend : [],
        forecastDays,
        forecastDateText,
      };
    });
  }, [parsed]);

  return (
    <div className="forecast-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      {perContractor.map(c => (
        <div key={c.key}>
          {/* KPI-карточка подрядчика */}
          <div style={{ ...card, borderTop: `3px solid ${c.accent}`, marginBottom: '16px' }}>
            <div style={{ fontSize: '16px', fontWeight: 800, marginBottom: '14px', color: c.accent }}>
              {c.title}
            </div>

            {/* Факт */}
            <div style={{ marginBottom: '14px' }}>
              <div style={lbl}>Факт труба</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: c.accent }}>
                {fmt(c.factPipe)} <span style={{ fontSize: '14px', opacity: 0.6 }}>км</span>
              </div>
            </div>

            {/* Средняя выработка/неделю + Остаток трассы */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <div style={lbl}>Ср. выработка / нед.</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0' }}>
                  {fmt(c.avgPipe)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км/нед</span>
                </div>
              </div>
              <div>
                <div style={lbl}>Остаток трассы</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#ff9b45' }}>
                  {fmt(c.remainingPipe)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
                </div>
              </div>
            </div>

            {/* Прогноз окончания */}
            <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={lbl}>Прогноз окончания</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: c.accent }}>
                {c.forecastDateText || '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                {c.forecastDays !== null ? `осталось ~${c.forecastDays} дн.` : ''}
              </div>
            </div>
          </div>

          {/* График недельной (не накопительной) выработки трубы — с первой недели, где появились данные */}
          <div style={card}>
            <div style={lbl}>Труба, выработка за неделю (км)</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={c.chartTrend} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" vertical={false} />
                <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip content={<ForecastTooltip color={c.accent} />} cursor={{ stroke: '#2d3748', strokeWidth: 1 }} />
                <Line type="monotone" dataKey="pipeWeek" stroke={c.accent} strokeWidth={3} dot={{ r: 4, fill: c.accent }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
};
