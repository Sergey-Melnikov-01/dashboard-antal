import { useState, useMemo } from 'react';
import { CircularProgress } from './CircularProgress';
import { StageProgressBar } from './StageProgressBar';
import { PIR_STAGE_NAMES } from '../data/pirStages';

const STAGES_COUNT = PIR_STAGE_NAMES.length;
const STAGES_VISIBLE = 11;      // сколько позиций видно без прокрутки
const STAGE_ROW_HEIGHT = 46;    // высота одной строки этапа, px (подстройте при необходимости)

export const PirBranchCard = ({ branchKey, branchLabel, routes, color, manualPct }) => {
  const [expanded, setExpanded] = useState(false);

  const agg = useMemo(() => {
    const totalKm = routes.reduce((s, r) => s + (r.km || 0), 0);
    // Прогресс, взвешенный по километражу: вклад маршрута = его км × (выполнено этапов / число этапов)
    let completedKm = 0;
    routes.forEach(r => {
      const doneStages = r.stages.reduce((c, st) => c + (st.done ? 1 : 0), 0);
      completedKm += (r.km || 0) * (doneStages / STAGES_COUNT);
    });
    const overallPercent = totalKm > 0 ? (completedKm / totalKm) * 100 : 0;

    // Активные этапы: где хоть у одного маршрута есть план или факт; прогресс по км
    const stages = [];
    for (let i = 0; i < STAGES_COUNT; i++) {
      const active = routes.some(r => r.stages[i] && (r.stages[i].planDate || r.stages[i].factDate));
      if (!active) continue;
      const doneKm = routes.reduce((s, r) => s + (r.stages[i] && r.stages[i].done ? (r.km || 0) : 0), 0);
      stages.push({ idx: i, name: (routes[0] && routes[0].stages[i] ? routes[0].stages[i].name : `Этап ${i + 1}`), doneKm });
    }
    // Показываем только этапы, где выполнено хоть сколько-то км (с нулём — скрыты)
    const visibleStages = stages.filter(s => s.doneKm > 0);
    return { totalKm, overallPercent, completedKm, stages, visibleStages };
  }, [routes]);

  

  return (
    <div style={{
      background: '#1a2332', border: `1px solid ${color}33`, borderRadius: 18, padding: 20,
      display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      flex: '1 1 300px', minWidth: 280,
    }}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}88`, flexShrink: 0 }} />
        <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff' }}>{branchLabel}</div>
      </div>

      {/* Круговой прогресс */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <CircularProgress percent={manualPct != null ? manualPct : agg.overallPercent} color={color} decimals={1} />
      </div>

      {/* Детализация этапов */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12 }}>
            Этапы ({agg.visibleStages.length})
          </div>
          {/* Окно на ~11 позиций, остальные — прокруткой вниз */}
          <div style={{
            maxHeight: STAGES_VISIBLE * STAGE_ROW_HEIGHT,
            overflowY: 'auto',
            paddingRight: 6,
            scrollbarWidth: 'thin',
            scrollbarColor: `${color}66 transparent`,
          }}>
            {agg.visibleStages.map(s => (
              <StageProgressBar key={s.idx} stageName={s.name} doneKm={s.doneKm} totalKm={agg.totalKm} color={color} />
            ))}
          </div>
        </div>
      )}

      {/* Кнопка */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          marginTop: 'auto', background: 'transparent', border: `1px solid ${color}55`,
          color, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        {expanded ? 'Свернуть ▲' : 'Подробнее ▼'}
      </button>
    </div>
  );
};

// PIR вкладка — три карточки веток
