import { useMemo, useState } from 'react';
import { card } from '../styles/theme';
import { parseUsSheet, US_BRANCH_META } from '../data/usStages';
import { CircularProgress } from './CircularProgress';
import { UsBranchCard } from './UsBranchCard';

// --- Простые SVG-графики динамики (без внешних библиотек) ---

// Всплывающее окошко со значением — общее для обоих графиков.
// Позиционируется через координаты клика/наведения относительно контейнера (не через SVG viewBox,
// т.к. SVG растягивается по ширине контейнера и его внутренние координаты не совпадают с экранными).
const ChartTooltip = ({ hover }) => {
  if (!hover) return null;
  return (
    <div style={{
      position: 'absolute', left: hover.x, top: hover.y, transform: 'translate(-50%, -110%)',
      background: 'rgba(15, 17, 26, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
      padding: '6px 10px', fontSize: 12, color: '#e2e8f0', pointerEvents: 'none', whiteSpace: 'nowrap',
      zIndex: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
    }}>
      <span style={{ color: hover.color, fontWeight: 700 }}>{hover.name}</span>
      {' '}— {hover.value}% <span style={{ color: '#64748b' }}>({hover.label})</span>
    </div>
  );
};

// Вариант 1: линейный график % готовности по датам (по одной линии на ветку).
// Значения веток часто очень близки друг к другу — чтобы линии не сливались,
// у каждой тёмная обводка-halo (как на карте) + своя форма маркера (круг/квадрат/треугольник)
const HistoryLineChart = ({ labels, series, height = 220 }) => {
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const allValues = series.flatMap(s => s.values);
  const maxY = Math.max(10, Math.ceil(Math.max(...allValues, 0) / 5) * 5);
  const xStep = labels.length > 1 ? innerW / (labels.length - 1) : 0;
  const yScale = v => padding.top + innerH - (v / maxY) * innerH;
  const xScale = i => padding.left + i * xStep;

  const [hover, setHover] = useState(null);
  const showPoint = (e, s, i, v) => {
    const rect = e.currentTarget.closest('.chart-container').getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, name: s.name, color: s.color, value: v, label: labels[i] });
  };
  const hidePoint = () => setHover(null);

  const markerShapes = ['circle', 'square', 'triangle'];
  const renderMarker = (shape, cx, cy, color, r = 4) => {
    if (shape === 'square') return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} fill={color} stroke="#0a0a0f" strokeWidth="1" />;
    if (shape === 'triangle') return <polygon points={`${cx},${cy - r - 1} ${cx - r - 1},${cy + r} ${cx + r + 1},${cy + r}`} fill={color} stroke="#0a0a0f" strokeWidth="1" />;
    return <circle cx={cx} cy={cy} r={r} fill={color} stroke="#0a0a0f" strokeWidth="1" />;
  };

  return (
    <div className="chart-container" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = padding.top + innerH * f;
          const val = Math.round(maxY - maxY * f);
          return (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{val}%</text>
            </g>
          );
        })}
        {labels.map((l, i) => (
          <text key={i} x={xScale(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>
        ))}
        {/* Сначала все обводки-halo (под линиями), потом все цветные линии, потом все маркеры —
            чтобы обводка одной линии не перекрывала цвет соседней сверху */}
        {series.map(s => {
          const points = s.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
          return <polyline key={`halo-${s.name}`} points={points} fill="none" stroke="#0a0a0f" strokeWidth="5.5" strokeOpacity="0.6" />;
        })}
        {series.map(s => {
          const points = s.values.map((v, i) => `${xScale(i)},${yScale(v)}`).join(' ');
          return <polyline key={`line-${s.name}`} points={points} fill="none" stroke={s.color} strokeWidth="2.5" />;
        })}
        {series.map((s, si) => s.values.map((v, i) => (
          <g
            key={`marker-${si}-${i}`}
            onMouseEnter={(e) => showPoint(e, s, i, v)}
            onMouseLeave={hidePoint}
            onClick={(e) => showPoint(e, s, i, v)}
            style={{ cursor: 'pointer' }}
          >
            {/* невидимая широкая область — чтобы легче было навести/попасть кликом */}
            <circle cx={xScale(i)} cy={yScale(v)} r="12" fill="transparent" />
            {renderMarker(markerShapes[si % markerShapes.length], xScale(i), yScale(v), s.color)}
          </g>
        )))}
      </svg>
      <ChartTooltip hover={hover} />
    </div>
  );
};

// Вариант 2: столбчатый график — сравнение % готовности веток на каждую дату снимка (не дельта, а сами значения)
const HistoryBarChart = ({ labels, series, height = 220 }) => {
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 28, left: 36 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const allValues = series.flatMap(s => s.values);
  const maxY = Math.max(10, Math.ceil(Math.max(...allValues, 0) / 5) * 5);
  const groupWidth = labels.length > 0 ? innerW / labels.length : innerW;
  const barWidth = groupWidth / (series.length + 1);
  const yScale = v => padding.top + innerH - (v / maxY) * innerH;
  const baseY = padding.top + innerH;

  const [hover, setHover] = useState(null);
  const showBar = (e, s, gi, v) => {
    const rect = e.currentTarget.closest('.chart-container').getBoundingClientRect();
    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, name: s.name, color: s.color, value: v, label: labels[gi] });
  };
  const hideBar = () => setHover(null);

  return (
    <div className="chart-container" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = padding.top + innerH * f;
          const val = Math.round(maxY - maxY * f);
          return (
            <g key={i}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{val}%</text>
            </g>
          );
        })}
        {labels.map((l, gi) => (
          <text key={gi} x={padding.left + gi * groupWidth + groupWidth / 2} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{l}</text>
        ))}
        {series.map((s, si) => s.values.map((v, gi) => {
          const x = padding.left + gi * groupWidth + barWidth * (si + 0.5);
          const y = yScale(v);
          const h = Math.max(0.5, baseY - y);
          return (
            <rect
              key={`${si}-${gi}`} x={x} y={y} width={barWidth * 0.75} height={h} fill={s.color} rx="2"
              onMouseEnter={(e) => showBar(e, s, gi, v)}
              onMouseLeave={hideBar}
              onClick={(e) => showBar(e, s, gi, v)}
              style={{ cursor: 'pointer' }}
            />
          );
        }))}
      </svg>
      <ChartTooltip hover={hover} />
    </div>
  );
};

