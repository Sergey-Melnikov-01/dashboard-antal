import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  LineChart, Line
} from 'recharts';

const API_URL = "https://script.google.com/macros/s/AKfycbw6XLjGzrrzg4knwf9QQ62zgv5jnKxvzZnZKhLUTSFX14b2dqa_iJZn2y5GjzPBgkH3/exec";

const bg = '#1c1d26';
const card = { background: '#21222d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' };
const lbl = { color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' };

const parseDate = s => {
  if (!s) return new Date();
  const [d, m, y] = String(s).split('.');
  return new Date(y, m - 1, d);
};

const toNum = v => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

// Custom dark tooltip for PIR chart
const PirTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: '#0f1724',
      color: '#e2e8f0',
      padding: 10,
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
      fontSize: 13,
      minWidth: 160
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.name}</div>
      <div style={{ color: '#9ca3af', fontSize: 12 }}>Регион: {d.region}</div>
      <div style={{ color: '#2de2a6', fontWeight: 800, marginTop: 8 }}>Готовность: {d.progress}%</div>
      {d.status ? <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>Статус: {d.status}</div> : null}
    </div>
  );
};

// ProgressBar — компонент для трекера этапов ПИР
const ProgressBar = ({ label, plan, fact, pct, unit }) => {
  const displayPct = Math.round((pct || 0) * 100);
  // Цвет меняется от прогресса: красный (<30), оранжевый (<90), зеленый (>=90)
  const barColor = displayPct < 30 ? '#ff1a1a' : displayPct < 90 ? '#ff7b00' : '#10b981';

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
        {/* Названия этапа — сделали крупнее и белым */}
        <div style={{ fontSize: '15px', fontWeight: '600', color: '#ffffff' }}>{label}</div>
        
        <div style={{ textAlign: 'right' }}>
          {/* Процент выполнения — чуть крупнее */}
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: barColor }}>{displayPct}%</div>
          {/* Километры — увеличили шрифт и яркость, оставили в одну строку */}
          <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500', marginTop: '2px' }}>
            {(fact || 0).toFixed(1)} км / {(plan || 0).toFixed(1)} км
          </div>
        </div>
      </div>
      
      {/* Полоска прогресса */}
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(displayPct, 100)}%`,
          height: '100%',
          background: barColor,
          boxShadow: `0 0 10px ${barColor}44`,
          transition: 'width 0.5s ease-out'
        }} />
      </div>
    </div>
  );
};

export default function App() {
  const [allData, setAllData] = useState([]);
  const [metricsData, setMetricsData] = useState([]);
  const [pirData, setPirData] = useState([]); // <-- added state for DB_PIR
  const [pirMode, setPirMode] = useState('psd');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('construction'); // 'construction' | 'schedule' (metrics)
  const [animatingTab, setAnimatingTab] = useState(null);

  // Global filter states (shared across tabs as requested)
  const [selectedBranch, setSelectedBranch] = useState('Все');
  const [selectedContractor, setSelectedContractor] = useState('Все');
  const [selectedSection, setSelectedSection] = useState('Все');
  const [selectedDate, setSelectedDate] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);

  // PIR-specific region filter
  const [selectedPirRegion, setSelectedPirRegion] = useState('Все');

  const tabs = [
    { id: 'construction', label: '🏗️ СМР' },
    { id: 'pir', label: '📋 ПИР/ПСД' },
    { id: 'materials', label: '📦 ТМЦ' },
    { id: 'schedule', label: '📈 Метрики' },
  ];

  const handleTabClick = (id) => {
    setActiveTab(id);
    setAnimatingTab(id);
    setTimeout(() => setAnimatingTab(null), 700);
  };

  useEffect(() => {
    if (activeTab === 'pir') {
      setPirMode('pir');
    }
  }, [activeTab]);

  useEffect(() => {
    axios.get(API_URL).then(res => {
      const raw = res.data || {};

      // СМР
      setAllData(Array.isArray(raw?.DB_SMR) ? raw.DB_SMR : []);

      // Метрики (если есть)
      if (Array.isArray(raw?.DB_METRIC)) {
        setMetricsData(raw.DB_METRIC);
      } else if (Array.isArray(raw?.DB_PIR)) {
        // fallback if needed
        setMetricsData(raw.DB_PIR);
      } else {
        setMetricsData([]);
      }

      // PIR data (if present in payload)
      setPirData(Array.isArray(raw?.DB_PIR) ? raw.DB_PIR : []);

      setLoading(false);
    }).catch(err => {
      console.error('API load error', err);
      setLoading(false);
    });
  }, []);

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
      allData
        .filter(r => (selectedBranch === 'Все' || r["Ветка"] === selectedBranch) &&
          (selectedContractor === 'Все' || r["Подрядчик"] === selectedContractor))
        .map(r => r["Участок"]).filter(Boolean)
    )];
  }, [allData, selectedBranch, selectedContractor]);

  
  const latestDate = dates.length ? dates[dates.length - 1] : '';
  const activeDate = selectedDate && dates.includes(selectedDate) ? selectedDate : (latestDate || '');

  const filtered = useMemo(() => {
    return allData.filter(r => {
      if (!r) return false;
      if (r["Дата отчета"] !== activeDate) return false;
      if (selectedBranch !== 'Все' && r["Ветка"] !== selectedBranch) return false;
      if (selectedContractor !== 'Все' && r["Подрядчик"] !== selectedContractor) return false;
      if (selectedSection !== 'Все' && r["Участок"] !== selectedSection) return false;
      return true;
    });
  }, [allData, activeDate, selectedBranch, selectedContractor, selectedSection]);

  const { totalFact, totalPlan, deviation, totalPercent } = useMemo(() => {
    const fact = filtered.reduce((s, r) => s + toNum(r["Факт км"]), 0);
    const plan = filtered.reduce((s, r) => s + toNum(r["План км"]), 0);
    const dev = fact - plan;
    const pct = plan > 0 ? ((fact / plan) * 100).toFixed(1) : 0;
    return { totalFact: fact, totalPlan: plan, deviation: dev, totalPercent: pct };
  }, [filtered]);
  // Стоимости: Материалы и СМР
  const { matPlan, matFact, matDev, smrPlan, smrFact, smrDev } = useMemo(() => {
    const mp = filtered.reduce((s, r) => s + toNum(r["Материалы [План]"]), 0);
    const mf = filtered.reduce((s, r) => s + toNum(r["Материалы [Факт]"]), 0);
    const sp = filtered.reduce((s, r) => s + toNum(r["СМР [План]"]), 0);
    const sf = filtered.reduce((s, r) => s + toNum(r["СМР [Факт]"]), 0);
    return {
      matPlan: mp, matFact: mf, matDev: mf - mp,
      smrPlan: sp, smrFact: sf, smrDev: sf - sp,
    };
  }, [filtered]);

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
      metricsData
        .filter(r => (selectedBranch === 'Все' || r["Ветка"] === selectedBranch) &&
          (selectedContractor === 'Все' || r["Подрядчик"] === selectedContractor))
        .map(r => r["Участок"]).filter(Boolean)
    )];
  }, [metricsData, selectedBranch, selectedContractor]);

  const metricsFiltered = useMemo(() => {
    return metricsData.filter(r => {
      if (!r) return false;
      if (r["Дата отчета"] !== metricActiveDate) return false;
      if (selectedBranch !== 'Все' && r["Ветка"] !== selectedBranch) return false;
      if (selectedContractor !== 'Все' && r["Подрядчик"] !== selectedContractor) return false;
      if (selectedSection !== 'Все' && r["Участок"] !== selectedSection) return false;
      return true;
    });
  }, [metricsData, metricActiveDate, selectedBranch, selectedContractor, selectedSection]);

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

  // keep these for potential future use (not displayed now)
  const metricsTrend = useMemo(() => {
    return metricsDates.map(date => {
      const rows = metricsData.filter(r => {
        if (r["Дата отчета"] !== date) return false;
        if (selectedBranch !== 'Все' && r["Ветка"] !== selectedBranch) return false;
        if (selectedContractor !== 'Все' && r["Подрядчик"] !== selectedContractor) return false;
        if (selectedSection !== 'Все' && r["Участок"] !== selectedSection) return false;
        return true;
      });
      const cableP = rows.reduce((s, r) => s + toNum(r["Кабель План"]), 0);
      const cableF = rows.reduce((s, r) => s + toNum(r["Кабель Факт"]), 0);
      return { date, cablePlan: +cableP.toFixed(1), cableFact: +cableF.toFixed(1) };
    });
  }, [metricsDates, metricsData, selectedBranch, selectedContractor, selectedSection]);

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
    const sortedVols = [...vols].sort((a, b) => b.pct - a.pct);
    const sortedMus = [...mus].sort((a, b) => b.pct - a.pct);

    return { vols: sortedVols, mus: sortedMus };
  }, [pirData]);

  const toggleDropdown = (name) => setOpenDropdown(prev => prev === name ? null : name);

  const PushDropdown = ({ name, label, value, options, onChange, onReset }) => {
    const isOpen = openDropdown === name;
    return (
      <div style={{ position: 'relative' }}>
        <style>{`
          .push-btn {
            border-radius: 10px;
            border: 2px outset #2de2a640;
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            color: #eee;
            text-transform: uppercase;
            letter-spacing: 2px;
            overflow: hidden;
            box-shadow: 0 0 8px rgba(0,0,0,0.8);
            font-family: verdana, sans-serif;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            background: linear-gradient(160deg, #2a2b38, #21222d);
            text-shadow: 0px 0px 2px rgba(0,0,0,.5);
            transition: 0.2s;
            white-space: nowrap;
            user-select: none;
          }
          .push-btn.active-filter {
            border-color: #2de2a6;
            color: #2de2a6;
            box-shadow: 0 0 8px #2de2a640, 0 0 20px #2de2a620;
          }
          .push-btn:active, .push-btn.open {
            border: 2px outset #2de2a6;
            color: #fff;
            background: linear-gradient(160deg, #2e3048, #21222d);
            text-shadow: 0px 0px 4px #2de2a6;
            box-shadow: 0 0 10px #2de2a6, 0 0 30px #2de2a640;
          }
          .push-btn span { position: absolute; display: block; }
          .push-btn span:nth-child(1) { top: 0; left: -100%; width: 100%; height: 1px; background: linear-gradient(90deg, transparent, #2de2a6); }
          .push-btn.open span:nth-child(1) { left: 100%; transition: 0.8s; }
          .push-btn span:nth-child(2) { top: -100%; right: 0; width: 1px; height: 100%; background: linear-gradient(180deg, transparent, #2de2a6); }
          .push-btn.open span:nth-child(2) { top: 100%; transition: 0.8s; transition-delay: 0.2s; }
          .push-btn span:nth-child(3) { bottom: 0; right: -100%; width: 100%; height: 1px; background: linear-gradient(270deg, transparent, #2de2a6); }
          .push-btn.open span:nth-child(3) { right: 100%; transition: 0.8s; transition-delay: 0.4s; }
          .push-btn span:nth-child(4) { bottom: -100%; left: 0; width: 1px; height: 100%; background: linear-gradient(360deg, transparent, #2de2a6); }
          .push-btn.open span:nth-child(4) { bottom: 100%; transition: 0.8s; transition-delay: 0.6s; }
          .push-dropdown-menu {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            z-index: 999;
            background: #21222d;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px;
            min-width: 180px;
            max-height: 260px;
            overflow-y: auto;
            box-shadow: 0 0 20px rgba(45,226,166,0.15);
            padding: 4px 0;
          }
          .push-dropdown-item {
            padding: 9px 16px;
            font-size: 12px;
            color: #9ca3af;
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            letter-spacing: 0.5px;
          }
          .push-dropdown-item:hover { background: rgba(255,255,255,0.05); color: #2de2a6; }
          .push-dropdown-item.selected { color: #2de2a6; font-weight: bold; }
        `}</style>
        <button
          className={`push-btn ${isOpen ? 'open' : ''} ${(value && value !== 'Все') ? 'active-filter' : ''}`}
          onClick={() => toggleDropdown(name)}
        >
          <span></span><span></span><span></span><span></span>
          {label}: {value || 'Все'}
          <span style={{ position: 'static', marginLeft: '4px', fontSize: '9px' }}>{isOpen ? '▲' : '▼'}</span>
        </button>
        {isOpen && (
          <div className="push-dropdown-menu">
            <div
              className={`push-dropdown-item ${!value || value === 'Все' || value === '' ? 'selected' : ''}`}
              onClick={() => { onChange(onReset !== undefined ? onReset : 'Все'); setOpenDropdown(null); }}
            >
              {`Все ${label.toLowerCase()}`}
            </div>
            {options.map(opt => (
              <div
                key={opt}
                className={`push-dropdown-item ${value === opt ? 'selected' : ''}`}
                onClick={() => { onChange(opt); setOpenDropdown(null); }}
              >
                {opt}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1c1d26', color: 'white', fontFamily: 'sans-serif' }}>
      Загрузка аналитики АНТАЛ...
    </div>
  );

  // choose date options based on active tab
  const dateOptionsForDropdown = activeTab === 'schedule' ? metricsDates : dates;

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#e2e8f0', padding: '30px 36px', fontFamily: 'Inter, sans-serif' }}>
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
              name="branch"
              label="Ветка"
              value={selectedBranch}
              options={branches}
              onChange={v => { setSelectedBranch(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              name="contractor"
              label="Подрядчик"
              value={selectedContractor}
              options={contractors}
              onChange={v => { setSelectedContractor(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
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
              name="date"
              label="Дата"
              value={selectedDate}
              options={dateOptionsForDropdown}
              onChange={v => setSelectedDate(v === 'Все' ? '' : v)}
              onReset=""
            />
          </div>

          {/* KPI Row 1 — Объёмы */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
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
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px', alignItems: 'stretch' }}>
          
          {/* График динамики */}
          <div style={card}>
            <div style={lbl}>Динамика выполнения плана (км)</div>
            <ResponsiveContainer width="100%" height={252}>
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" />
                <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#4b5563" 
                  fontSize={10} 
  tick={{ fill: '#9ca3af' }}
  domain={[0, 1500]} // Фиксируем максимум, чтобы не вылезало 1650
  ticks={[0, 250, 500, 750, 1000, 1250, 1500]} // Четкий шаг 250
  allowDataOverflow={false} />
                <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />
                <Line type="monotone" dataKey="plan" stroke="#2898ff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fact" stroke="#2de2a6" strokeWidth={2} dot={{ r: 3, fill: '#2de2a6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Правая часть: 2 карточки со спидометрами */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {[
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
                  
                  {/* Заголовок */}
                  <div style={{ ...lbl, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>{item.label}</div>

                  {/* Спидометр — увеличенный */}
                  <div style={{ position: 'relative', width: '250px', height: '140px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', margin: '0 0 10px 0' }}>
                    <svg width="250" height="145" viewBox="0 0 250 145">
                      {/* Подложка — синяя дуга (цвет совпадает с цифрами плана) */}
                      <path
                        d="M 15 130 A 110 110 0 0 1 235 130"
                        fill="none"
                        stroke="#2898ff"
                        strokeWidth="16"
                        strokeLinecap="round"
                        opacity="0.25"
                      />
                      {/* Факт — зелёная дуга */}
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
                    {/* Процент в центре дуги */}
                    <div style={{ position: 'absolute', bottom: '10px', fontSize: '42px', fontWeight: '900', 
                      color: (item.fact / item.plan) > 1.0 ? '#ff4d4d' : '#ff9b45',
                       lineHeight: 1
                    }}>
                      {displayPercent}%
                    </div>
                  </div>

                  {/* План и Факт — прижаты к низу, крупный шрифт */}
                  <div style={{ width: '100%', marginTop: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1d2d24' }}>
                      <span style={{ fontSize: '14px', color: '#9ca3af' }}>План</span>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#2898ff' }}>{item.plan.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <span style={{ fontSize: '14px', color: '#9ca3af' }}>Факт</span>
                      <span style={{ fontSize: '20px', fontWeight: '800', color: '#2de2a6' }}>{item.fact.toLocaleString()}</span>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

          {/* Sections chart */}
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="Участок"
                        type="category"
                        stroke="#4b5563"
                        fontSize={11}
                        width={140}
                        tick={{ fill: '#9ca3af' }}
                      />
                      <Tooltip
                        cursor={{ fill: '#15251e' }}
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
        </>
      )}

          {activeTab === 'pir' && (
            <>
              {/* Кнопки ПИР / ПСД */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                <button
                  onClick={() => setPirMode('pir')}
                  className={`bubbly-button ${pirMode === 'pir' ? 'active' : ''}`}
                  aria-pressed={pirMode === 'pir'}
                  style={{ padding: '6px 12px' }}
                >
                  ПИР
                </button>
                <button
                  onClick={() => setPirMode('psd')}
                  className={`bubbly-button ${pirMode === 'psd' ? 'active' : ''}`}
                  aria-pressed={pirMode === 'psd'}
                  style={{ padding: '6px 12px' }}
                >
                  ПСД
                </button>
              </div>

              {pirMode === 'pir' ? (
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
              ) : (
                /* ПСД — в разработке (срабатывает, если pirMode !== 'pir') */
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
          )}   

      {activeTab === 'schedule' && (
        <>
          {/* FILTERS for METRICS (same UI components, but options from metrics) */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'flex-start' }} onClick={e => { if (e.target === e.currentTarget) setOpenDropdown(null); }}>
            <PushDropdown
              name="branch_metrics"
              label="Ветка"
              value={selectedBranch}
              options={metricsBranches.length ? metricsBranches : branches}
              onChange={v => { setSelectedBranch(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              name="contractor_metrics"
              label="Подрядчик"
              value={selectedContractor}
              options={metricsContractors.length ? metricsContractors : contractors}
              onChange={v => { setSelectedContractor(v); setSelectedSection('Все'); }}
            />
            <PushDropdown
              name="section_metrics"
              label="Участок"
              value={selectedSection}
              options={metricsSections.length ? metricsSections : sections}
              onChange={v => setSelectedSection(v)}
            />
            <PushDropdown
              name="date_metrics"
              label="Дата"
              value={selectedDate}
              options={dateOptionsForDropdown}
              onChange={v => setSelectedDate(v === 'Все' ? '' : v)}
              onReset=""
            />
          </div>

          {/* NEW: KPI groups laid out in chronology (Cable -> Pipe) in first block,
              then Backfill group, then HDD group. Each group shows Plan / Fact / %.
              Pipe values shown under Cable values as requested. */}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            {/* Column 1: Plan (Cable top, Pipe below) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ ...card }}>
                <div style={lbl}>Кабель (план)</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2898ff' }}>
                  {metricsKPI.cablePlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
                </div>
              </div>
              <div style={{ ...card }}>
                <div style={lbl}>Труба (план)</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2898ff' }}>
                  {metricsKPI.pipePlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
                </div>
              </div>
            </div>

            {/* Column 2: Fact (Cable top, Pipe below) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ ...card }}>
                <div style={lbl}>Кабель (факт)</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2de2a6' }}>
                  {metricsKPI.cableFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
                </div>
              </div>
              <div style={{ ...card }}>
                <div style={lbl}>Труба (факт)</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: '#2de2a6' }}>
                  {metricsKPI.pipeFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
                </div>
              </div>
            </div>

            {/* Column 3: Deviation (meters) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ ...card }}>
                <div style={lbl}>Отклонение кабеля</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: metricsKPI.cableDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                  {(metricsKPI.cableDev > 0 ? '+' : '') + metricsKPI.cableDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
                </div>
              </div>
              <div style={{ ...card }}>
                <div style={lbl}>Отклонение трубы</div>
                <div style={{ fontSize: '22px', fontWeight: '700', color: metricsKPI.pipeDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                  {(metricsKPI.pipeDev > 0 ? '+' : '') + metricsKPI.pipeDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
                </div>
              </div>
            </div>
            </div>

          {/* Next: Backfill group (Засыпка) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div style={card}>
              <div style={lbl}>Засыпка (план)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2898ff' }}>
                {metricsKPI.backfillPlan.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>Засыпка (факт)</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2de2a6' }}>
                {metricsKPI.backfillFact.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
              </div>
            </div>
            <div style={card}>
              <div style={lbl}>Отклонение засыпки</div>
              <div style={{ fontSize: '22px', fontWeight: 'bold', color: metricsKPI.backfillDev < 0 ? '#ff4d4d' : '#ff9b45' }}>
                {(metricsKPI.backfillDev > 0 ? '+' : '') + metricsKPI.backfillDev.toFixed(1)} <span style={{ fontSize: '12px', opacity: 0.6 }}>м</span>
              </div>
            </div>
          </div>

          {/* Next: HDD group (ГНБ) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
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

          {/* Table — сразу под KPI, как просили */}
          <div style={card}>
            <div style={{ ...lbl, marginBottom: '12px' }}>Метрики — детализация по участкам</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #1d2d24' }}>
                    <th style={{ padding: '8px' }}>Участок</th>
                    <th style={{ padding: '8px' }}>Подрядчик</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Кабель План</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Кабель Факт</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Труба План</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Труба Факт</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Засыпка План</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Засыпка Факт</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>ГНБ План</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>ГНБ Факт</th>
                  </tr>
                </thead>
                <tbody>
                  {metricsFiltered.map((r, i) => {
                    const cablePlan = toNum(r["Кабель План"]);
                    const cableFact = toNum(r["Кабель Факт"]);
                    const pipePlan = toNum(r["Труба План"]);
                    const pipeFact = toNum(r["Труба Факт"]);
                    const backfillPlan = toNum(r["Засыпка План"]);
                    const backfillFact = toNum(r["Засыпка Факт"]);
                    const hddPlan = toNum(r["ГНБ План"]);
                    const hddFact = toNum(r["ГНБ Факт"]);
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #16251e' }}>
                        <td style={{ padding: '8px', color: '#e5e7eb' }}>{r["Участок"]}</td>
                        <td style={{ padding: '8px', color: '#9ca3af' }}>{r["Подрядчик"]}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2898ff' }}>{cablePlan}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2de2a6' }}>{cableFact}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2898ff' }}>{pipePlan}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2de2a6' }}>{pipeFact}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2898ff' }}>{backfillPlan}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2de2a6' }}>{backfillFact}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2898ff' }}>{hddPlan}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2de2a6' }}>{hddFact}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab !== 'construction' && activeTab !== 'schedule' && activeTab !== 'pir' && (
        <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2de2a6', marginBottom: '8px' }}>В разработке</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Раздел будет доступен в ближайшем обновлении</div>
        </div>
      )}
    </div>
  );
}