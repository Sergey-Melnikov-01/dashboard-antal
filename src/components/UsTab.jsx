import { useMemo } from 'react';
import { card } from '../styles/theme';
import { parseUsSheet, US_BRANCH_META } from '../data/usStages';
import { CircularProgress } from './CircularProgress';
import { UsBranchCard } from './UsBranchCard';

// Вкладка «УС»: общий гейдж готовности + 3 карточки веток (гейдж ветки + список объектов), по образцу листа Dashboard из Excel
export const UsTab = ({ usGreenData, usBlueData, usRedData }) => {
  const green = useMemo(() => parseUsSheet(usGreenData), [usGreenData]);
  const blue = useMemo(() => parseUsSheet(usBlueData), [usBlueData]);
  const red = useMemo(() => parseUsSheet(usRedData), [usRedData]);

  const all = useMemo(() => [...green, ...blue, ...red], [green, blue, red]);
  const total = all.length;

  if (total === 0) {
    return (
      <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: 180, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#6b7280' }}>Нет данных по УС (проверьте DB_US_GREEN/BLUE/RED в API)</div>
      </div>
    );
  }

  const overallPercent = all.reduce((s, o) => s + o.totalPercent, 0) / total;
  const overallMoney = all.reduce((s, o) => s + o.totalMoney, 0);
  const overallFullyDone = all.filter(o => o.fullyDone).length;

  return (
    <>
      {/* Общий гейдж готовности */}
      <div style={{ ...card, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <CircularProgress percent={overallPercent} color="#2de2a6" size={140} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 8 }}>
            Общая готовность МУС
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0' }}>{overallFullyDone}</span> из {total} объектов готовы
          </div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Выполнено на</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#2de2a6' }}>{Math.round(overallMoney).toLocaleString('ru-RU')} тнг</div>
        </div>
      </div>

      {/* Карточки веток */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        <UsBranchCard branchLabel={US_BRANCH_META.green.label} color={US_BRANCH_META.green.color} objects={green} />
        <UsBranchCard branchLabel={US_BRANCH_META.blue.label} color={US_BRANCH_META.blue.color} objects={blue} />
        <UsBranchCard branchLabel={US_BRANCH_META.red.label} color={US_BRANCH_META.red.color} objects={red} />
      </div>
    </>
  );
};
