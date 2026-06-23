import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const API_URL = "https://script.google.com/macros/s/AKfycbw6XLjGzrrzg4knwf9QQ62zgv5jnKxvzZnZKhLUTSFX14b2dqa_iJZn2y5GjzPBgkH3/exec";

const bg = '#08110d';
const card = {
  background: '#0f1b15', border: '1px solid #1d2d24',
  borderRadius: '12px', padding: '20px',
  display: 'flex', flexDirection: 'column'
};
const lbl = { color: '#6b7280', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const parseDate = s => { if (!s) return new Date(); const [d, m, y] = String(s).split('.'); return new Date(y, m - 1, d); };
const COLORS = ['#2de2a6', '#2898ff', '#ff9b45', '#ff4d4d', '#a78bfa', '#f472b6', '#34d399', '#60a5fa'];

export default function App() {
  const [allData, setAllData] = useState([]);
  const [tmcData, setTmcData] = useState([]);
  const [changesData, setChangesData] = useState([]);
  const [datesData, setDatesData] = useState([]);
  const [pirData, setPirData] = useState([]);
  const [dbKpi, setDbKpi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('construction');

  const [selectedBranch, setSelectedBranch] = useState('Все');
  const [selectedContractor, setSelectedContractor] = useState('Все');
  const [selectedSection, setSelectedSection] = useState('Все');
  const [selectedDate, setSelectedDate] = useState('');

  useEffect(() => {
    axios.get(API_URL).then(res => {
      const raw = res.data;
      setAllData(Array.isArray(raw?.DB_SMR) ? raw.DB_SMR : []);
      setTmcData(Array.isArray(raw?.DB_TMC) ? raw.DB_TMC : []);
      setChangesData(Array.isArray(raw?.DB_CHANGES) ? raw.DB_CHANGES : []);
      setDatesData(Array.isArray(raw?.DB_DATES) ? raw.DB_DATES : []);
      setPirData(Array.isArray(raw?.DB_PIR) ? raw.DB_PIR : []);
      setDbKpi(Array.isArray(raw?.DB_KPI) ? raw.DB_KPI : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: bg, color: 'white', fontFamily: 'sans-serif' }}>
      Загрузка аналитики...
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
      .filter(r => selectedBranch === 'Все' || r["Ветка"] === selectedBranch)
      .map(r => r["Участок"]).filter(Boolean)
  )];

  const filtered = allData.filter(r =>
    r["Дата отчета"] === activeDate &&
    (selectedBranch === 'Все' || r["Ветка"] === selectedBranch) &&
    (selectedContractor === 'Все' || r["Подрядчик"] === selectedContractor) &&
    (selectedSection === 'Все' || r["Участок"] === selectedSection)
  );

  const totalFact = filtered.reduce((s, r) => s + (Number(r["Факт км"]) || 0), 0);
  const totalPlan = filtered.reduce((s, r) => s + (Number(r["План км"]) || 0), 0);
  const deviation = totalFact - totalPlan;
  const totalPercent = totalPlan > 0 ? ((totalFact / totalPlan) * 100).toFixed(1) : 0;

  const budgetPlan = filtered.reduce((s, r) => s + (Number(r["Стоим. СМР [План]"]) || 0), 0);
  const budgetFact = filtered.reduce((s, r) => s + (Number(r["Стоим. СМР [Факт]"]) || 0), 0);
  const budgetDev = budgetFact - budgetPlan;
  const budgetPct = budgetPlan > 0 ? ((budgetFact / budgetPlan) * 100).toFixed(1) : 0;

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

  const growthData = trendData.map((item, idx) => {
    if (idx === 0) return { date: item.date, growth: 0 };
    const growth = item.fact - trendData[idx - 1].fact;
    return { date: item.date, growth: +growth.toFixed(1) };
  });

  const contractorStats = contractors.map(c => {
    const rows = filtered.filter(r => r["Подрядчик"] === c);
    const f = rows.reduce((s, r) => s + (Number(r["Факт км"]) || 0), 0);
    const p = rows.reduce((s, r) => s + (Number(r["План км"]) || 0), 0);
    return { name: c, fact: f, plan: p, pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
  }).filter(c => c.fact > 0 || c.plan > 0);

  const donutData = contractorStats.map(c => ({ name: c.name, value: +c.fact.toFixed(1) }));

  const branchPerformance = [...new Set(filtered.map(r => r["Ветка"]).filter(Boolean))].map(b => {
    const rows = filtered.filter(r => r["Ветка"] === b);
    const f = rows.reduce((s, r) => s + (Number(r["Факт км"]) || 0), 0);
    const p = rows.reduce((s, r) => s + (Number(r["План км"]) || 0), 0);
    return { name: b, fact: f, plan: p, pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
  }).filter(b => b.fact > 0 || b.plan > 0);

  const tmcDates = [...new Set(tmcData.map(r => r["Дата отчета"]).filter(Boolean))]
    .sort((a, b) => parseDate(a) - parseDate(b));
  const latestTmcDate = tmcDates[tmcDates.length - 1];
  const filteredTmc = tmcData.filter(r => r["Дата отчета"] === latestTmcDate);
  const tmcDeficit = filteredTmc.filter(r => (Number(r["Дефицит(-)/Запас(+)"]) || 0) < 0).length;

  const datesDates = [...new Set(datesData.map(r => r["Дата отчета"]).filter(Boolean))]
    .sort((a, b) => parseDate(a) - parseDate(b));
  const latestDatesDate = datesDates[datesDates.length - 1];
  const filteredDates = datesData.filter(r => r["Дата отчета"] === latestDatesDate);
  const overdueCount = filteredDates.filter(r => (Number(r["Отклонение (дней)"]) || 0) > 0).length;

  const changesDates = [...new Set(changesData.map(r => r["Дата отчета"]).filter(Boolean))]
    .sort((a, b) => parseDate(a) - parseDate(b));
  const latestChangesDate = changesDates[changesDates.length - 1];
  const filteredChanges = changesData.filter(r => r["Дата отчета"] === latestChangesDate);
  const changesVolumePlan = filteredChanges.reduce((s, r) => s + (Number(r["Объём [План]"]) || 0), 0);
  const changesVolumeFact = filteredChanges.reduce((s, r) => s + (Number(r["Объём [Факт]"]) || 0), 0);
  const changesVolumeDev = changesVolumeFact - changesVolumePlan;

  const sel = {
    background: '#16251e', color: 'white', border: '1px solid #1d2d24',
    borderRadius: '6px', padding: '8px 12px', fontSize: '13px', outline: 'none', cursor: 'pointer'
  };

  const tabBtn = (id) => ({
    padding: '10px 20px', cursor: 'pointer', border: 'none',
    borderBottom: activeTab === id ? '2px solid #2de2a6' : '2px solid transparent',
    background: 'none', color: activeTab === id ? '#2de2a6' : '#6b7280',
    fontSize: '14px', fontWeight: 'bold', transition: '0.3s',
    display: 'flex', alignItems: 'center', gap: '8px'
  });

  const statusColor = s => {
    if (!s) return '#6b7280';
    if (String(s).includes('🟢')) return '#2de2a6';
    if (String(s).includes('🟡')) return '#ff9b45';
    if (String(s).includes('🔴')) return '#ff4d4d';
    return '#6b7280';
  };

  const formatMoney = v => {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + ' млрд';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + ' млн';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + ' тыс';
    return v.toLocaleString('ru');
  };

  return (
    <div style={{ minHeight: '100vh', background: bg, color: '#f3f4f6', padding: '30px', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', margin: 0 }}>
          DASHBOARD <span style={{ color: '#2de2a6' }}>ANTAL</span>
        </h1>
        <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'right' }}>
          ДАННЫЕ ОБНОВЛЕНЫ:<br />
          <span style={{ color: 'white', fontWeight: 'bold' }}>{activeDate}</span>
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: '5px', borderBottom: '1px solid #1d2d24', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button style={tabBtn('construction')} onClick={() => setActiveTab('construction')}>🏗️ СМР</button>
        <button style={tabBtn('pir')} onClick={() => setActiveTab('pir')}>📋 ПИР/ПСД</button>
        <button style={tabBtn('materials')} onClick={() => setActiveTab('materials')}>📦 ТМЦ</button>
        <button style={tabBtn('schedule')} onClick={() => setActiveTab('schedule')}>⏱️ Сроки</button>
        <button style={tabBtn('changes')} onClick={() => setActiveTab('changes')}>📊 Изменения</button>
      </div>

      {/* СВОДНЫЕ KPI */}
      {dbKpi.length > 0 && activeTab === 'construction' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {Object.entries(dbKpi[0]).filter(([k]) => k !== 'Дата отчета').map(([key, val], i) => (
            <div key={i} style={{ ...card, padding: '14px' }}>
              <div style={{ ...lbl, fontSize: '10px' }}>{key}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#2de2a6' }}>
                {typeof val === 'number' ? val.toLocaleString('ru') : val}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* СМР */}
      {activeTab === 'construction' && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px' }}>
            <select style={sel} value={selectedBranch} onChange={e => { setSelectedBranch(e.target.value); setSelectedSection('Все'); }}>
              <option value="Все">Все ветки</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select style={sel} value={selectedContractor} onChange={e => setSelectedContractor(e.target.value)}>
              <option value="Все">Все подрядчики</option>
              {contractors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={sel} value={selectedSection} onChange={e => setSelectedSection(e.target.value)}>
              <option value="Все">Все участки</option>
              {sections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select style={sel} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
              <option value="">Последняя дата</option>
              {dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'Бюджет план', val: formatMoney(budgetPlan), color: '#2898ff' },
              { label: 'Бюджет факт', val: formatMoney(budgetFact), color: '#2de2a6' },
              { label: 'Отклонение бюджета', val: (budgetDev > 0 ? '+' : '') + formatMoney(budgetDev), color: budgetDev >= 0 ? '#2de2a6' : '#ff4d4d' },
              { label: 'Выполнение бюджета', val: budgetPct, unit: '%', color: '#ff9b45' },
            ].map((kpi, i) => (
              <div key={i} style={card}>
                <div style={lbl}>{kpi.label}</div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', color: kpi.color }}>
                  {kpi.val} <span style={{ fontSize: '12px', opacity: 0.6 }}>{kpi.unit || ''}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginBottom: '16px' }}>
            <div style={lbl}>Тренд выработки по датам (км)</div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" />
                <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#4b5563" fontSize={11} tick={{ fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />
                <Line type="monotone" dataKey="plan" stroke="#2898ff" strokeWidth={2} dot={{ r: 4, fill: '#2898ff' }} name="План" />
                <Line type="monotone" dataKey="fact" stroke="#2de2a6" strokeWidth={2} dot={{ r: 4, fill: '#2de2a6' }} name="Факт" />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={card}>
              <div style={lbl}>Прирост за период (км)</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={growthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" />
                  <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tick={{ fill: '#9ca3af' }} />
                  <YAxis stroke="#4b5563" fontSize={11} tick={{ fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} formatter={v => [`${v} км`, 'Прирост']} />
                  <Bar dataKey="growth" fill="#ff9b45" barSize={30} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="growth" position="top" style={{ fill: '#ff9b45', fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={card}>
              <div style={lbl}>% выполнения по датам</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" />
                  <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tick={{ fill: '#9ca3af' }} />
                  <YAxis stroke="#4b5563" fontSize={11} tick={{ fill: '#9ca3af' }} domain={[0, 'auto']} unit="%" />
                  <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} formatter={v => [`${v}%`, 'Выполнение']} />
                  <Line type="monotone" dataKey="pct" stroke="#ff9b45" strokeWidth={3} dot={{ r: 4, fill: '#ff9b45' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div style={card}>
              <div style={lbl}>Доля выработки по подрядчикам</div>
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" nameKey="name">
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} formatter={v => [`${v} км`, '']} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>Нет данных</div>
              )}
            </div>
            <div style={card}>
              <div style={lbl}>Выполнение по веткам</div>
              {branchPerformance.map((b, i) => (
                <div key={i} style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold' }}>{b.name}</span>
                    <span style={{ color: b.pct >= 100 ? '#2de2a6' : b.pct >= 80 ? '#ff9b45' : '#ff4d4d' }}>{b.pct}%</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                    Факт {b.fact.toFixed(1)} / План {b.plan.toFixed(1)} км
                  </div>
                  <div style={{ height: '6px', background: '#1d2d24', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(b.pct, 100)}%`, height: '100%',
                      background: b.pct >= 100 ? '#2de2a6' : b.pct >= 80 ? '#ff9b45' : '#ff4d4d'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: '16px' }}>
            <div style={card}>
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
            <div style={card}>
              <div style={lbl}>Статус по подрядчикам</div>
              {contractorStats.map((c, i) => (
                <div key={i} style={{ marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>{c.name}</span>
                    <span style={{ color: '#2de2a6' }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: '6px', background: '#1d2d24', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(c.pct, 100)}%`, height: '100%', background: '#2de2a6' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ПИР/ПСД */}
      {activeTab === 'pir' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {[
              { label: 'Всего участков', val: pirData.length, unit: 'шт', color: '#2898ff' },
              { label: 'ПСД выдано', val: pirData.filter(r => String(r["Статус ПСД"]).toLowerCase().includes('выдано')).length, unit: 'шт', color: '#2de2a6' },
              { label: 'Землеотвод оформлен', val: pirData.filter(r => String(r["Землеотвод"]).toLowerCase().includes('оформлен')).length, unit: 'шт', color: '#ff9b45' },
            ].map((kpi, i) => (
              <div key={i} style={card}>
                <div style={lbl}>{kpi.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: kpi.color }}>
                  {kpi.val} <span style={{ fontSize: '13px', opacity: 0.6 }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={lbl}>Статус ПИР/ПСД по участкам</div>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1d2d24' }}>
                    {['Участок', 'Регион', 'Протяж. км', 'Статус ПСД', '% ПСД', 'Экспертиза', 'Землеотвод', 'Сервитут', 'Статус ИРД'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 'normal', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pirData.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1d2d24' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{r["Участок"]}</td>
                      <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{r["Регион"]}</td>
                      <td style={{ padding: '8px 12px', color: '#2898ff' }}>{r["Протяж. км"]}</td>
                      <td style={{ padding: '8px 12px', color: String(r["Статус ПСД"]).toLowerCase().includes('выдано') ? '#2de2a6' : '#ff9b45' }}>{r["Статус ПСД"]}</td>
                      <td style={{ padding: '8px 12px' }}>{r["% ПСД"]}%</td>
                      <td style={{ padding: '8px 12px', color: String(r["Статус экспертизы"]).toLowerCase().includes('получено') ? '#2de2a6' : '#ff9b45' }}>{r["Статус экспертизы"]}</td>
                      <td style={{ padding: '8px 12px', color: String(r["Землеотвод"]).toLowerCase().includes('оформлен') ? '#2de2a6' : '#ff9b45' }}>{r["Землеотвод"]}</td>
                      <td style={{ padding: '8px 12px', color: String(r["Сервитут"]).toLowerCase().includes('оформлен') ? '#2de2a6' : '#ff9b45' }}>{r["Сервитут"]}</td>
                      <td style={{ padding: '8px 12px', color: String(r["Статус ИРД"]).toLowerCase().includes('выдано') ? '#2de2a6' : '#ff9b45' }}>{r["Статус ИРД"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ТМЦ */}
      {activeTab === 'materials' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {[
              { label: 'Всего позиций', val: filteredTmc.length, unit: 'шт', color: '#2898ff' },
              { label: 'Позиций в дефиците', val: tmcDeficit, unit: 'шт', color: tmcDeficit > 0 ? '#ff4d4d' : '#2de2a6' },
              { label: 'Позиций с запасом', val: filteredTmc.length - tmcDeficit, unit: 'шт', color: '#2de2a6' },
            ].map((kpi, i) => (
              <div key={i} style={card}>
                <div style={lbl}>{kpi.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: kpi.color }}>
                  {kpi.val} <span style={{ fontSize: '13px', opacity: 0.6 }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={lbl}>Остатки и дефицит материалов на {latestTmcDate}</div>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1d2d24' }}>
                    {['Подрядчик', 'Наименование материала', 'Ед.изм.', 'Остаток на дату', 'Расход план', 'Дефицит / Запас'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 'normal', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredTmc.map((r, i) => {
                    const ds = Number(r["Дефицит(-)/Запас(+)"]) || 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1d2d24', background: ds < 0 ? 'rgba(255,77,77,0.05)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{r["Подрядчик"]}</td>
                        <td style={{ padding: '8px 12px' }}>{r["Наименование материала"]}</td>
                        <td style={{ padding: '8px 12px', color: '#6b7280' }}>{r["Ед.изм."]}</td>
                        <td style={{ padding: '8px 12px', color: '#2898ff' }}>{Number(r["Остаток на дату"]).toLocaleString('ru')}</td>
                        <td style={{ padding: '8px 12px', color: '#ff9b45' }}>{Number(r["Расход план (след. период)"]).toLocaleString('ru')}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold', color: ds < 0 ? '#ff4d4d' : '#2de2a6' }}>
                          {ds > 0 ? '+' : ''}{ds.toLocaleString('ru')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* СРОКИ */}
      {activeTab === 'schedule' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {[
              { label: 'Всего задач', val: filteredDates.length, unit: 'шт', color: '#2898ff' },
              { label: 'Просрочено', val: overdueCount, unit: 'шт', color: overdueCount > 0 ? '#ff4d4d' : '#2de2a6' },
              { label: 'В срок', val: filteredDates.length - overdueCount, unit: 'шт', color: '#2de2a6' },
            ].map((kpi, i) => (
              <div key={i} style={card}>
                <div style={lbl}>{kpi.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: kpi.color }}>
                  {kpi.val} <span style={{ fontSize: '13px', opacity: 0.6 }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={lbl}>Отклонение сроков по задачам на {latestDatesDate}</div>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1d2d24' }}>
                    {['Задача', 'Плановая дата', 'Фактическая дата', 'Отклонение (дней)', 'Статус'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 'normal', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredDates.map((r, i) => {
                    const dev = Number(r["Отклонение (дней)"]) || 0;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #1d2d24', background: dev > 0 ? 'rgba(255,77,77,0.05)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold' }}>{r["Задача"] || r["Название"] || r["Участок"]}</td>
                        <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{r["Плановая дата"] || r["План"]}</td>
                        <td style={{ padding: '8px 12px', color: '#9ca3af' }}>{r["Фактическая дата"] || r["Факт"]}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 'bold', color: dev > 0 ? '#ff4d4d' : '#2de2a6' }}>
                          {dev > 0 ? '+' : ''}{dev}
                        </td>
                        <td style={{ padding: '8px 12px', color: statusColor(r["Статус"]) }}>{r["Статус"]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ИЗМЕНЕНИЯ */}
      {activeTab === 'changes' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {[
              { label: 'Объём план', val: changesVolumePlan.toFixed(1), unit: 'км', color: '#2898ff' },
              { label: 'Объём факт', val: changesVolumeFact.toFixed(1), unit: 'км', color: '#2de2a6' },
              { label: 'Отклонение', val: (changesVolumeDev > 0 ? '+' : '') + changesVolumeDev.toFixed(1), unit: 'км', color: changesVolumeDev >= 0 ? '#2de2a6' : '#ff4d4d' },
            ].map((kpi, i) => (
              <div key={i} style={card}>
                <div style={lbl}>{kpi.label}</div>
                <div style={{ fontSize: '26px', fontWeight: 'bold', color: kpi.color }}>
                  {kpi.val} <span style={{ fontSize: '13px', opacity: 0.6 }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={card}>
            <div style={lbl}>Изменения проекта на {latestChangesDate}</div>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1d2d24' }}>
                    {filteredChanges.length > 0
                      ? Object.keys(filteredChanges[0]).filter(k => k !== 'Дата отчета').map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 'normal', whiteSpace: 'nowrap' }}>{h}</th>
                        ))
                      : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredChanges.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1d2d24' }}>
                      {Object.entries(r).filter(([k]) => k !== 'Дата отчета').map(([k, v], j) => (
                        <td key={j} style={{ padding: '8px 12px', color: '#d1d5db' }}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
