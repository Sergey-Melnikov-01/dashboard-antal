import { useState, useEffect, useMemo } from 'react';

import { parseDate, toNum } from './utils/format';
import { ProgressBar } from './components/ProgressBar';
import { PirTab } from './components/PirTab';
import { useDashboardData } from './hooks/useDashboardData';
import { useSharedFilters } from './hooks/useSharedFilters';
import { useDatasetView, filterRows } from './hooks/useDatasetView';
import { PushDropdown } from './components/PushDropdown';
import { MaterialsTab } from './components/MaterialsTab';
import { PirPsdTab } from './components/PirPsdTab';
import { MetricTrendChart } from './components/MetricTrendChart';
import { SmrTab } from './components/SmrTab';
import { UsTab } from './components/UsTab';
import { VolsMapTab } from './components/VolsMapTab';

const bg = '#1c1d26';
const card = { background: '#21222d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' };
const lbl = { color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' };


// ProgressBar — компонент для трекера этапов ПИР
export default function App() {
  const { allData, metricsData, pirData, pirVolsData, musData, musColors, usGreenData, usBlueData, usRedData, tmcData, tmcDvaData, datesData, smrPercentData, volsRouteData, musVolsData, codVolsData, loading } = useDashboardData();
  const [activeTab, setActiveTab] = useState('construction'); // 'construction' | 'schedule' (metrics)
  const [animatingTab, setAnimatingTab] = useState(null);

  // Global filter states (shared across tabs as requested)
  const {
    selectedBranch, setSelectedBranch,
    selectedContractor, setSelectedContractor,
    selectedSection, setSelectedSection,
    selectedDate, setSelectedDate,
    openDropdown, setOpenDropdown,
  } = useSharedFilters();

  // Метрики: какие графики сейчас показывать под KPI-карточками (массив, можно несколько сразу; [] = все выключены)
  const [selectedMetricCharts, setSelectedMetricCharts] = useState([]);


  // PIR-specific region filter
  const [selectedPirRegion, setSelectedPirRegion] = useState('Все');

  const tabs = [
    { id: 'construction', label: '🏗️ СМР' },
    { id: 'schedule', label: '📈 Метрики' },
    { id: 'materials', label: '📦 ТМЦ' },
    { id: 'pir', label: '📋 ПИР/ПСД' },
    { id: 'us', label: '📡 МУС' },
    // { id: 'map', label: '🗺️ Карта' }, // временно скрыто перед публикацией — включить обратно раскомментировав эту строку
  ];

  const handleTabClick = (id) => {
    setActiveTab(id);
    setAnimatingTab(id);
    setTimeout(() => setAnimatingTab(null), 700);
  };



  // -----------------------------
  // COMMON (for СМР)
  // -----------------------------
  const dates = useMemo(() => {
    return [...new Set(allData.map(r => r["Дата отчета"]).filter(Boolean))]
      .sort((a, b) => parseDate(a) - parseDate(b));
  }, [allData]);

  // Нужны как запасной вариант для фильтров на вкладке «Метрики» (если metricsBranches/metricsContractors/metricsSections пустые)
  const branches = useMemo(() => {
    return [...new Set(allData.map(r => r["Ветка"]).filter(Boolean))];
  }, [allData]);

  const contractors = useMemo(() => {
    return [...new Set(allData.map(r => r["Подрядчик"]).filter(Boolean))];
  }, [allData]);

  const sections = useMemo(() => {
    return [...new Set(
      filterRows(allData, { branch: selectedBranch, contractor: selectedContractor })
        .map(r => r["Участок"]).filter(Boolean)
    )];
  }, [allData, selectedBranch, selectedContractor]);

  const latestDate = dates.length ? dates[dates.length - 1] : '';
  const activeDate = selectedDate && dates.includes(selectedDate) ? selectedDate : (latestDate || '');

  // -----------------------------
  // METRICS (DB_METRIC) — new section
  // -----------------------------
  const metricsDates = useMemo(() => {
    return [...new Set(metricsData.map(r => r["Дата отчета"]).filter(Boolean))]
      .sort((a, b) => parseDate(a) - parseDate(b));
  }, [metricsData]);

  const metricsLatestDate = metricsDates.length ? metricsDates[metricsDates.length - 1] : '';
  const metricActiveDate = selectedDate && metricsDates.includes(selectedDate) ? selectedDate : (metricsLatestDate || '');

  const metricsBranches = useMemo(() => {
    return [...new Set(metricsData.map(r => r["Ветка"]).filter(Boolean))];
  }, [metricsData]);

  const metricsContractors = useMemo(() => {
    return [...new Set(metricsData.map(r => r["Подрядчик"]).filter(Boolean))];
  }, [metricsData]);

  const metricsSections = useMemo(() => {
    return [...new Set(
      filterRows(metricsData, { branch: selectedBranch, contractor: selectedContractor })
        .map(r => r["Участок"]).filter(Boolean)
    )];
  }, [metricsData, selectedBranch, selectedContractor]);

  const metricsFiltered = useDatasetView(metricsData, {
    branch: selectedBranch,
    contractor: selectedContractor,
    section: selectedSection,
    date: metricActiveDate,
  });

  // KPI for metrics — now includes pct for all groups
  const metricsKPI = useMemo(() => {
    const cablePlan = metricsFiltered.reduce((s, r) => s + toNum(r["Кабель План"]), 0);
    const cableFact = metricsFiltered.reduce((s, r) => s + toNum(r["Кабель Факт"]), 0);
    const pipePlan = metricsFiltered.reduce((s, r) => s + toNum(r["Труба План"]), 0);
    const pipeFact = metricsFiltered.reduce((s, r) => s + toNum(r["Труба Факт"]), 0);
    const backfillPlan = metricsFiltered.reduce((s, r) => s + toNum(r["Засыпка План"]), 0);
    const backfillFact = metricsFiltered.reduce((s, r) => s + toNum(r["Засыпка Факт"]), 0);
    const hddPlan = metricsFiltered.reduce((s, r) => s + toNum(r["ГНБ План"]), 0);
    const hddFact = metricsFiltered.reduce((s, r) => s + toNum(r["ГНБ Факт"]), 0);

    // Отклонения (метры): fact - plan
    const cableDev = +((cableFact - cablePlan).toFixed(1));
    const pipeDev = +((pipeFact - pipePlan).toFixed(1));
    const backfillDev = +((backfillFact - backfillPlan).toFixed(1));
    const hddDev = +((hddFact - hddPlan).toFixed(1));

    return {
      cablePlan, cableFact, cableDev,
      pipePlan, pipeFact, pipeDev,
      backfillPlan, backfillFact, backfillDev,
      hddPlan, hddFact, hddDev
    };
  }, [metricsFiltered]);

  // Динамика по датам для всех 4 категорий метрик (Кабель/Труба/Засыпка/ГНБ)
  const metricsTrend = useMemo(() => {
    return metricsDates.map(date => {
      const rows = filterRows(metricsData, {
        date,
        branch: selectedBranch,
        contractor: selectedContractor,
        section: selectedSection,
      });
      const cableP = rows.reduce((s, r) => s + toNum(r["Кабель План"]), 0);
      const cableF = rows.reduce((s, r) => s + toNum(r["Кабель Факт"]), 0);
      const pipeP = rows.reduce((s, r) => s + toNum(r["Труба План"]), 0);
      const pipeF = rows.reduce((s, r) => s + toNum(r["Труба Факт"]), 0);
      const backfillP = rows.reduce((s, r) => s + toNum(r["Засыпка План"]), 0);
      const backfillF = rows.reduce((s, r) => s + toNum(r["Засыпка Факт"]), 0);
      const hddP = rows.reduce((s, r) => s + toNum(r["ГНБ План"]), 0);
      const hddF = rows.reduce((s, r) => s + toNum(r["ГНБ Факт"]), 0);
      return {
        date,
        cablePlan: +cableP.toFixed(1), cableFact: +cableF.toFixed(1),
        pipePlan: +pipeP.toFixed(1), pipeFact: +pipeF.toFixed(1),
        backfillPlan: +backfillP.toFixed(1), backfillFact: +backfillF.toFixed(1),
        hddPlan: +hddP.toFixed(1), hddFact: +hddF.toFixed(1),
      };
    });
  }, [metricsDates, metricsData, selectedBranch, selectedContractor, selectedSection]);

  // Данные для графика выбранной в фильтре "Графики" категории, в формате { date, plan, fact } — как у trendData на СМР
  const metricChartConfig = {
    'Кабель': { planKey: 'cablePlan', factKey: 'cableFact', unit: 'км' },
    'Труба': { planKey: 'pipePlan', factKey: 'pipeFact', unit: 'км' },
    'Засыпка': { planKey: 'backfillPlan', factKey: 'backfillFact', unit: 'км' },
    'ГНБ': { planKey: 'hddPlan', factKey: 'hddFact', unit: 'м' },
  };
  const metricChartDataByCategory = useMemo(() => {
    const result = {};
    Object.entries(metricChartConfig).forEach(([catName, cfg]) => {
      result[catName] = metricsTrend.map(row => ({ date: row.date, plan: row[cfg.planKey], fact: row[cfg.factKey] }));
    });
    return result;
  }, [metricsTrend]);

  const metricsSectionBars = useMemo(() => {
    // aggregate per section for current metric date & filters
    const map = {};
    metricsFiltered.forEach(r => {
      const key = r["Участок"] || '—';
      if (!map[key]) map[key] = { section: key, cablePlan: 0, cableFact: 0 };
      map[key].cablePlan += toNum(r["Кабель План"]);
      map[key].cableFact += toNum(r["Кабель Факт"]);
    });
    return Object.values(map).sort((a, b) => b.cablePlan + b.cableFact - (a.cablePlan + a.cableFact));
  }, [metricsFiltered]);

  // -----------------------------
  // ТМЦ (DB_TMC / DB_TMCdva)
  // -----------------------------
  // ТМЦ: активный датасет

  // -----------------------------
  // PIR (DB_PIR) — new section (one chart + region filter)
  // -----------------------------
  const pirRegions = useMemo(() => {
    return [...new Set((pirData || []).map(r => r["Регион"]).filter(Boolean))].sort();
  }, [pirData]);

  const pirProcessed = useMemo(() => {
    if (!Array.isArray(pirData) || pirData.length === 0) return [];
    return pirData
      .map(r => {
        const name = r["Участок"] ?? r["Участок  "] ?? r["Участок "] ?? '';
        const region = r["Регион"] ?? 'Не указан';
        const rawPct = r["% ПСД"] ?? r["%ПСД"] ?? r["% ПСД "] ?? r["% ПСД  "] ?? '';
        const pct = Number(String(rawPct).toString().replace(',', '.')) || 0;
        const status = r["Статус ПСД"] ?? '';
        return { name: String(name).trim(), region: String(region).trim(), progress: pct, status };
      })
      .filter(x => x.name);
  }, [pirData]);

  const pirFiltered = useMemo(() => {
    const arr = pirProcessed.slice();
    const filteredArr = selectedPirRegion && selectedPirRegion !== 'Все'
      ? arr.filter(r => (r.region || '').toLowerCase().includes(selectedPirRegion.toLowerCase()))
      : arr;
    filteredArr.sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));
    return filteredArr;
  }, [pirProcessed, selectedPirRegion]);

  const pirKPI = useMemo(() => {
    const done = pirFiltered.filter(d => d.progress >= 100).length;
    const inProgress = pirFiltered.filter(d => d.progress > 0 && d.progress < 100).length;
    const notStarted = pirFiltered.filter(d => d.progress <= 0).length;
    return { done, inProgress, notStarted };
  }, [pirFiltered]);


  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1c1d26', color: 'white', fontFamily: 'sans-serif' }}>
      Загрузка аналитики АНТАЛ...
    </div>
  );

  // choose date options based on active tab
  const dateOptionsForDropdown = activeTab === 'schedule' ? metricsDates : dates;

  return (
    <div className="app-wrapper" style={{ minHeight: '100vh', background: bg, color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>
          DASHBOARD <span style={{ color: '#2de2a6' }}>ANTAL</span>
        </h1>
        <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'right' }}>
          ДАННЫЕ ОБНОВЛЕНЫ:<br />
          <span style={{ color: 'white', fontWeight: 'bold' }}>{activeTab === 'schedule' ? (metricActiveDate || '—') : (activeDate || '—')}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container" style={{ marginBottom: '24px' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`bubbly-button ${activeTab === tab.id ? 'active' : ''} ${animatingTab === tab.id ? 'animate' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'construction' && (
        <SmrTab
          allData={allData}
          datesData={datesData}
          smrPercentData={smrPercentData}
          dates={dates}
          activeDate={activeDate}
          selectedBranch={selectedBranch} setSelectedBranch={setSelectedBranch}
          selectedContractor={selectedContractor} setSelectedContractor={setSelectedContractor}
          selectedSection={selectedSection} setSelectedSection={setSelectedSection}
          selectedDate={selectedDate} setSelectedDate={setSelectedDate}
          openDropdown={openDropdown} setOpenDropdown={setOpenDropdown}
        />
      )}

          {activeTab === 'pir' && (
            <PirPsdTab activeTab={activeTab} pirData={pirData} pirVolsData={pirVolsData} musData={musData} musColors={musColors} />
          )}
      {activeTab === 'schedule' && (
        <>
          {/* FILTERS for METRICS (same UI components, but options from metrics) */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-start' }} onClick={e => { if (e.target === e.currentTarget) setOpenDropdown(null); }}>
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="branch_metrics"
              label="Ветка"
              value={selectedBranch}
              options={metricsBranches.length ? metricsBranches : branches}
              onChange={v => { setSelectedBranch(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="contractor_metrics"
              label="Подрядчик"
              value={selectedContractor}
              options={metricsContractors.length ? metricsContractors : contractors}
              onChange={v => { setSelectedContractor(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="section_metrics"
              label="Участок"
              value={selectedSection}
              options={metricsSections.length ? metricsSections : sections}
              onChange={v => {
                setSelectedSection(v);
                setOpenDropdown(null);

                if (v !== 'Все') {
                  // Ищем в данных МЕТРИК, а не СМР
                  const row = metricsData.find(r => r["Участок"] === v);
                  if (row) {
                    if (row["Подрядчик"]) setSelectedContractor(row["Подрядчик"]);
                    if (row["Ветка"]) setSelectedBranch(row["Ветка"]);
                  }
                } else {
                  // При сбросе на "Все" очищаем зависимые фильтры (как в СМР)
                  setSelectedContractor('Все');
                  setSelectedBranch('Все');
                }
              }}
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="date_metrics"
              label="Дата"
              value={selectedDate}
              options={dateOptionsForDropdown}
              onChange={v => setSelectedDate(v === 'Все' ? '' : v)}
              onReset=""
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="metric_chart"
              label="Графики"
              value={selectedMetricCharts}
              options={['Кабель', 'Труба', 'Засыпка', 'ГНБ']}
              onChange={v => setSelectedMetricCharts(v)}
              multi
            />
          </div>

          {/* NEW: KPI groups laid out in chronology (Cable -> Pipe) in first block,
              then Backfill group, then HDD group. Each group shows Plan / Fact / %.
              Pipe values shown under Cable values as requested. */}

          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div style={{ ...card }}>
              <div style={lbl}>Кабель (план)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2898ff' }}>
                {metricsKPI.cablePlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
            <div style={{ ...card }}>
              <div style={lbl}>Кабель (факт)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2de2a6' }}>
                {metricsKPI.cableFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
            <div style={{ ...card }}>
              <div style={lbl}>Отклонение кабеля</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: metricsKPI.cableDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                {(metricsKPI.cableDev > 0 ? '+' : '') + metricsKPI.cableDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
          </div>

          {selectedMetricCharts.includes('Кабель') && (
            <MetricTrendChart
              title="Кабель"
              data={metricChartDataByCategory['Кабель']}
              unit={metricChartConfig['Кабель'].unit}
            />
          )}

          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div style={{ ...card }}>
              <div style={lbl}>Труба (план)</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#2898ff' }}>
                {metricsKPI.pipePlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
            <div style={{ ...card }}>
              <div style={lbl}>Труба (факт)</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#2de2a6' }}>
                {metricsKPI.pipeFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
            <div style={{ ...card }}>
              <div style={lbl}>Отклонение трубы</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: metricsKPI.pipeDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                {(metricsKPI.pipeDev > 0 ? '+' : '') + metricsKPI.pipeDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
          </div>

          {selectedMetricCharts.includes('Труба') && (
            <MetricTrendChart
              title="Труба"
              data={metricChartDataByCategory['Труба']}
              unit={metricChartConfig['Труба'].unit}
            />
          )}

          {/* Next: Backfill group (Засыпка) */}
          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div style={card}>
              <div style={lbl}>Засыпка (план)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2898ff' }}>
                {metricsKPI.backfillPlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>Засыпка (факт)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2de2a6' }}>
                {metricsKPI.backfillFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>Отклонение засыпки</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: metricsKPI.backfillDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                {(metricsKPI.backfillDev > 0 ? '+' : '') + metricsKPI.backfillDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>км</span>
              </div>
            </div>
          </div>

          {selectedMetricCharts.includes('Засыпка') && (
            <MetricTrendChart
              title="Засыпка"
              data={metricChartDataByCategory['Засыпка']}
              unit={metricChartConfig['Засыпка'].unit}
            />
          )}

          {/* Next: HDD group (ГНБ) */}
          <div className="kpi-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
            <div style={card}>
              <div style={lbl}>ГНБ (план)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2898ff' }}>
                {metricsKPI.hddPlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>ГНБ (факт)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2de2a6' }}>
                {metricsKPI.hddFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>Отклонение ГНБ</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: metricsKPI.hddDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                {(metricsKPI.hddDev > 0 ? '+' : '') + metricsKPI.hddDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
              </div>
            </div>
          </div>

          {selectedMetricCharts.includes('ГНБ') && (
            <MetricTrendChart
              title="ГНБ"
              data={metricChartDataByCategory['ГНБ']}
              unit={metricChartConfig['ГНБ'].unit}
            />
          )}
        </>
      )}

      {activeTab === 'us' && (
        <UsTab usGreenData={usGreenData} usBlueData={usBlueData} usRedData={usRedData} />
      )}

      {activeTab === 'materials' && (
        <MaterialsTab
          tmcData={tmcData}
          tmcDvaData={tmcDvaData}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
      )}

      {/* Временно скрыто перед публикацией — данные и логика карты сохранены, просто не рендерится.
          Чтобы вернуть: замените "false" на "activeTab === 'map'" и раскомментируйте кнопку в tabs выше */}
      {false && (
        <VolsMapTab
          volsRouteData={volsRouteData}
          musVolsData={musVolsData}
          codVolsData={codVolsData}
        />
      )}

      {activeTab !== 'construction' && activeTab !== 'schedule' && activeTab !== 'pir' && activeTab !== 'materials' && activeTab !== 'us' && activeTab !== 'map' && (
        <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2de2a6', marginBottom: '8px' }}>В разработке</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Раздел будет доступен в ближайшем обновлении</div>
        </div>
      )}
    </div>
  );
}
