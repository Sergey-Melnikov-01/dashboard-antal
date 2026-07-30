import React from 'react';
import { roundedTopRect } from '../utils/svg';

export const TmcBarSvg = ({ data }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.flatMap(d => [d.plan, d.fact]), 1);

  // Фиксированный viewBox — одинаковый для Склада и Закупа
  const TOTAL_W = 1300;
  const PAD_LEFT = 10;
  const PAD_RIGHT = 10;
  const PAD_TOP = 36;
  const CHART_H = 220;
  const LABEL_H = 72;
  const svgH = PAD_TOP + CHART_H + LABEL_H;
  const baseY = PAD_TOP + CHART_H;

  // Рассчитываем размеры баров динамически под количество материалов
  const usableW = TOTAL_W - PAD_LEFT - PAD_RIGHT;
  const groupW = usableW / data.length;
  const BAR_W = Math.max(12, Math.min(44, groupW * 0.30));
  const BAR_GAP = Math.max(3, BAR_W * 0.12);
  const groupCenter = groupW / 2;

  const scaleH = (val) => !val || maxVal === 0 ? 0 : Math.max((val / maxVal) * CHART_H, 2);
  const fmt = (n) => {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'М';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'к';
    return Math.round(n).toString();
  };

  // Обрезаем название до нужной длины
  const truncate = (str, maxLen) => str.length > maxLen ? str.substring(0, maxLen - 1) + '…' : str;

  // Делим длинное название на 2 строки
  const charsPerLine = Math.max(10, Math.floor(groupW / 7.2));
  const splitLabel = (name) => {
    const words = name.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (next.length <= charsPerLine) { cur = next; }
      else { if (cur) lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length === 0) return [truncate(name, charsPerLine), null, null];
    if (lines.length === 1) return [lines[0], null, null];
    if (lines.length === 2) return [lines[0], lines[1], null];
    const rest = lines.slice(2).join(' ');
    return [lines[0], lines[1], truncate(rest, charsPerLine)];
  };

  return (
    <div style={{ paddingBottom: 4 }}>
      <svg width="100%" viewBox={`0 0 ${TOTAL_W} ${svgH}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="tmcGradFact" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2de2a6" />
            <stop offset="100%" stopColor="#0a7050" />
          </linearGradient>
          <linearGradient id="tmcGradPlan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5ab4ff" />
            <stop offset="100%" stopColor="#0a4590" />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1={PAD_LEFT} y1={baseY} x2={TOTAL_W - PAD_RIGHT} y2={baseY} stroke="#2a2b3a" strokeWidth={1} />

        {data.map((item, i) => {
          const gx = PAD_LEFT + i * groupW;
          const cx = gx + groupCenter;
          const planX = cx - BAR_W - BAR_GAP / 2;
          const factX = cx + BAR_GAP / 2;
          const factH = scaleH(item.fact);
          const planH = scaleH(item.plan);
          const [line1, line2, line3] = splitLabel(item.name);

          return (
            <g key={i}>
              {/* Fact bar (LEFT, teal) */}
              {factH > 0 && (
                <>
                  <path d={roundedTopRect(factX, baseY - factH, BAR_W, factH, 6)} fill="url(#tmcGradFact)" />
                  <text x={factX + BAR_W / 2} y={baseY - factH - 5} textAnchor="middle" fill="#2de2a6" fontSize={10} fontWeight={700}>{fmt(item.fact)}</text>
                </>
              )}

              {/* Plan bar (RIGHT, blue) */}
              {planH > 0 && (
                <>
                  <path d={roundedTopRect(planX, baseY - planH, BAR_W, planH, 6)} fill="url(#tmcGradPlan)" />
                  <text x={planX + BAR_W / 2} y={baseY - planH - 5} textAnchor="middle" fill="#5ab4ff" fontSize={10} fontWeight={700}>{fmt(item.plan)}</text>
                </>
              )}

              {/* Название: 1 или 2 строки */}
              <text x={cx} y={baseY + 16} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontWeight={500}>
                {line1}
              </text>
              {line2 && (
                <text x={cx} y={baseY + 30} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontWeight={500}>
                  {line2}
                </text>
              )}
              {line3 && (
                <text x={cx} y={baseY + 46} textAnchor="middle" fill="#cbd5e1" fontSize={11} fontWeight={500}>
                  {line3}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// Горизонтальный SVG-график для одного материала
