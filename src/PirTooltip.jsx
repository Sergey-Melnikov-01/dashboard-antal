import React from 'react';

export function PirTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#0f1724',
      color: '#e2e8f0',
      padding: 10,
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
      fontSize: 13,
      minWidth: 160
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.name}</div>
      <div style={{ color: '#9ca3af', fontSize: 12 }}>Регион: {d.region}</div>
      <div style={{ color: '#2de2a6', fontWeight: 800, marginTop: 8 }}>Готовность: {d.progress}%</div>
      {d.status ? <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Статус: {d.status}</div> : null}
    </div>
  );
}
