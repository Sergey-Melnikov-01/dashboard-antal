import { useState, useEffect } from 'react';

const API_URL = "https://script.google.com/macros/s/AKfycbw6XLjGzrrzg4knwf9QQ62zgv5jnKxvzZnZKhLUTSFX14b2dqa_iJZn2y5GjzPBgkH3/exec";

// Загрузка всех данных дашборда с Google Apps Script (раз в маунт компонента)
export function useDashboardData() {
  const [allData, setAllData] = useState([]);
  const [metricsData, setMetricsData] = useState([]);
  const [pirData, setPirData] = useState([]); // <-- added state for DB_PIR
  const [pirVolsData, setPirVolsData] = useState([]);
  const [musData, setMusData] = useState([]); // DB_PIR_MUS — трекер МУС
  const [musColors, setMusColors] = useState([]); // цвет заливки колонки "Наименование МУС" по строкам (для деления на ветки)
  const [usGreenData, setUsGreenData] = useState([]); // DB_US_GREEN — вкладка "УС", зелёная ветка
  const [usBlueData, setUsBlueData] = useState([]);   // DB_US_BLUE — вкладка "УС", синяя ветка
  const [usRedData, setUsRedData] = useState([]);     // DB_US_RED — вкладка "УС", красная ветка
  const [tmcData, setTmcData] = useState([]);
  const [tmcDvaData, setTmcDvaData] = useState([]);
  const [datesData, setDatesData] = useState([]); // DB_DATES — отклонение сроков
  const [smrPercentData, setSmrPercentData] = useState([]); // DB_SMR_PERCENT — ручной % выполнения по веткам
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(API_URL)
      .then(res => res.json())
      .then(rawData => {
      const raw = rawData || {};

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
      setPirVolsData(Array.isArray(raw?.DB_PIR_VOLS) ? raw.DB_PIR_VOLS : []);
      setMusData(Array.isArray(raw?.DB_PIR_MUS) ? raw.DB_PIR_MUS : []);
      setMusColors(Array.isArray(raw?.DB_PIR_MUS_COLORS) ? raw.DB_PIR_MUS_COLORS : []);
      setUsGreenData(Array.isArray(raw?.DB_US_GREEN) ? raw.DB_US_GREEN : []);
      setUsBlueData(Array.isArray(raw?.DB_US_BLUE) ? raw.DB_US_BLUE : []);
      setUsRedData(Array.isArray(raw?.DB_US_RED) ? raw.DB_US_RED : []);

      // ТМЦ
      console.log('Все ключи API:', Object.keys(raw));
      setTmcData(Array.isArray(raw?.DB_TMC) ? raw.DB_TMC : []);
      const tmcDvaKey = Object.keys(raw).find(k => k.toUpperCase().includes('TMCDVA') || k.toUpperCase().includes('TMC2') || k.toUpperCase() === 'DB_TMCDVA');
      console.log('Ключ TMCdva:', tmcDvaKey, '| Данные:', tmcDvaKey ? raw[tmcDvaKey]?.length : 0);
      setTmcDvaData(tmcDvaKey && Array.isArray(raw[tmcDvaKey]) ? raw[tmcDvaKey] : []);

      // DB_DATES — отклонение сроков
      setDatesData(Array.isArray(raw?.DB_DATES) ? raw.DB_DATES : []);

      // DB_SMR_PERCENT — ручной % выполнения по веткам (история отчётов)
      setSmrPercentData(Array.isArray(raw?.DB_SMR_PERCENT) ? raw.DB_SMR_PERCENT : []);

      setLoading(false);
    }).catch(err => {
      console.error('API load error', err);
      setLoading(false);
    });
  }, []);

  return { allData, metricsData, pirData, pirVolsData, musData, musColors, usGreenData, usBlueData, usRedData, tmcData, tmcDvaData, datesData, smrPercentData, loading };
}
