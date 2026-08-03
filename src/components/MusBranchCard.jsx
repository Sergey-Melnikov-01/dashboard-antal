import { useState, useMemo } from 'react';
import { card } from '../styles/theme';
import { MUS_STAGE_NAMES } from '../data/musStages';
import { MusStageProgressBar } from './MusStageProgressBar';

// Карточка одной ветки МУС: "X из Y готовы" + "X из Y согласовано" + разворачиваемая сводка по 14 этапам
export const MusBranchCard = ({ branchKey, branchLabel, color, objects }) => {
  const [expanded, setExpanded] = useState(false);

  const total = objects.length;
  const fullyDoneCount = objects.filter(o => o.fullyDone).length;
  const approvedCount = objects.filter(o => o.approved).length;

  // Агрегация по каждому из 14 этапов: сколько объектов ветки прошли этот этап.
  // Этапы, где прогресс = 0, не показываем (аналогично вкладке "ПИР - Ветки")
  const stageAgg = useMemo(() => {
    return MUS_STAGE_NAMES
      .map((stageName, i) => ({
        stageName,
        doneCount: objects.filter(o => o.stages[i]?.done).length,
      }))
      .filter(s => s.doneCount > 0);
  }, [objects]);

  return (
    <div style={{ ...card, flex: '1 1 320px', minWidth: 300 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {branchLabel}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{expanded ? '▲ свернуть' : '▼ развернуть'}</div>
      </div>

      <div style={{ marginTop: 14, marginBottom: expanded ? 14 : 0 }}>
        <div style={{ fontSize: 30, fontWeight: 900, color }}>
          {fullyDoneCount} <span style={{ fontSize: 16, color: '#94a3b8', fontWeight: 600 }}>из {total} МУС</span>
        </div>
      </div>

      {expanded && (
        <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          <MusStageProgressBar
            stageName="Согласовано заказчиком"
            doneCount={approvedCount}
            totalCount={total}
            color={color}
          />
          {stageAgg.length > 0
            ? stageAgg.map(s => (
                <MusStageProgressBar
                  key={s.stageName}
                  stageName={s.stageName}
                  doneCount={s.doneCount}
                  totalCount={total}
                  color={color}
                />
              ))
            : <div style={{ color: '#64748b', fontSize: 13 }}>Нет прогресса ни по одному этапу</div>
          }
        </div>
      )}
    </div>
  );
};
