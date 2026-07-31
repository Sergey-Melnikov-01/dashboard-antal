export const TmcBarSvgHorizontal = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.plan, d.fact]), 1);

  const TOTAL_W = 900;
  const PAD_LEFT = 16;
  const PAD_RIGHT = 110;
  const LABEL_COL_W = 72;
  const BAR_AREA_W = TOTAL_W - PAD_LEFT - LABEL_COL_W - PAD_RIGHT;
  const BAR_H = 36;
  const PLAN_FACT_GAP = 14;
  const NAME_H = 28;
  const ITEM_GAP = 20;
  const PAD_TOP = 12;

  const ITEM_H = NAME_H + BAR_H + PLAN_FACT_GAP + BAR_H;
  const TOTAL_H = PAD_TOP + data.length * ITEM_H + (data.length - 1) * ITEM_GAP + 12;
  const barX = PAD_LEFT + LABEL_COL_W;

  const scaleW = (val) => !val ? 0 : Math.max((val / maxVal) * BAR_AREA_W, 2);
  const fmt = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'М';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'к';
    return Math.round(n).toString();
  };
  const r = 8;
  const roundedRightRect = (x, y, w, h, radius) => {
    if (w <= 0) return '';
    const rr = Math.min(radius, h / 2, w / 2);
    return `M ${x},${y} L ${x + w - rr},${y} Q ${x + w},${y} ${x + w},${y + rr} L ${x + w},${y + h - rr} Q ${x + w},${y + h} ${x + w - rr},${y + h} L ${x},${y + h} Z`;
  };

  return (
    <div style={{ paddingBottom: 4 }}>
      <svg width="100%" viewBox={`0 0 ${TOTAL_W} ${TOTAL_H}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="hGradPlan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1a6abf" />
            <stop offset="100%" stopColor="#5ab4ff" />
          </linearGradient>
          <linearGradient id="hGradFact" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a7050" />
            <stop offset="100%" stopColor="#2de2a6" />
          </linearGradient>
        </defs>

        {data.map((item, idx) => {
          const itemY = PAD_TOP + idx * (ITEM_H + ITEM_GAP);
          const planY = itemY + NAME_H;
          const factY = planY + BAR_H + PLAN_FACT_GAP;
          const planW = scaleW(item.plan);
          const factW = scaleW(item.fact);
          return (
            <g key={idx}>
              {/* Разделитель между элементами */}
              {idx > 0 && (
                <line x1={PAD_LEFT} y1={itemY - ITEM_GAP / 2}
                  x2={TOTAL_W - PAD_RIGHT} y2={itemY - ITEM_GAP / 2}
                  stroke="#1d2d24" strokeWidth={1} />
              )}
              {/* Название */}
              <text x={TOTAL_W / 2} y={itemY + 18} textAnchor="middle"
                fill="#e5e7eb" fontSize={14} fontWeight={700}>
                {item.name}
              </text>
              {/* План */}
              <text x={barX - 10} y={planY + BAR_H / 2 + 5}
                textAnchor="end" fill="#5ab4ff" fontSize={12} fontWeight={700}>
                План
              </text>
              {planW > 0 && <path d={roundedRightRect(barX, planY, planW, BAR_H, r)} fill="url(#hGradPlan)" />}
              <text x={barX + planW + 12} y={planY + BAR_H / 2 + 5}
                textAnchor="start" fill="#5ab4ff" fontSize={14} fontWeight={800}>
                {fmt(item.plan)}
              </text>
              {/* Факт */}
              <text x={barX - 10} y={factY + BAR_H / 2 + 5}
                textAnchor="end" fill="#2de2a6" fontSize={12} fontWeight={700}>
                Факт
              </text>
              {factW > 0 && <path d={roundedRightRect(barX, factY, factW, BAR_H, r)} fill="url(#hGradFact)" />}
              <text x={barX + factW + 12} y={factY + BAR_H / 2 + 5}
                textAnchor="start" fill="#2de2a6" fontSize={14} fontWeight={800}>
                {fmt(item.fact)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// =====================================================
// PIR (ПИР) — Трекер ВОЛС: данные и компоненты
// Данные встроены из ГПР_большой (лист "Treker_ ВОЛС"), 168 маршрутов, 21 этап.
// =====================================================
