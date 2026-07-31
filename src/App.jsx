import { useState, useEffect, useMemo } from 'react';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  LineChart, Line
} from 'recharts';

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

const bg = '#1c1d26';
const card = { background: '#21222d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' };
const lbl = { color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' };

export default function App() {
  const { allData, metricsData, pirData, pirVolsData, tmcData, tmcDvaData, datesData, loading } = useDashboardData();       
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

  // Метрики: какой график сейчас показывать под KPI-карточками ('Нет' = выключено)
  const [selectedMetricCharts, setSelectedMetricCharts] = useState([]);

  // PIR-specific region filter
  const [selectedPirRegion, setSelectedPirRegion] = useState('Все');

  const tabs = [
    { id: 'construction', label: '🏗️ СМР' },
    { id: 'schedule', label: '📈 Метрики' },
    { id: 'materials', label: '📦 ТМЦ' },
    { id: 'pir', label: '📋 ПИР/ПСД' },
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

  const filtered = useDatasetView(allData, {
    branch: selectedBranch,
    contractor: selectedContractor,
    section: selectedSection,
    date: activeDate,
  });

  const { totalFact, totalPlan, deviation, totalPercent } = useMemo(() => {
    const fact = filtered.reduce((s, r) => s + toNum(r["Факт км"]), 0);
    const plan = filtered.reduce((s, r) => s + toNum(r["План км"]), 0);
    const dev = fact - plan;
    const pct = plan > 0 ? ((fact / plan) * 100).toFixed(1) : 0;
    return { totalFact: fact, totalPlan: plan, deviation: dev, totalPercent: pct };
  }, [filtered]);
  
  // Стоимости: Материалы и СМР
  const { matPlan, matFact, matDev, smrPlan, smrFact, smrDev, nzsPlan, nzsFact} = useMemo(() => {
    const mp = filtered.reduce((s, r) => s + toNum(r["Материалы [План]"]), 0);
    const mf = filtered.reduce((s, r) => s + toNum(r["Материалы [Факт]"]), 0);
    const sp = filtered.reduce((s, r) => s + toNum(r["СМР [План]"]), 0);
    const sf = filtered.reduce((s, r) => s + toNum(r["СМР [Факт]"]), 0);
    const np = filtered.reduce((s, r) => s + toNum(r["Материалы по НЗС [План]"]), 0);
    const nf = filtered.reduce((s, r) => s + toNum(r["Материалы по НЗС [Факт]"]), 0);
    return {
      matPlan: mp, matFact: mf, matDev: mf - mp,
      smrPlan: sp, smrFact: sf, smrDev: sf - sp,
      nzsPlan: np, nzsFact: nf
    };
  }, [filtered]);

  // Карточка «Отставание» — берётся из DB_DATES
  // Показывается только если: нет фильтра по участку и подрядчику
  // Реагирует на: selectedBranch (ветка) и selectedDate (дата)
  const delayKpi = useMemo(() => {
    // Скрываем если выбран конкретный участок или подрядчик
    if (selectedSection !== 'Все' || selectedContractor !== 'Все') return null;
    if (!datesData.length) return null;

    // Парсит и ISO-строки ('2026-07-08T...') и dd.mm.yyyy
    const parseAnyDate = s => {
      if (!s) return new Date(0);
      const str = String(s);
      if (str.includes('T')) return new Date(str); // ISO
      const [d, m, y] = str.split('.');            // dd.mm.yyyy
      return new Date(y, m - 1, d);
    };

    // Фильтруем по ветке (trim — убирает пробел в конце)
    let rows = datesData;
    if (selectedBranch !== 'Все') {
      rows = rows.filter(r => String(r["Ветка"] || '').trim() === selectedBranch.trim());
    }

    // Фильтруем по дате: оставляем только строки, где "Дата отчета" <= activeDate
    if (activeDate) {
      const ad = parseDate(activeDate);
      rows = rows.filter(r => parseAnyDate(r["Дата отчета"]) <= ad);
    }

    if (!rows.length) return null;

    // Берём последнюю по дате строку (наиболее свежую)
    const latest = rows.reduce((a, b) => {
      return parseAnyDate(a["Дата отчета"]) >= parseAnyDate(b["Дата отчета"]) ? a : b;
    });

    const days = toNum(latest["Отклонение (дней)"]);
    const status = String(latest["Статус (🟢/🟡/🔴)"] || latest["Статус"] || '');

    // Цвет: 0 — зелёный, 1–14 — жёлтый, 15+ — красный
    const color = days === 0 ? '#2de2a6' : days <= 14 ? '#ff9b45' : '#ff4d4d';

    return { days, color, status };
  }, [datesData, selectedBranch, selectedSection, selectedContractor, activeDate]);

  const trendData = useMemo(() => {
    return dates.map(date => {
      const rows = allData.filter(r => {
        if (!r) return false;
        if (r["Дата отчета"] !== date) return false;
        if (selectedBranch !== 'Все' && r["Ветка"] !== selectedBranch) return false;
        if (selectedContractor !== 'Все' && r["Подрядчик"] !== selectedContractor) return false;
        if (selectedSection !== 'Все' && r["Участок"] !== selectedSection) return false;
        return true;
      });
      const f = rows.reduce((s, r) => s + toNum(r["Факт км"]), 0);
      const p = rows.reduce((s, r) => s + toNum(r["План км"]), 0);
      return { date, plan: +p.toFixed(1), fact: +f.toFixed(1), pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
    });
  }, [dates, allData, selectedBranch, selectedContractor, selectedSection]);

  const contractorStats = useMemo(() => {
    return contractors.map(c => {
      const rows = filtered.filter(r => r["Подрядчик"] === c);
      const f = rows.reduce((s, r) => s + toNum(r["Факт км"]), 0);
      const p = rows.reduce((s, r) => s + toNum(r["План км"]), 0);
      return { name: c, fact: f, plan: p, pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
    }).filter(c => c.fact > 0 || c.plan > 0);
  }, [contractors, filtered]);

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
        <>
          {/* ... (оставил без изменений) */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-start' }} onClick={e => { if (e.target === e.currentTarget) setOpenDropdown(null); }}>
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="branch"
              label="Ветка"
              value={selectedBranch}
              options={branches}
              onChange={v => { setSelectedBranch(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="contractor"
              label="Подрядчик"
              value={selectedContractor}
              options={contractors}
              onChange={v => { setSelectedContractor(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="section"
              label="Участок"
              value={selectedSection}
              options={sections}
              onChange={v => {
                setSelectedSection(v);
                setOpenDropdown(null); // ЗАКРЫВАЕМ фильтр после выбора

                if (v !== 'Все') {
                  // Ищем именно в allData, так как это исходный массив
                  const row = allData.find(r => r["Участок"] === v);
                  if (row) {
                    // Автоматически выставляем Подрядчика и Ветку
                    if (row["Подрядчик"]) setSelectedContractor(row["Подрядчик"]);
                    if (row["Ветка"]) setSelectedBranch(row["Ветка"]);
                  }
                } else {
                  // Если выбрали "Все", сбрасываем зависимые фильтры
                  setSelectedContractor('Все');
                  setSelectedBranch('Все');
                }
              }}
            />
            <PushDropdown
              openDropdown={openDropdown}
              setOpenDropdown={setOpenDropdown}
              name="date"
              label="Дата"
              value={selectedDate}
              options={dateOptionsForDropdown}
              onChange={v => setSelectedDate(v === 'Все' ? '' : v)}
              onReset=""
            />
          </div>

          {/* KPI Row 1 — Объёмы */}
          <div className="kpi-grid-smr" style={{ display: 'grid', gridTemplateColumns: `repeat(${delayKpi ? 5 : 4}, 1fr)`, gap: '16px', marginBottom: '16px' }}>
          {[
            { label: 'План общий', val: totalPlan.toFixed(1), unit: 'км', color: '#2898ff' },
            { label: 'Факт общий', val: totalFact.toFixed(1), unit: 'км', color: '#2de2a6' },
            { label: 'Отклонение', val: (deviation > 0 ? '+' : '') + deviation.toFixed(1), unit: 'км', color: deviation >= 0 ? '#2de2a6' : '#ff4d4d' },
            { 
              label: 'Выполнение', 
              val: totalPercent, 
              unit: '%', 
              color: parseFloat(totalPercent) > 100 ? '#ff4d4d' : '#ff9b45' 
            },
          ].map((kpi, i) => (
            <div key={i} style={card}>
              <div style={lbl}>{kpi.label}</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: kpi.color, whiteSpace: 'nowrap' }}>
                {kpi.val} <span style={{ fontSize: '16px', opacity: 0.7, marginLeft: '4px' }}>{kpi.unit}</span>
              </div>
            </div>
          ))}

          {/* 5-я карточка — Отставание (только если есть данные и нет фильтра по участку/подрядчику) */}
          {delayKpi && (
            <div style={card}>
              <div style={lbl}>Отставание</div>
              <div style={{ fontSize: '28px', fontWeight: '800', color: delayKpi.color, whiteSpace: 'nowrap' }}>
                {delayKpi.days}
                <span style={{ fontSize: '16px', opacity: 0.7, marginLeft: '4px' }}>дн.</span>
              </div>
              {delayKpi.status && (
                <div style={{ fontSize: '18px', marginTop: '4px' }}>{delayKpi.status}</div>
              )}
            </div>
          )}
        </div>

          {/* Charts row */}
          <div className="charts-row-smr" style={{ 
            display: 'grid', 
            gridTemplateColumns: (nzsPlan > 0 || nzsFact > 0) ? '1fr 2fr' : '1fr 1fr', 
            gap: '16px', 
            marginBottom: '16px', 
            alignItems: 'stretch' }}>
          
          {/* График динамики */}
          <div style={card}>
            <div style={lbl}>Динамика выполнения плана (км)</div>
            <ResponsiveContainer width="100%" height={252}>
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2de2a6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2de2a6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" vertical={false} />
                <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tick={{ fill: '#9ca3af' }} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />
                
                {/* Линия Плана — пунктиром, если факт 0, чтобы подчеркнуть ожидание */}
                <Line 
                  type="monotone" 
                  dataKey="plan" 
                  stroke="#2898ff" 
                  strokeWidth={2} 
                  dot={{ r: 4, fill: '#1c1d26', stroke: '#2898ff', strokeWidth: 2 }} 
                />
                
                {/* Линия Факта — с точками на каждой дате */}
                <Line 
                  type="monotone" 
                  dataKey="fact" 
                  stroke="#2de2a6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#2de2a6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Правая часть: карточки со спидометрами (теперь их может быть 2 или 3) */}
          <div className="gauge-row-smr" style={{ 
            display: 'grid', 
            gridTemplateColumns: (nzsPlan > 0 || nzsFact > 0) ? '1fr 1fr 1fr' : '1fr 1fr', 
            gap: '16px' 
          }}>
            {[
              // Если есть данные по НЗС, добавляем их первым элементом в массив
              ...(nzsPlan > 0 || nzsFact > 0 ? [{ label: 'Материалы по НЗС', plan: nzsPlan, fact: nzsFact }] : []),
              { label: 'Материалы', plan: matPlan, fact: matFact },
              { label: 'СМР', plan: smrPlan, fact: smrFact }
            ].map((item, idx) => {
              const percent = item.plan > 0 ? Math.min((item.fact / item.plan) * 100, 100) : 0;
              const displayPercent = item.plan > 0 ? ((item.fact / item.plan) * 100).toFixed(1) : '0';
              const radius = 110;
              const circumference = Math.PI * radius;
              const offset = circumference - (percent / 100) * circumference;

              return (
                <div key={idx} style={{ ...card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '20px 16px 16px' }}>
                  
                  <div style={{ ...lbl, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</div>

                  <div style={{ position: 'relative', width: '100%', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', margin: '0 0 10px 0' }}>
                    <svg width="100%" height="100%" viewBox="0 0 250 145" preserveAspectRatio="xMidYMid meet">
                      <path
                        d="M 15 130 A 110 110 0 0 1 235 130"
                        fill="none"
                        stroke="#2898ff"
                        strokeWidth="16"
                        strokeLinecap="round"
                        opacity="0.25"
                      />
                      <path
                        d="M 15 130 A 110 110 0 0 1 235 130"
                        fill="none"
                        stroke={(item.fact / item.plan) > 1.0 ? '#ff4d4d' : '#2de2a6'}
                        strokeWidth="16"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', bottom: '10px', fontSize: '42px', fontWeight: '900', 
                      color: (item.fact / item.plan) > 1.0 ? '#ff4d4d' : '#ff9b45',
                       lineHeight: 1
                    }}>
                      {displayPercent}%
                    </div>
                  </div>

                  <div style={{ width: '100%', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1d2d24' }}>
                      <span style={{ fontSize: '14px', color: '#9ca3af' }}>План</span>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#2898ff' }}>{Math.round(item.plan || 0).toLocaleString('ru-RU')}
                      <span style={{ fontSize: '14px', fontWeight: '600', marginLeft: '4px' }}>тнг
                       </span> 
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span style={{ fontSize: '14px', color: '#9ca3af' }}>Факт</span>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#2de2a6' }}>{Math.round(item.fact || 0).toLocaleString('ru-RU')}
                      <span style={{ fontSize: '14px', fontWeight: '600', marginLeft: '4px' }}>тнг</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

          {/* Sections chart — показывается только при выбранном участке */}
          {selectedSection !== 'Все' && (
          <div style={{ ...card, marginBottom: '16px' }}>
            <div style={lbl}>Выработка по участкам (км)</div>
            {(() => {
              const visibleSections = filtered.filter(r =>
                (toNum(r["План км"]) || 0) > 0 || (toNum(r["Факт км"]) || 0) > 0
              );
              const dynamicHeight = Math.min(500, Math.max(150, visibleSections.length * 55));
              return (
                <div style={{ height: dynamicHeight, transition: 'height 0.3s ease' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={visibleSections}
                      margin={{ left: 10, right: 60, top: 10, bottom: 10 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="Участок"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        fontSize={11}
                        width={140}
                        tick={{ fill: '#9ca3af' }}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }}
                        formatter={(value) => (value != null ? Number(value).toFixed(1) : '')}
                      />
                      <Bar
                        dataKey="План км"
                        fill="#2898ff"
                        barSize={visibleSections.length < 5 ? 28 : 12}
                        radius={[0, 4, 4, 0]}
                      >
                        <LabelList 
                          dataKey="План км" 
                          position="insideRight" 
                          style={{ fill: '#fff', fontSize: 10, fontWeight: 'bold' }} 
                          formatter={(v) => (v > 0 ? Number(v).toFixed(1) : '')} 
                          />
                      </Bar>
                      <Bar
                        dataKey="Факт км"
                        fill="#2de2a6"
                        barSize={visibleSections.length < 5 ? 28 : 12}
                        radius={[0, 4, 4, 0]}
                      >
                        <LabelList dataKey="Факт км" position="right" style={{ fill: '#2de2a6', fontSize: 11, fontWeight: 'bold' }} 
                        formatter={(v) => (v > 0 ? Number(v).toFixed(1) : '')}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </div>
          )}
        </>
      )}
          {activeTab === 'pir' && (
            <PirPsdTab activeTab={activeTab} pirData={pirData} pirVolsData={pirVolsData} />
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

      {activeTab === 'materials' && (
        <MaterialsTab
          tmcData={tmcData}
          tmcDvaData={tmcDvaData}
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
        />
      )}

      {activeTab !== 'construction' && activeTab !== 'schedule' && activeTab !== 'pir' && activeTab !== 'materials' && (
        <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2de2a6', marginBottom: '8px' }}>В разработке</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Раздел будет доступен в ближайшем обновлении</div>
        </div>
      )}
    </div>
  );
}
