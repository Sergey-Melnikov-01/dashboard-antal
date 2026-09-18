import { useMemo, useState } from 'react';
import { card } from '../styles/theme';
import { parseMusSheet, MUS_BRANCH_META } from '../data/musStages';
import { MusBranchCard } from './MusBranchCard';
import { HoverTooltip } from './HoverTooltip';

// Даты этапов приходят из таблицы в виде ISO-строки ("2026-08-20T07:00:00.000Z") —
// показываем их в привычном виде ДД.ММ.ГГГГ; если строка не парсится как дата,
// просто возвращаем её как есть, чтобы ничего не потерять.
const formatStageDate = (raw) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('ru-RU');
};

// Вкладка «МУС»: общая шкала готовности + 3 карточки веток (зелёная/синяя/красная)
export const MusTab = ({ musData, musColors }) => {
  const objects = useMemo(() => parseMusSheet(musData, musColors), [musData, musColors]);
  const [selectedObj, setSelectedObj] = useState(null); // объект МУС, для которого открыта детальная карточка по этапам

  // Готовые проценты по веткам/общий — из строк-сводки внизу DB_PIR_MUS (колонка A: метка, колонка B: доля 0..1),
  // по тому же принципу, что и manualPct в PirTab.jsx
  const manualPct = useMemo(() => {
    const result = { total: null, green: null, blue: null, red: null };
    if (!Array.isArray(musData)) return result;
    musData.forEach(row => {
      if (!row) return;
      const cells = Array.isArray(row) ? row : Object.values(row);
      const label = String(cells[0] || '').toLowerCase().trim();
      if (!label) return;
      const val = parseFloat(cells[1]);
      if (isNaN(val) || val === 0) return;
      if (label.includes('общ')) result.total = val * 100;
      else if (label.includes('зелен')) result.green = val * 100;
      else if (label.includes('син') || label.includes('голуб')) result.blue = val * 100;
      else if (label.includes('красн')) result.red = val * 100;
    });
    return result;
  }, [musData]);

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
            Готовность ИРД МУС
          </div>
          {manualPct.total != null && (
            <div style={{ fontSize: 24, fontWeight: 900, color: '#2de2a6' }}>{manualPct.total.toFixed(1)}%</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 3, flex: 1, minWidth: 0 }}>
            {objects.map(obj => {
              const branchColor = MUS_BRANCH_META[obj.branch]?.color || '#94a3b8';
              const fillPct = (obj.doneCount / obj.totalStages) * 100;
              return (
                <div key={obj.id} onClick={() => setSelectedObj(obj)} style={{ flex: '1 1 0', minWidth: 0, maxWidth: 16, height: 16, cursor: 'pointer' }}>
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
          <div style={{ fontSize: 15, fontWeight: 800, color: '#2de2a6', flexShrink: 0 }}>
            {fullyDoneCount} <span style={{ color: '#94a3b8', fontWeight: 600 }}>из {total}</span>
          </div>
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
            manualPct={manualPct[bk]}
          />
        ))}
      </div>

      {/* Детальная карточка по этапам — открывается по клику на квадрат */}
      {selectedObj && (
        <div
          onClick={() => setSelectedObj(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#161722', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 22, width: '100%', maxWidth: 480,
              maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>{selectedObj.name}</div>
              <button
                onClick={() => setSelectedObj(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 12, color: MUS_BRANCH_META[selectedObj.branch]?.color, fontWeight: 700, marginBottom: 4 }}>
              {MUS_BRANCH_META[selectedObj.branch]?.label}
            </div>

            {(selectedObj.region || selectedObj.district) && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                {[selectedObj.region, selectedObj.district].filter(Boolean).join(', ')}
              </div>
            )}

            <div style={{
              display: 'flex', justifyContent: 'space-between', fontSize: 13,
              marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <span style={{ color: '#94a3b8' }}>Выполнено этапов</span>
              <span style={{ color: MUS_BRANCH_META[selectedObj.branch]?.color, fontWeight: 800 }}>
                {selectedObj.doneCount} из {selectedObj.totalStages}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selectedObj.stages.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5 }}>
                  <div style={{
                    flexShrink: 0, width: 18, height: 18, borderRadius: '50%', marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: s.done ? MUS_BRANCH_META[selectedObj.branch]?.color : 'rgba(255,255,255,0.08)',
                    color: s.done ? '#0b0c10' : '#6b7280',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: s.done ? '#e2e8f0' : '#94a3b8' }}>{s.name}</div>
                    <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
                      {s.factDate
                        ? <>Факт: <span style={{ color: '#2de2a6' }}>{formatStageDate(s.factDate)}</span></>
                        : s.planDate
                          ? <>План: {formatStageDate(s.planDate)}</>
                          : 'Дата не указана'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
