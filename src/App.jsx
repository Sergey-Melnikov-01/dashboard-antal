import React, { useState, useEffect } from 'react';
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

const formatMoney = v => {
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + ' млрд ₸';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + ' млн ₸';
  return v.toLocaleString('ru') + ' ₸';
};

export default function App() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('construction');
  const [animatingTab, setAnimatingTab] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState('Все');
  const [selectedContractor, setSelectedContractor] = useState('Все');
  const [selectedSection, setSelectedSection] = useState('Все');
  const [selectedDate, setSelectedDate] = useState('');
  const [openDropdown, setOpenDropdown] = useState(null);

  const tabs = [
    { id: 'construction', label: '🏗️ СМР' },
    { id: 'pir', label: '📋 ПИР/ПСД' },
    { id: 'materials', label: '📦 ТМЦ' },
    { id: 'schedule', label: '⏱️ Сроки' },
    { id: 'changes', label: '📊 Изменения' }
  ];

  const handleTabClick = (id) => {
    setActiveTab(id);
    setAnimatingTab(id);
    setTimeout(() => setAnimatingTab(null), 700);
  };

  useEffect(() => {
    axios.get(API_URL).then(res => {
      const raw = res.data;
      setAllData(Array.isArray(raw?.DB_SMR) ? raw.DB_SMR : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1c1d26', color: 'white', fontFamily: 'sans-serif' }}>
      Загрузка аналитики АНТАЛ...
    </div>
  );

  const dates = [...new Set(allData.map(r => r["Дата отчета"]).filter(Boolean))]
    .sort((a, b) => parseDate(a) - parseDate(b));
  const latestDate = dates[dates.length - 1];
  const activeDate = selectedDate || latestDate;

  const branches = [...new Set(allData.map(r => r["Ветка"]).filter(Boolean))];
  const contractors = [...new Set(allData.map(r => r["Подрядчик"]).filter(Boolean))];
  const sections = [...new Set(
    allData
      .filter(r => (selectedBranch === 'Все' || r["Ветка"] === selectedBranch) && (selectedContractor === 'Все' || r["Подрядчик"] === selectedContractor))
      .map(r => r["Участок"]).filter(Boolean)
  )];

  const filtered = allData.filter(r =>
    r["Дата отчета"] === activeDate &&
    (selectedBranch === 'Все' || r["Ветка"] === selectedBranch) &&
    (selectedContractor === 'Все' || r["Подрядчик"] === selectedContractor) &&
    (selectedSection === 'Все' || r["Участок"] === selectedSection)
  );

  // --- KPI ---
  const totalFact = filtered.reduce((s, r) => s + (Number(r["Факт км"]) || 0), 0);
  const totalPlan = filtered.reduce((s, r) => s + (Number(r["План км"]) || 0), 0);
  const deviation = totalFact - totalPlan;
  const totalPercent = totalPlan > 0 ? ((totalFact / totalPlan) * 100).toFixed(1) : 0;

  // --- Charts data ---
  const trendData = dates.map(date => {
    const rows = allData.filter(r =>
      r["Дата отчета"] === date &&
      (selectedBranch === 'Все' || r["Ветка"] === selectedBranch) &&
      (selectedContractor === 'Все' || r["Подрядчик"] === selectedContractor) &&
      (selectedSection === 'Все' || r["Участок"] === selectedSection)
    );
    const f = rows.reduce((s, r) => s + (Number(r["Факт км"]) || 0), 0);
    const p = rows.reduce((s, r) => s + (Number(r["План км"]) || 0), 0);
    return { date, plan: +p.toFixed(1), fact: +f.toFixed(1), pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
  });

  const contractorStats = contractors.map(c => {
    const rows = filtered.filter(r => r["Подрядчик"] === c);
    const f = rows.reduce((s, r) => s + (Number(r["Факт км"]) || 0), 0);
    const p = rows.reduce((s, r) => s + (Number(r["План км"]) || 0), 0);
    return { name: c, fact: f, plan: p, pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
  }).filter(c => c.fact > 0 || c.plan > 0);

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
              onClick={() => { onChange(onReset || 'Все'); setOpenDropdown(null); }}
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

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#e2e8f0', padding: '30px 36px', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>
          DASHBOARD <span style={{ color: '#2de2a6' }}>ANTAL</span>
        </h1>
        <div style={{ color: '#94a3b8', fontSize: '12px', textAlign: 'right' }}>
          ДАННЫЕ ОБНОВЛЕНЫ:<br />
          <span style={{ color: 'white', fontWeight: 'bold' }}>{activeDate}</span>
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
          {/* Filters */}
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
              onChange={v => setSelectedSection(v)}
            />
            <PushDropdown
              name="date"
              label="Дата"
              value={selectedDate}
              options={dates}
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
              { label: 'Выполнение', val: totalPercent, unit: '%', color: '#ff9b45' },
            ].map((kpi, i) => (
              <div key={i} style={card}>
                <div style={lbl}>{kpi.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: kpi.color }}>
                  {kpi.val} <span style={{ fontSize: '13px', opacity: 0.6 }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Trend */}
            <div style={card}>
              <div style={lbl}>Динамика выполнения плана (км)</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" />
                  <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tick={{ fill: '#9ca3af' }} />
                  <YAxis stroke="#4b5563" fontSize={10} tick={{ fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />
                  <Line type="monotone" dataKey="plan" stroke="#2898ff" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fact" stroke="#2de2a6" strokeWidth={2} dot={{ r: 3, fill: '#2de2a6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Contractors */}
            <div style={card}>
              <div style={lbl}>Выполнение по подрядчикам (км)</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={contractorStats} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#4b5563" fontSize={10} width={100} tick={{ fill: '#9ca3af' }} />
                  <Tooltip cursor={{ fill: '#15251e' }} contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />
                  <Bar dataKey="fact" fill="#2de2a6" barSize={12} radius={[0, 3, 3, 0]} />
                  <Bar dataKey="plan" fill="#2898ff" barSize={12} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sections bar chart */}
          <div style={{ ...card, marginBottom: '16px' }}>
            <div style={lbl}>Выработка по участкам (км)</div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart layout="vertical" data={filtered} margin={{ left: 10, right: 50, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="Участок" type="category" stroke="#4b5563" fontSize={10} width={130} tick={{ fill: '#9ca3af' }} />
                <Tooltip cursor={{ fill: '#15251e' }} contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />
                <Bar dataKey="План км" fill="#2898ff" barSize={8} radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="План км" position="insideRight" style={{ fill: '#fff', fontSize: 9, fontWeight: 'bold' }} />
                </Bar>
                <Bar dataKey="Факт км" fill="#2de2a6" barSize={8} radius={[0, 3, 3, 0]}>
                  <LabelList dataKey="Факт км" position="right" style={{ fill: '#2de2a6', fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div style={card}>
            <div style={{ ...lbl, marginBottom: '12px' }}>Детализация по участкам</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#6b7280', textAlign: 'left', borderBottom: '1px solid #1d2d24' }}>
                    <th style={{ padding: '8px' }}>Участок</th>
                    <th style={{ padding: '8px' }}>Подрядчик</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>План, км</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Факт, км</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Откл, км</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const plan = Number(r["План км"]) || 0;
                    const fact = Number(r["Факт км"]) || 0;
                    const dev = fact - plan;
                    const pct = plan > 0 ? ((fact / plan) * 100).toFixed(1) : 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #16251e' }}>
                        <td style={{ padding: '8px', color: '#e5e7eb' }}>{r["Участок"]}</td>
                        <td style={{ padding: '8px', color: '#9ca3af' }}>{r["Подрядчик"]}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2898ff' }}>{plan.toFixed(1)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2de2a6' }}>{fact.toFixed(1)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: dev >= 0 ? '#2de2a6' : '#ff4d4d' }}>{dev > 0 ? '+' : ''}{dev.toFixed(1)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#ff9b45' }}>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab !== 'construction' && (
        <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: '300px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚧</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2de2a6', marginBottom: '8px' }}>В разработке</div>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Раздел будет доступен в ближайшем обновлении</div>
        </div>
      )}
    </div>
  );
}
