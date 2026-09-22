import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = "https://script.google.com/macros/s/AKfycbw6XLjGzrrzg4knwf9QQ62zgv5jnKxvzZnZKhLUTSFX14b2dqa_iJZn2y5GjzPBgkH3/exec";
const FETCH_TIMEOUT_MS = 20000; // если Apps Script не ответил за 20 сек — считаем это сбоем, а не вечной загрузкой

// Загрузка всех данных дашборда с Google Apps Script.
// Теперь бэкенд сам кэширует ответ и сбрасывает кэш при правке таблицы,
// поэтому здесь можно спокойно ходить в GET без принудительного
// no-store — за актуальность отвечает сервер.
export function useDashboardData() {
  const [allData, setAllData] = useState([]);
  const [metricsData, setMetricsData] = useState([]);
  const [kpiData, setKpiData] = useState([]); // DB_KPI — сырой массив массивов (нестандартная раскладка: заголовок в 1-й строке, группировка по подрядчику прямо в теле листа)
  const [pirData, setPirData] = useState([]);
  const [pirVolsData, setPirVolsData] = useState([]);
  const [musData, setMusData] = useState([]);
  const [musColors, setMusColors] = useState([]);
  const [usGreenData, setUsGreenData] = useState([]);
  const [usBlueData, setUsBlueData] = useState([]);
  const [usRedData, setUsRedData] = useState([]);
  const [tmcData, setTmcData] = useState([]);
  const [tmcDvaData, setTmcDvaData] = useState([]);
  const [tmcFactData, setTmcFactData] = useState([]);
  const [datesData, setDatesData] = useState([]);
  const [smrPercentData, setSmrPercentData] = useState([]);
  const [volsRouteData, setVolsRouteData] = useState([]);
  const [musVolsData, setMusVolsData] = useState([]);
  const [codVolsData, setCodVolsData] = useState([]);
  const [usHistoryData, setUsHistoryData] = useState([]);
  const [contractorsData, setContractorsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // null = ок, строка = сообщение для UI

  // чтобы отличать "старый" fetch (истекший по таймауту) от актуального,
  // если пользователь быстро нажал "Обновить" несколько раз подряд
  const requestIdRef = useRef(0);

  const applyData = (raw) => {
    setAllData(Array.isArray(raw?.DB_SMR) ? raw.DB_SMR : []);

    if (Array.isArray(raw?.DB_METRIC)) {
      setMetricsData(raw.DB_METRIC);
    } else if (Array.isArray(raw?.DB_PIR)) {
      setMetricsData(raw.DB_PIR);
    } else {
      setMetricsData([]);
    }

    setPirData(Array.isArray(raw?.DB_PIR) ? raw.DB_PIR : []);
    setKpiData(Array.isArray(raw?.DB_KPI) ? raw.DB_KPI : []); // сырой массив массивов, не sheetToJson
    setPirVolsData(Array.isArray(raw?.DB_PIR_VOLS) ? raw.DB_PIR_VOLS : []);
    setMusData(Array.isArray(raw?.DB_PIR_MUS) ? raw.DB_PIR_MUS : []);
    setMusColors(Array.isArray(raw?.DB_PIR_MUS_COLORS) ? raw.DB_PIR_MUS_COLORS : []);
    setUsGreenData(Array.isArray(raw?.DB_US_GREEN) ? raw.DB_US_GREEN : []);
    setUsBlueData(Array.isArray(raw?.DB_US_BLUE) ? raw.DB_US_BLUE : []);
    setUsRedData(Array.isArray(raw?.DB_US_RED) ? raw.DB_US_RED : []);

    setTmcData(Array.isArray(raw?.DB_TMC) ? raw.DB_TMC : []);
    const tmcDvaKey = Object.keys(raw).find(k => k.toUpperCase().includes('TMCDVA') || k.toUpperCase().includes('TMC2') || k.toUpperCase() === 'DB_TMCDVA');
    setTmcDvaData(tmcDvaKey && Array.isArray(raw[tmcDvaKey]) ? raw[tmcDvaKey] : []);

    setTmcFactData(Array.isArray(raw?.DB_TMC_FACT) ? raw.DB_TMC_FACT : []);
    setDatesData(Array.isArray(raw?.DB_DATES) ? raw.DB_DATES : []);
    setSmrPercentData(Array.isArray(raw?.DB_SMR_PERCENT) ? raw.DB_SMR_PERCENT : []);
    setVolsRouteData(Array.isArray(raw?.DB_VOLS_ROUTE) ? raw.DB_VOLS_ROUTE : []);
    setMusVolsData(Array.isArray(raw?.DB_MUS_VOLS) ? raw.DB_MUS_VOLS : []);
    setCodVolsData(Array.isArray(raw?.DB_COD_VOLS) ? raw.DB_COD_VOLS : []);
    setUsHistoryData(Array.isArray(raw?.DB_US_HISTORY) ? raw.DB_US_HISTORY : []);
    setContractorsData(Array.isArray(raw?.DB_CONTRACTORS_VOLS) ? raw.DB_CONTRACTORS_VOLS : []);
  };

  const fetchOnce = (forceRefresh) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const url = forceRefresh ? `${API_URL}?refresh=1` : API_URL;

    return fetch(url, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .finally(() => clearTimeout(timeoutId));
  };

  // forceRefresh=true — дёргает ?refresh=1, минуя серверный кэш
  // (для кнопки "Обновить данные")
  const load = useCallback((forceRefresh = false) => {
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    fetchOnce(forceRefresh)
      .catch((firstErr) => {
        // один автоматический повтор — часто это просто холодный старт
        // Apps Script, вторая попытка обычно проходит быстро
        console.warn('Первая попытка загрузки не удалась, повтор...', firstErr);
        return fetchOnce(forceRefresh);
      })
      .then((raw) => {
        if (myRequestId !== requestIdRef.current) return; // пришёл ответ на устаревший запрос
        applyData(raw || {});
        setLoading(false);
      })
      .catch((err) => {
        if (myRequestId !== requestIdRef.current) return;
        console.error('API load error', err);
        const message = err?.name === 'AbortError'
          ? 'Сервер долго не отвечает. Проверьте соединение и попробуйте ещё раз.'
          : 'Не удалось загрузить данные дашборда. Попробуйте обновить.';
        setError(message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  // refetch(true) — для кнопки "Обновить данные" (принудительно, мимо кэша)
  // refetch() — обычный повтор (использует кэш на сервере, если он есть)
  const refetch = useCallback((forceRefresh = false) => load(forceRefresh), [load]);

  return {
    allData, metricsData, kpiData, pirData, pirVolsData, musData, musColors,
    usGreenData, usBlueData, usRedData, tmcData, tmcDvaData, tmcFactData,
    datesData, smrPercentData, volsRouteData, musVolsData, codVolsData,
    contractorsData, usHistoryData,
    loading, error, refetch,
  };
}
