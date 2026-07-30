import React from 'react';

export const StageProgressBar = ({ stageName, doneKm, totalKm, color }) => {
  const pct = totalKm > 0 ? (doneKm / totalKm) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 5 }}>
        <div style={{
          fontSize: 12, color: '#cbd5e1', flex: 1, minWidth: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }} title={stageName}>{stageName}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
          {Math.round(pct)}% <span style={{ color: '#64748b', fontWeight: 500 }}>({doneKm.toFixed(0)}/{totalKm.toFixed(0)} км)</span>
        </div>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`, height: '100%', background: color,
          boxShadow: `0 0 8px ${color}55`, transition: 'width 0.5s ease-out',
        }} />
      </div>
    </div>
  );
};

// Карточка одной ветки
