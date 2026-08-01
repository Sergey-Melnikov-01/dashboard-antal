import { HoverTooltip } from './HoverTooltip';

// Форматирует дату в dd.mm.yyyy (данные из API приходят как ISO-строка с временем)
const formatMusDate = (raw) => {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('ru-RU');
};

// Компактная строка одного объекта МУС: название сверху, снизу — 14 квадратиков-этапов (залит = выполнен) + "X/14"
export const MusStageDots = ({ musObject, color }) => {
  const { name, stages, doneCount, totalStages } = musObject;

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <HoverTooltip content={name} tooltipWidth={260}>
        <div style={{ fontSize: 13, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </div>
      </HoverTooltip>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
        <div style={{ display: 'flex', gap: 2, flex: 1, minWidth: 0 }}>
          {stages.map((s, i) => (
            <div key={i} style={{ flex: '1 1 auto', width: '100%', maxWidth: 15 }}>
              <HoverTooltip
                tooltipWidth={220}
                content={
                  <>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>{i + 1}. {s.name}</div>
                    <div style={{ color: '#94a3b8' }}>План: {formatMusDate(s.planDate)}</div>
                    <div style={{ color: s.done ? color : '#94a3b8' }}>Факт: {formatMusDate(s.factDate)}</div>
                  </>
                }
              >
                <div
                  style={{
                    width: '100%',
                    height: 11,
                    borderRadius: 2,
                    background: s.done ? color : 'transparent',
                    border: `1.5px solid ${s.done ? color : 'rgba(255,255,255,0.18)'}`,
                    transition: 'background 0.2s ease',
                  }}
                />
              </HoverTooltip>
            </div>
          ))}
        </div>
        <div style={{ flex: '0 0 auto', fontSize: 12, fontWeight: 700, color: doneCount === totalStages ? color : '#94a3b8' }}>
          {doneCount}/{totalStages}
        </div>
      </div>
    </div>
  );
};
