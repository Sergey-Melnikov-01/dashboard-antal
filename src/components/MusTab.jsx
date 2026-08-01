import { useMemo } from 'react';
import { card } from '../styles/theme';
import { parseMusSheet, MUS_BRANCH_META } from '../data/musStages';
import { MusBranchCard } from './MusBranchCard';
import { HoverTooltip } from './HoverTooltip';

// Вкладка «МУС»: общая шкала готовности + 3 карточки веток (зелёная/синяя/красная)
export const MusTab = ({ musData, musColors }) => {
  const objects = useMemo(() => parseMusSheet(musData, musColors), [musData, musColors]);

  const total = objects.length;
  const fullyDoneCount = objects.filter(o => o.fullyDone).length;

  const grouped = useMemo(() => {
    const g = { green: [], blue: [], red: [] };
    objects.forEach(o => { if (g[o.branch]) g[o.branch].push(o); });
    return g;
  }, [objects]);

  if (total === 0) {
    return (
      <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: 180, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Нет данных по МУС (проверьте DB_PIR_MUS и DB_PIR_MUS_COLORS в API)</div>
      </div>
    );
  }

  return (
    <>
      {/* Общая шкала готовности */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1.2px' }}>
            Готовность МУС
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#2de2a6' }}>
            {fullyDoneCount} <span style={{ color: '#94a3b8', fontWeight: 600 }}>из {total}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 3 }}>
          {objects.map(obj => {
            const branchColor = MUS_BRANCH_META[obj.branch]?.color || '#94a3b8';
            const fillPct = (obj.doneCount / obj.totalStages) * 100;
            return (
              <div key={obj.id} style={{ flex: '1 1 0', minWidth: 0, maxWidth: 16, height: 16 }}>
                <HoverTooltip
                  tooltipWidth={220}
                  content={
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 3 }}>{obj.name}</div>
                      <div style={{ color: '#94a3b8' }}>{MUS_BRANCH_META[obj.branch]?.label || ''}</div>
                      <div style={{ color: branchColor, fontWeight: 700, marginTop: 3 }}>{obj.doneCount}/{obj.totalStages} этапов</div>
                    </>
                  }
                >
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      borderRadius: 3,
                      border: `1.5px solid ${obj.doneCount > 0 ? branchColor : 'rgba(255,255,255,0.15)'}`,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Заливка пропорционально числу выполненных этапов (X из 14), без видимых делений */}
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${fillPct}%`,
                      background: branchColor,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </HoverTooltip>
              </div>
            );
          })}
        </div>
      </div>

      {/* Карточки веток */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {['green', 'blue', 'red'].map(bk => (
          <MusBranchCard
            key={bk}
            branchKey={bk}
            branchLabel={MUS_BRANCH_META[bk].label}
            color={MUS_BRANCH_META[bk].color}
            objects={grouped[bk]}
          />
        ))}
      </div>
    </>
  );
};
