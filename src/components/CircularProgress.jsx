import React from 'react';

export const CircularProgress = ({ percent, color, size = 130 }) => {
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent || 0));
  const offset = c - (p / 100) * c;
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
        <div style={{ fontSize: 30, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{p.toFixed(1)}%</div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.6px' }}>выполнено</div>
      </div>
    </div>
  );
};

// Полоса прогресса одного этапа
