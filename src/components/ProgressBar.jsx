import React from 'react';

export const ProgressBar = ({ label, plan, fact, pct, unit }) => {
  const displayPct = (pct || 0) * 100;
  // Цвет меняется от прогресса: красный (<30), оранжевый (<90), зеленый (>=90)
  const barColor = displayPct < 30 ? '#ff1a1a' : displayPct < 90 ? '#ff7b00' : '#10b981';
  // Формат как в Google Таблице: 2 знака после запятой, запятая вместо точки (99,74%)
  const displayPctLabel = displayPct.toFixed(2).replace('.', ',');

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
        {/* Названия этапа — сделали крупнее и белым */}
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#ffffff' }}>{label}</div>
        
        <div style={{ textAlign: 'right' }}>
          {/* Процент выполнения — чуть крупнее */}
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: barColor }}>{displayPctLabel}%</div>
          {/* Километры — увеличили шрифт и яркость, оставили в одну строку */}
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500', marginTop: '2px' }}>
            {(fact || 0).toFixed(1)} км / {(plan || 0).toFixed(1)} км
          </div>
        </div>
      </div>
      
      {/* Полоска прогресса */}
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(displayPct, 100)}%`,
          height: '100%',
          background: barColor,
          boxShadow: `0 0 10px ${barColor}44`,
          transition: 'width 0.5s ease-out'
        }} />
      </div>
    </div>
  );
};

