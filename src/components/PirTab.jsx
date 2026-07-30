import React, { useMemo } from 'react';
import { card } from '../styles/theme';
import { PIR_STAGE_NAMES, PIR_ROUTES_DATA, PIR_BRANCH_META } from '../data/pirStages';
import { PirBranchCard } from './PirBranchCard';

export const PirTab = ({ pirVolsData }) => {
  const routesData = useMemo(() => {
  if (!Array.isArray(pirVolsData) || pirVolsData.length === 0) return PIR_ROUTES_DATA;
  const today = new Date();
  const routes = [];
  pirVolsData.forEach(row => {
    const cells = Array.isArray(row) ? row : Object.values(row || {});
    // Маршрут определяем по колонке "Ветка" (index 4) — строки 174-177 и заголовки не имеют ветки
    const branchRaw = String(cells[4] || '').toLowerCase().trim();
    let branch = null;
    if (branchRaw.includes('зелен')) branch = 'green';
    else if (branchRaw.includes('син') || branchRaw.includes('голуб')) branch = 'blue';
    else if (branchRaw.includes('красн')) branch = 'red';
    if (!branch) return; // не маршрут — пропускаем
    const name = String(cells[3] || cells[0] || '').trim();
    const km = parseFloat(cells[5]) || 0;
    const stages = [];
    for (let i = 0; i < 21; i++) {
      const planDate = String(cells[9 + i * 2] || '').trim() || null;
      const factDate = String(cells[10 + i * 2] || '').trim() || null;
      const done = factDate ? new Date(factDate) <= today : false;
      stages.push({ name: PIR_STAGE_NAMES[i] || `Этап ${i + 1}`, planDate, factDate, done });
    }
    routes.push({ id: routes.length + 1, name, region: String(cells[0] || '').trim(), district: String(cells[1] || '').trim(), branch, km, stages });
  });
  return routes.length > 0 ? routes : PIR_ROUTES_DATA;
}, [pirVolsData]);

const manualPct = useMemo(() => {
  const result = { total: null, green: null, blue: null, red: null };
  if (!Array.isArray(pirVolsData)) return result;
  for (let ri = 0; ri < pirVolsData.length; ri++) {
    const row = pirVolsData[ri];
    if (!row) continue;
    const label = String(row[0] || '').toLowerCase().trim(); // ← col A: метка
    if (!label) continue;
    const val = parseFloat(row[1]); // ← col B: десятичное значение
    if (isNaN(val) || val === 0) continue;
    if (label.includes('общ')) result.total = val * 100;
    else if (label.includes('зелен')) result.green = val * 100;
    else if (label.includes('синя') || label.includes('голуб')) result.blue = val * 100;
    else if (label.includes('красн')) result.red = val * 100;
  }
  return result;
}, [pirVolsData]);

  const grouped = useMemo(() => {
    const g = { green: [], red: [], blue: [] };
    routesData.forEach(r => { if (g[r.branch]) g[r.branch].push(r); });
    return g;
  }, [routesData]);

  const totals = useMemo(() => {
    const totalKm = routesData.reduce((s, r) => s + (r.km || 0), 0);
    let completedKm = 0;
    routesData.forEach(r => {
      const doneStages = r.stages.reduce((c, st) => c + (st.done ? 1 : 0), 0);
      completedKm += (r.kmы || 0) * (doneStages / 21);
    });
    const pct = totalKm > 0 ? (completedKm / totalKm) * 100 : 0;
    return { routes: routesData.length, totalKm, pct };
  }, [routesData]);

  return (
    <>
      {/* Сводка сверху — прогресс-бар протяжённости */}
      {(() => {
        const displayPct = manualPct.total != null ? manualPct.total : totals.pct;
        const doneKm = totals.totalKm * (displayPct / 100);
        const fillPct = Math.min(displayPct, 100);
        return (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 4 }}>
                Общая готовность ПИР</div>
            </div>

            {/* Закруглённый бар */}
            <div style={{ position: 'relative', height: 34, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${fillPct}%`,
                minWidth: 60,
                background: 'linear-gradient(90deg, #17b98a 0%, #2de2a6 100%)',
                borderRadius: 999,
                boxShadow: '0 0 16px rgba(45,226,166,0.45)',
                transition: 'width 0.7s ease-out',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 14,
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0b1120', whiteSpace: 'nowrap' }}>
                  {displayPct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Карточки веток */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
        {['green','blue', 'red'].map(bk => (
          <PirBranchCard
            key={bk}
            branchKey={bk}
            branchLabel={PIR_BRANCH_META[bk].label}
            color={PIR_BRANCH_META[bk].color}
            routes={grouped[bk]}
            manualPct={manualPct[bk]}
          />
        ))}
      </div>
    </>
  );
};



