import { useState, useEffect, useMemo } from 'react';
import { card, lbl } from '../styles/theme';
import { toNum } from '../utils/format';
import { getTmcUch, detectMaterials } from '../utils/tmc';
import { PushDropdown } from './PushDropdown';
import { TmcBarSvg } from './TmcBarSvg';
import { TmcBarSvgHorizontal } from './TmcBarSvgHorizontal';

// Вкладка «ТМЦ»: переключение Склад/Закуп, фильтры по участку и материалу, бар-чарт план/факт
export const MaterialsTab = ({ tmcData, tmcDvaData, openDropdown, setOpenDropdown }) => {
  const [tmcMode, setTmcMode] = useState('sklad'); // 'sklad' | 'zakup'
  const [selectedTmcSection, setSelectedTmcSection] = useState('Все');
  const [selectedTmcMaterial, setSelectedTmcMaterial] = useState('Все');

  const currentTmcData = useMemo(() => {
    return tmcMode === 'sklad' ? tmcData : tmcDvaData;
  }, [tmcMode, tmcData, tmcDvaData]);

  // ТМЦ: список участков
  const tmcSections = useMemo(() => {
    const allMats = detectMaterials(currentTmcData);
    return [...new Set(currentTmcData.map(r => getTmcUch(r)).filter(v => {
      if (!v || v === 'Общее количество' || v.startsWith('Unnamed')) return false;
      const rows = currentTmcData.filter(r => getTmcUch(r) === v);
      if (selectedTmcMaterial === 'Все') {
        return allMats.some(({ planKey, factKey }) =>
          rows.some(r => toNum(r[planKey]) > 0 || toNum(r[factKey]) > 0)
        );
      }
      const mat = allMats.find(({ name }) => name === selectedTmcMaterial);
      if (!mat) return false;
      return rows.some(r => toNum(r[mat.planKey]) > 0 || toNum(r[mat.factKey]) > 0);
    }))].sort();
  }, [currentTmcData, selectedTmcMaterial]);

  useEffect(() => {
    if (selectedTmcSection !== 'Все' && !tmcSections.includes(selectedTmcSection)) {
      setSelectedTmcSection('Все');
    }
  }, [tmcSections, selectedTmcSection]);

  // ТМЦ: детектированные материалы
  const tmcMaterials = useMemo(() => {
    const allMats = detectMaterials(currentTmcData);
    const rows = currentTmcData.filter(r => {
      const uch = getTmcUch(r);
      return uch && uch !== 'Общее количество' && !uch.startsWith('Unnamed');
    });
    const filteredRows = selectedTmcSection === 'Все' ? rows : rows.filter(r => getTmcUch(r) === selectedTmcSection);
    return allMats.filter(({ planKey, factKey }) =>
      filteredRows.some(r => toNum(r[planKey]) > 0 || toNum(r[factKey]) > 0)
    );
  }, [currentTmcData, selectedTmcSection]);

  // ТМЦ: данные для графика с агрегацией по участку
  const tmcChartData = useMemo(() => {
    const rows = currentTmcData.filter(r => {
      const uch = getTmcUch(r);
      return uch && uch !== 'Общее количество' && !uch.startsWith('Unnamed') && uch !== '';
    });
    const filteredRows = selectedTmcSection === 'Все'
      ? rows
      : rows.filter(r => getTmcUch(r) === selectedTmcSection);

    return tmcMaterials
      .filter(({ name }) => selectedTmcMaterial === 'Все' || name === selectedTmcMaterial)
      .map(({ name, planKey, factKey }) => {
        const plan = filteredRows.reduce((sum, r) => sum + toNum(r[planKey]), 0);
        const fact = filteredRows.reduce((sum, r) => sum + toNum(r[factKey]), 0);
        return { name, plan, fact };
      }).filter(d => d.plan > 0 || d.fact > 0);
  }, [currentTmcData, selectedTmcSection, tmcMaterials, selectedTmcMaterial]);

  return (
    <>
      {/* Sub-mode buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'sklad', label: 'Склад' },
          { id: 'zakup', label: 'Закуп' },
        ].map(btn => (
          <button
            key={btn.id}
            onClick={() => { setTmcMode(btn.id); setSelectedTmcSection('Все'); setSelectedTmcMaterial('Все'); }}
            className={`bubbly-button ${tmcMode === btn.id ? 'active' : ''}`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Фильтры: Участок + Материал */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }} onClick={e => { if (e.target === e.currentTarget) setOpenDropdown(null); }}>
        <PushDropdown
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
          name="tmc_section"
          label="Участок"
          value={selectedTmcSection}
          options={tmcSections}
          onChange={v => setSelectedTmcSection(v)}
        />
        <PushDropdown
          openDropdown={openDropdown}
          setOpenDropdown={setOpenDropdown}
            name="tmc_material"
            label="Материал"
            value={selectedTmcMaterial}
            options={tmcMaterials.map(m => m.name)}
            onChange={v => setSelectedTmcMaterial(v)}
            alignRight
          />
      </div>

      {/* Chart area */}
      {currentTmcData.length === 0 ? (
        <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: 220, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Загрузка данных ТМЦ...</div>
        </div>
      ) : tmcChartData.length === 0 ? (
        <div style={{ ...card, alignItems: 'center', justifyContent: 'center', minHeight: 220, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#6b7280' }}>Нет данных для отображения (все значения равны 0)</div>
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={lbl}>{tmcMode === 'sklad' ? 'Материалы — Склад' : 'Материалы — Закуп'}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(180deg, #5ab4ff, #0a4590)' }} />
                  План
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, background: 'linear-gradient(180deg, #2de2a6, #0a7050)' }} />
                  Факт
              </div>
            </div>
          </div>
          {tmcChartData.length <= 3
            ? <TmcBarSvgHorizontal data={tmcChartData} />
            : <TmcBarSvg data={tmcChartData} />
          }
        </div>
      )}
    </>
  );
};
