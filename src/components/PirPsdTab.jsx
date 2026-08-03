import { useState, useEffect, useMemo } from 'react';
import { card, lbl } from '../styles/theme';
import { toNum } from '../utils/format';
import { ProgressBar } from './ProgressBar';
import { PirTab } from './PirTab';
import { MusTab } from './MusTab';

// Единый стиль для всех переключателей режимов (ПИР / ПИР-Ветки / МУС-Ветки) — чтобы они гарантированно выглядели одинаково
const modeButtonStyle = { padding: '8px 18px', fontSize: '13px' };

// Обёртка вкладки «ПИР/ПСД»: переключатель режимов (ПИР / Ветки / ПСД) + их содержимое
export const PirPsdTab = ({ activeTab, pirData, pirVolsData, musData, musColors }) => {
  const [pirMode, setPirMode] = useState('psd');

  useEffect(() => {
    if (activeTab === 'pir') {
      setPirMode('pir');
    }
  }, [activeTab]);

  // -----------------------------
  // PIR Stage Tracking (DB_PIR — новый формат: Трекер ВОЛС / Трекер МУС)
  // -----------------------------
  const pirStages = useMemo(() => {
    const vols = [];
    const mus = [];
    let currentTracker = null;

    (pirData || []).forEach(r => {
      // Первая колонка — название строки/этапа
      const title = String(
        r["ПИР План-фактный анализ 25.06"] ??
        r["Название"] ??
        r["Этап"] ??
        Object.values(r)[0] ??
        ''
      ).trim();

      if (!title) return;

      if (title.includes('Трекер ВОЛС')) { currentTracker = 'vols'; return; }
      if (title.includes('Трекер МУС'))  { currentTracker = 'mus';  return; }

      const unit   = String(r["Unnamed: 1"] ?? r["Единица измерения"] ?? r["Еденица измерения"] ?? '').trim();
      const plan   = toNum(r["Unnamed: 2"] ?? r["Объём (план)"] ?? 0);
      const fact   = toNum(r["Unnamed: 3"] ?? r["Объём (факт)"] ?? 0);
      const rawPct = r["Unnamed: 4"] ?? r["% Выполнения"] ?? r["% выполнения"] ?? 0;
      const pct    = toNum(rawPct);

      if (plan > 0 || fact > 0 || pct > 0) {
        const item = { name: title, unit, plan, fact, pct };
        if (currentTracker === 'vols') vols.push(item);
        if (currentTracker === 'mus')  mus.push(item);
      }
    });

    // Сортируем списки по убыванию процента выполнения
    const sortedVols = [...vols];
    const sortedMus = [...mus];

    return { vols: sortedVols, mus: sortedMus };
  }, [pirData]);

  return (
    <>
      {/* Кнопки ПИР / ПСД */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setPirMode('pir')}
          className={`bubbly-button ${pirMode === 'pir' ? 'active' : ''}`}
          aria-pressed={pirMode === 'pir'}
          style={modeButtonStyle}
        >
          ПИР
        </button>
        <button
          onClick={() => setPirMode('vetki')}
          className={`bubbly-button ${pirMode === 'vetki' ? 'active' : ''}`}
          aria-pressed={pirMode === 'vetki'}
          style={modeButtonStyle}
        >
          ПИР - Ветки
        </button>
        <button
          onClick={() => setPirMode('mus')}
          className={`bubbly-button ${pirMode === 'mus' ? 'active' : ''}`}
          aria-pressed={pirMode === 'mus'}
          style={modeButtonStyle}
        >
          МУС - Ветки
        </button>
         {false && (<button
          onClick={() => setPirMode('psd')}
          className={`bubbly-button ${pirMode === 'psd' ? 'active' : ''}`}
          aria-pressed={pirMode === 'psd'}
          style={modeButtonStyle}
        >
          ПСД
        </button>
          )} 
      </div>

      {pirMode === 'pir' && (
        <>
          {/* Трекер ВОЛС во всю ширину */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            <div style={card}>
              <div style={{
                ...lbl,
                color: '#2de2a6',
                fontSize: '13px',
                fontWeight: '800',
                borderBottom: '1px solid rgba(45,226,166,0.15)',
                paddingBottom: '10px',
                marginBottom: '20px',
                letterSpacing: '1px'
              }}>
                 ТРЕКЕР ВОЛС — Линейная часть
              </div>
              {pirStages.vols.length > 0
                ? pirStages.vols.map((s, i) => (
                    <ProgressBar key={i} label={s.name} plan={s.plan} fact={s.fact} pct={s.pct} unit={s.unit} />
                  ))
                : <div style={{ color: '#64748b', fontSize: 13 }}>Нет данных по ВОЛС</div>
              }
            </div>
          </div>
        </>
      )}
      {pirMode === 'vetki' && (
        <PirTab pirVolsData={pirVolsData} />
      )}
      {pirMode === 'mus' && (
        <MusTab musData={musData} musColors={musColors} />
      )}
      {pirMode === 'psd' && (
        <div style={{
          ...card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 180,
          textAlign: 'center',
          color: '#cbd5e1',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>ПСД — в разработке</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>Здесь будет детализация по проектно-сметной документации.</div>
          </div>
        </div>
      )}
    </>
  );
};
