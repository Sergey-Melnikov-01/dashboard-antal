import { useState } from 'react';
import { card } from '../styles/theme';
import { MusStageDots } from './MusStageDots';

// Карточка одной ветки МУС: "X из Y готовы" + разворачиваемый список объектов
export const MusBranchCard = ({ branchKey, branchLabel, color, objects }) => {
  const [expanded, setExpanded] = useState(false);

  const total = objects.length;
  const fullyDoneCount = objects.filter(o => o.fullyDone).length;

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
          {objects.length > 0
            ? objects.map(obj => <MusStageDots key={obj.id} musObject={obj} color={color} />)
            : <div style={{ color: '#64748b', fontSize: 13 }}>Нет объектов в этой ветке</div>
          }
        </div>
      )}
    </div>
  );
};
