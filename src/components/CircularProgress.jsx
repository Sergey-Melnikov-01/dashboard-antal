import React from 'react';

export const CircularProgress = ({ percent, color, size = 130, decimals = 2 }) => {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent || 0));
  const offset = c - (p / 100) * c;
  const percentLabel = p.toFixed(decimals).replace('.', ',');
  // Целимся в ширину ~72% диаметра круга и подбираем шрифт под реальную длину строки —
  // так однозначный (4,37%) и двузначный (25,50%) процент выглядят одинаково аккуратно, не задевая кольцо
  const targetWidth = size * 0.72;
  const fontSize = Math.round(targetWidth / ((percentLabel.length + 1) * 0.6));
  const labelSize = Math.max(9, Math.round(size * 0.08));
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease-out', filter: `drop-shadow(0 0 6px ${color}66)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize, fontWeight: 800, color: '#ffffff', lineHeight: 1, whiteSpace: 'nowrap' }}>{percentLabel}%</div>
        <div style={{ fontSize: labelSize, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>выполнено</div>
      </div>
    </div>
  );
};

// Полоса прогресса одного этапа
