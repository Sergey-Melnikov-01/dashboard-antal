// Строка прогресса по ОДНОМУ этапу, агрегированная по всей ветке МУС
// (сколько объектов из ветки прошли этот этап) — по аналогии с ProgressBar на вкладке "ПИР - Ветки"
export const MusStageProgressBar = ({ stageName, doneCount, totalCount, color }) => {
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#e2e8f0' }}>{stageName}</div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color, whiteSpace: 'nowrap', marginLeft: 10 }}>
          {doneCount} из {totalCount}
        </div>
      </div>
      <div style={{ height: '7px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`,
          height: '100%',
          background: color,
          boxShadow: `0 0 10px ${color}44`,
          transition: 'width 0.5s ease-out'
        }} />
      </div>
    </div>
  );
};
