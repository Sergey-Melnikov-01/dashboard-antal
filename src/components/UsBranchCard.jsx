import { useState, useMemo } from 'react';
import { card } from '../styles/theme';
import { CircularProgress } from './CircularProgress';
import { UsObjectProgressBar } from './UsObjectProgressBar';
import { MusStageProgressBar } from './MusStageProgressBar';
import { US_TASKS } from '../data/usStages';

// Карточка одной ветки УС: гейдж среднего % + сумма в тенге + разворачиваемый список —
// либо по объектам (узлам связи), либо по этапам (38 шт.: сколько объектов ветки завершили этап)
export const UsBranchCard = ({ branchLabel, color, objects }) => {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState('objects'); // 'objects' | 'tasks'

  const total = objects.length;
  const avgPercent = total > 0 ? objects.reduce((s, o) => s + o.totalPercent, 0) / total : 0;
  const totalMoney = objects.reduce((s, o) => s + o.totalMoney, 0);
  const fullyDoneCount = objects.filter(o => o.fullyDone).length;

  // Сортируем по убыванию % — сверху самые близкие к завершению; объекты без прогресса (0%) не показываем
  const sortedObjects = [...objects]
    .filter(o => o.totalPercent > 0)
    .sort((a, b) => b.totalPercent - a.totalPercent);

  // По этапам: для каждого из 38 этапов считаем, сколько объектов ветки завершили его на 100%.
  // Этапы, где ещё ни один объект не завершён (0 из total), не показываем.
  const taskRows = useMemo(() => {
    if (total === 0) return [];
    return US_TASKS
      .map(task => {
        // Суммируем частичный прогресс по объектам: если у объекта задача выполнена на 50%,
        // она даёт 0.5 в общую сумму — а не только когда дошла до 100% (доля = баллы / вес задачи).
        // Параллельно считаем, сколько объектов вообще начали задачу (доля > 0) — для подписи "N узлов начали".
        let progressSum = 0;
        let startedCount = 0;
        objects.forEach(o => {
          const t = o.tasksByCode[task.code];
          if (!t) return;
          const share = Math.min(t.points / task.weight, 1);
          progressSum += share;
          if (share > 0) startedCount += 1;
        });
        return { code: task.code, name: `${task.code}. ${task.name}`, progressSum, startedCount };
      })
      .filter(t => t.progressSum > 0)
      .sort((a, b) => b.progressSum - a.progressSum);
  }, [objects, total]);

  return (
    <div style={{ ...card, flex: '1 1 340px', minWidth: 320 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {branchLabel}
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8' }}>{expanded ? '▲ свернуть' : '▼ развернуть'}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: expanded ? 16 : 0 }}>
        <CircularProgress percent={avgPercent} color={color} size={110} />
        <div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>{fullyDoneCount}</span> из {total} готовы
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Выполнено на</div>
          <div style={{ fontSize: 18, fontWeight: 800, color }}>{Math.round(totalMoney).toLocaleString('ru-RU')} тнг</div>
        </div>
      </div>

      {expanded && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('objects'); }}
              className={`bubbly-button ${viewMode === 'objects' ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              По узлам 
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('tasks'); }}
              className={`bubbly-button ${viewMode === 'tasks' ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              По этапам
            </button>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
            {viewMode === 'objects'
              ? sortedObjects.length > 0
                ? sortedObjects.map(obj => (
                    <UsObjectProgressBar
                      key={obj.id}
                      name={obj.name}
                      percent={obj.totalPercent}
                      money={obj.totalMoney}
                      color={color}
                    />
                  ))
                : <div style={{ color: '#64748b', fontSize: 13 }}>Нет прогресса ни у одного объекта</div>
              : taskRows.length > 0
                ? taskRows.map(t => (
                    <MusStageProgressBar
                      key={t.code}
                      stageName={t.name}
                      doneCount={+t.progressSum.toFixed(1)}
                      totalCount={total}
                      startedCount={t.startedCount}
                      color={color}
                    />
                  ))
                : <div style={{ color: '#64748b', fontSize: 13 }}>Нет прогресса ни по одному этапу</div>
            }
          </div>
        </>
      )}
    </div>
  );
};
