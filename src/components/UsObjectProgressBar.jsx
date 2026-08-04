// Строка одного объекта УС: название + % готовности + полоска прогресса + сумма в тенге
export const UsObjectProgressBar = ({ name, percent, money, color }) => {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 5 }}>
        <div style={{ fontSize: 13, color: '#e2e8f0' }}>{name}</div>
        <div style={{ fontSize: 13, fontWeight: 'bold', color, marginLeft: 10, whiteSpace: 'nowrap' }}>{percent.toFixed(1)}%</div>
      </div>
      <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(percent, 100)}%`,
          height: '100%',
          background: color,
          boxShadow: `0 0 10px ${color}44`,
          transition: 'width 0.5s ease-out',
        }} />
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
        {Math.round(money).toLocaleString('ru-RU')} тнг
      </div>
    </div>
  );
};
