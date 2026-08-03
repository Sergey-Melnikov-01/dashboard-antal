// Извлекает единицу измерения из названия материала (после последней запятой), например "Кабель ОК48, м" -> "м"
const extractUnit = (name) => {
  const parts = String(name || '').split(',');
  return parts.length > 1 ? parts[parts.length - 1].trim() : '';
};

// Список материалов в виде полосок прогресса (план/факт) — вместо бар-чарта,
// чтобы позиции с сильно разным масштабом (кабель в метрах vs штучные материалы) были одинаково читаемы
export const TmcMaterialList = ({ data }) => {
  return (
    <div>
      {data.map((item, i) => {
        const pct = item.plan > 0 ? (item.fact / item.plan) * 100 : 0;
        const barColor = pct < 30 ? '#ff4d4d' : pct < 90 ? '#ff9b45' : '#2de2a6';
        const unit = extractUnit(item.name);

        return (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{item.name}</div>
              <div style={{ textAlign: 'right', flex: '0 0 auto', marginLeft: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: barColor }}>{pct.toFixed(1)}%</div>
              </div>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(pct, 100)}%`,
                height: '100%',
                background: barColor,
                boxShadow: `0 0 10px ${barColor}44`,
                transition: 'width 0.5s ease-out',
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              {Math.round(item.fact).toLocaleString('ru-RU')} {unit} / {Math.round(item.plan).toLocaleString('ru-RU')} {unit}
            </div>
          </div>
        );
      })}
    </div>
  );
};