const ChartLegend = ({ series }) => (
  <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
    {series.map(s => (
      <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
        {s.name}
      </div>
    ))}
  </div>
);

// Вкладка «УС»: общий гейдж готовности + 3 карточки веток (гейдж ветки + список объектов), по образцу листа Dashboard из Excel
export const UsTab = ({ usGreenData, usBlueData, usRedData, usHistoryData }) => {
  const green = useMemo(() => parseUsSheet(usGreenData), [usGreenData]);
  const blue = useMemo(() => parseUsSheet(usBlueData), [usBlueData]);
  const red = useMemo(() => parseUsSheet(usRedData), [usRedData]);

  const all = useMemo(() => [...green, ...blue, ...red], [green, blue, red]);
  const total = all.length;

  // Данные для графиков динамики — группируем еженедельные снимки DB_US_HISTORY по (дата, ветка)
  // и считаем средний % готовности объектов в ветке на каждую дату
  const historyChart = useMemo(() => {
    if (!Array.isArray(usHistoryData) || usHistoryData.length === 0) return null;

    const byDateBranch = {};
    usHistoryData.forEach(r => {
      const rawDate = r['Дата снимка'];
      const branch = r['Ветка'];
      const pct = Number(r['% готовности']);
      if (!rawDate || !branch || !Number.isFinite(pct)) return;
      const d = new Date(rawDate);
      if (isNaN(d)) return;
      const dateKey = d.toISOString().slice(0, 10);
      const key = `${dateKey}|${branch}`;
      (byDateBranch[key] ||= []).push(pct);
    });

    const dateKeys = [...new Set(Object.keys(byDateBranch).map(k => k.split('|')[0]))].sort();
    if (dateKeys.length === 0) return null;

    const branches = [
      { key: 'Зелёная ветка', name: 'Зелёная', color: US_BRANCH_META.green.color },
      { key: 'Синяя ветка', name: 'Синяя', color: US_BRANCH_META.blue.color },
      { key: 'Красная ветка', name: 'Красная', color: US_BRANCH_META.red.color },
    ];

    const series = branches.map(b => ({
      name: b.name,
      color: b.color,
      values: dateKeys.map(dk => {
        const arr = byDateBranch[`${dk}|${b.key}`] || [];
        return arr.length ? +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) : 0;
      }),
    }));

    const labels = dateKeys.map(dk => {
      const [, m, d] = dk.split('-');
      return `${d}.${m}`;
    });

    return { labels, series };
  }, [usHistoryData]);

  if (total === 0) {
    return (
      <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: 180, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Нет данных по УС (проверьте DB_US_GREEN/BLUE/RED в API)</div>
      </div>
    );
  }

  const overallPercent = all.reduce((s, o) => s + o.totalPercent, 0) / total;
  const overallMoney = all.reduce((s, o) => s + o.totalMoney, 0);
  const overallFullyDone = all.filter(o => o.fullyDone).length;

  return (
    <>
      {/* Общий гейдж готовности */}
      <div style={{ ...card, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <CircularProgress percent={overallPercent} color="#2de2a6" size={140} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>
            Общая готовность МУС
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{overallFullyDone}</span> из {total} объектов готовы
          </div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Выполнено на</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2de2a6' }}>{Math.round(overallMoney).toLocaleString('ru-RU')} тнг</div>
        </div>
      </div>

      {/* Карточки веток */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <UsBranchCard branchLabel={US_BRANCH_META.green.label} color={US_BRANCH_META.green.color} objects={green} />
        <UsBranchCard branchLabel={US_BRANCH_META.blue.label} color={US_BRANCH_META.blue.color} objects={blue} />
        <UsBranchCard branchLabel={US_BRANCH_META.red.label} color={US_BRANCH_META.red.color} objects={red} />
      </div>

      {/* Графики динамики по неделям — внизу страницы, под карточками веток */}
      {historyChart && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
          <div style={{ ...card, flex: '1 1 480px', minWidth: 320 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
              Динамика % готовности по неделям
            </div>
            <HistoryLineChart labels={historyChart.labels} series={historyChart.series} />
            <ChartLegend series={historyChart.series} />
          </div>

          <div style={{ ...card, flex: '1 1 480px', minWidth: 320 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12 }}>
              Сравнение веток по неделям
            </div>
            <HistoryBarChart labels={historyChart.labels} series={historyChart.series} />
            <ChartLegend series={historyChart.series} />
          </div>
        </div>
      )}
    </>
  );
};
