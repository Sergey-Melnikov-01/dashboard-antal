import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
  LineChart, Line
} from 'recharts';
import { parseDate, toNum } from '../utils/format';
import { card, lbl } from '../styles/theme';
import { useDatasetView, filterRows } from '../hooks/useDatasetView';
import { PushDropdown } from './PushDropdown';
import { MetricTrendChart } from './MetricTrendChart';

// Вкладка «СМР»: фильтры, KPI по объёмам, график динамики, спидометры по стоимости, графики план/факт по датам
export const SmrTab = ({
  allData,
  datesData,
  smrPercentData,
  dates,
  activeDate,
  selectedBranch, setSelectedBranch,
  selectedContractor, setSelectedContractor,
  selectedSection, setSelectedSection,
  selectedDate, setSelectedDate,
  openDropdown, setOpenDropdown,
}) => {
  const [selectedSmrCharts, setSelectedSmrCharts] = useState([]);

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

  const filtered = useDatasetView(allData, {
    branch: selectedBranch,
    contractor: selectedContractor,
    section: selectedSection,
    date: activeDate,
  });

  const { totalFact, totalPlan, deviation } = useMemo(() => {
    const fact = filtered.reduce((s, r) => s + toNum(r["Факт км"]), 0);
    const plan = filtered.reduce((s, r) => s + toNum(r["План км"]), 0);
    const dev = fact - plan;
    return { totalFact: fact, totalPlan: plan, deviation: dev };
  }, [filtered]);

  // «Выполнение» — теперь задаётся вручную в листе DB_SMR_PERCENT (Ветка, Дата отчета, Процент выполнения),
  // а не считается из факт/план. Если для ветки нет значения — карточка показывает «—».
  // При ВЕТКА = «Все» — средневзвешенное по веткам (вес = План км ветки за активную дату).
  const smrPercent = useMemo(() => {
    if (!Array.isArray(smrPercentData) || !smrPercentData.length) return null;

    const parseAnyDate = s => {
      if (!s) return new Date(0);
      const str = String(s);
      if (str.includes('T')) return new Date(str); // ISO
      const [d, m, y] = str.split('.');            // dd.mm.yyyy
      return new Date(y, m - 1, d);
    };
    const ad = activeDate ? parseDate(activeDate) : null;

    // Последнее (по дате отчёта, не позже activeDate) ручное значение % для конкретной ветки
    const getBranchPercent = (branchName) => {
      let rows = smrPercentData.filter(r => r["Ветка"] === branchName);
      if (ad) {
        rows = rows.filter(r => parseAnyDate(r["Дата отчета"]) <= ad);
      }
      if (!rows.length) return null;
      const latest = rows.reduce((a, b) =>
        parseAnyDate(a["Дата отчета"]) >= parseAnyDate(b["Дата отчета"]) ? a : b
      );
      const raw = toNum(latest["Процент выполнения"]);
      return raw || raw === 0 ? raw * 100 : null;
    };

    if (selectedBranch !== 'Все') {
      return getBranchPercent(selectedBranch);
    }

    // «Все» — средневзвешенное по веткам, у которых есть ручное значение
    let weightedSum = 0;
    let weightTotal = 0;
    branches.forEach(b => {
      const pct = getBranchPercent(b);
      if (pct === null) return;
      const planSum = allData
        .filter(r => String(r["Ветка"] || '').trim() === String(b).trim())
        .filter(r => !activeDate || r["Дата отчета"] === activeDate)
        .reduce((s, r) => s + toNum(r["План км"]), 0);
      if (planSum <= 0) return;
      weightedSum += pct * planSum;
      weightTotal += planSum;
    });

    return weightTotal > 0 ? weightedSum / weightTotal : null;
  }, [smrPercentData, selectedBranch, activeDate, branches, allData]);

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

  // Динамика по датам для карточек-спидометров СМР (Материалы по НЗС / Материалы / СМР), в тенге
  const smrChartConfig = {
    'Материалы по НЗС': { planField: 'Материалы по НЗС [План]', factField: 'Материалы по НЗС [Факт]' },
    'Материалы': { planField: 'Материалы [План]', factField: 'Материалы [Факт]' },
    'СМР': { planField: 'СМР [План]', factField: 'СМР [Факт]' },
  };
  const smrChartDataByCategory = useMemo(() => {
    const result = {};
    Object.entries(smrChartConfig).forEach(([catName, { planField, factField }]) => {
      result[catName] = dates.map(date => {
        const rows = filterRows(allData, {
          date,
          branch: selectedBranch,
          contractor: selectedContractor,
          section: selectedSection,
        });
        const p = rows.reduce((s, r) => s + toNum(r[planField]), 0);
        const f = rows.reduce((s, r) => s + toNum(r[factField]), 0);
        return { date, plan: +p.toFixed(1), fact: +f.toFixed(1) };
      }).filter(row => row.plan !== 0 || row.fact !== 0);
    });
    return result;
  }, [dates, allData, selectedBranch, selectedContractor, selectedSection]);

  const contractorStats = useMemo(() => {
    return contractors.map(c => {
      const rows = filtered.filter(r => r["Подрядчик"] === c);
      const f = rows.reduce((s, r) => s + toNum(r["Факт км"]), 0);
      const p = rows.reduce((s, r) => s + toNum(r["План км"]), 0);
      return { name: c, fact: f, plan: p, pct: p > 0 ? +(f / p * 100).toFixed(1) : 0 };
    }).filter(c => c.fact > 0 || c.plan > 0);
  }, [contractors, filtered]);

  return (
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
          options={dates}
          onChange={v => setSelectedDate(v === 'Все' ? '' : v)}
          onReset=""
        />
        <PushDropdown
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          name="smr_chart"
          label="Графики"
          value={selectedSmrCharts}
          options={['Материалы по НЗС', 'Материалы', 'СМР']}
          onChange={v => setSelectedSmrCharts(v)}
          multi
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
          val: smrPercent === null ? '—' : smrPercent.toFixed(1),
          unit: smrPercent === null ? '' : '%',
          color: smrPercent === null ? '#6b7280' : (smrPercent > 100 ? '#ff4d4d' : '#ff9b45')
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

      {['Материалы по НЗС', 'Материалы', 'СМР'].map(cat => (
        selectedSmrCharts.includes(cat) && (
          <MetricTrendChart
            key={cat}
            title={cat}
            data={smrChartDataByCategory[cat]}
            unit="тнг"
          />
        )
      ))}

      {/* Sections chart — показывается только при выбранном участке (отключено по просьбе пользователя) */}
      {false && selectedSection !== 'Все' && (
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
  );
};
