import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip as LeafletTooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseUsSheet } from '../data/usStages';

// ---------------------------------------------
// Стили, согласованные с общим тёмным оформлением дашборда
// ---------------------------------------------
const card = { background: '#21222d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' };
const lbl = { color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' };

const BRANCHES = ['Зеленая', 'Синяя', 'Красная'];

// Ключ CARTO для тайлов подложки — без него с августа 2026 показывается водяной знак
// "API KEY REQUIRED". Задаётся в Netlify: Site settings → Environment variables → VITE_CARTO_API_KEY.
// Получить бесплатный ключ (без регистрации, ~1 минута): https://carto.com/basemaps/apikey/
const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || '';

const branchColor = (branch) => {
  const b = (branch || '').toLowerCase();
  if (b.includes('зел')) return '#2de2a6';
  if (b.includes('син')) return '#2898ff';
  if (b.includes('красн')) return '#ff4d4d';
  return '#94a3b8';
};

// Затемняет цвет ветки — используется для завершённых объектов (построенные участки, готовые на 100% МУС),
// чтобы визуально отличать их от активных/незавершённых без необходимости приглядываться к стилю линии
const darkenColor = (hex, amount = 0.6) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.round(((num >> 16) & 0xff) * (1 - amount));
  const g = Math.round(((num >> 8) & 0xff) * (1 - amount));
  const b = Math.round((num & 0xff) * (1 - amount));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
};

// Статус сегмента -> стиль линии (пунктир + прозрачность)
// Значения в таблице: "построено", "строительство не завершено" (идёт стройка), "строительство не осуществлялось" (не начато)
const statusStyle = (status) => {
  const s = (status || '').toLowerCase();
  if (s.includes('построено') && !s.includes('не построено')) return { dashArray: null, opacity: 1, weight: 5 };
  if (s.includes('не завершено')) return { dashArray: '12 8', opacity: 0.95, weight: 5 };
  return { dashArray: '3 9', opacity: 0.85, weight: 4 }; // строительство не осуществлялось
};

// Человекочитаемая подпись статуса для панели/легенды
const statusLabel = (status) => {
  const s = (status || '').toLowerCase();
  if (s.includes('построено') && !s.includes('не построено')) return 'Построено';
  if (s.includes('не завершено')) return 'Идёт строительство';
  return 'Строительство не началось';
};

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Как toNum, но допускает "90°" и подобное — отбрасывает всё, кроме цифр, точки/запятой и минуса.
// Нужен для колонки "Направление", куда естественно вписывать градусы со значком "°"
const toNumLoose = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const cleaned = String(v).replace(',', '.').replace(/[^0-9.\-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

// --- Геометрия для "прилипания" подрядчика к ближайшей линии участка ---
// Используем простую плоскую проекцию (долгота масштабируется на cos широты для Казахстана,
// ~48° с.ш.) — этого достаточно для визуального позиционирования на карте, не для навигации.
const LAT_REF = 48;
const COS_REF = Math.cos((LAT_REF * Math.PI) / 180);
const toXY = (lat, lon) => ({ x: lon * COS_REF, y: lat });
const toLatLon = (x, y) => ({ lat: y, lon: x / COS_REF });

// Азимут (компас, 0°=север/вверх, 90°=восток/вправо) от точки A к точке B
function bearingDeg(lat1, lon1, lat2, lon2) {
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Ближайшая точка на отрезке [a,b] к точке p (все — [lat,lon]) + азимут этого отрезка
function closestPointOnSegment(p, a, b) {
  const A = toXY(a[0], a[1]), B = toXY(b[0], b[1]), P = toXY(p[0], p[1]);
  const dx = B.x - A.x, dy = B.y - A.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * dx, cy = A.y + t * dy;
  const dist = Math.hypot(P.x - cx, P.y - cy);
  const { lat, lon } = toLatLon(cx, cy);
  return { lat, lon, dist, bearing: bearingDeg(a[0], a[1], b[0], b[1]) };
}

// Находит ближайшую точку на ЛЮБОМ из сегментов трассы (перебирает все под-отрезки всех линий)
function snapToNearestRoute(lat, lon, routeSegments) {
  let best = null;
  routeSegments.forEach(seg => {
    const pts = seg.positions;
    for (let i = 0; i < pts.length - 1; i++) {
      const candidate = closestPointOnSegment([lat, lon], pts[i], pts[i + 1]);
      if (!best || candidate.dist < best.dist) best = candidate;
    }
  });
  return best; // { lat, lon, dist, bearing } или null, если сегментов нет
}

// Кастомная иконка для ЦОД — золотой ромб, визуально отличается от круглых МУС
const codIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 14px; height: 14px;
    background: #f5c518;
    border: 2px solid #0a0a0f;
    transform: rotate(45deg);
    box-shadow: 0 0 4px rgba(0,0,0,0.6);
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Разметка SVG кабелеукладчика (переиспользуется функцией ниже для разных углов поворота).
// Развёрнут "как есть" в сторону востока/вправо (0° в нашей системе направления = смотрит вправо);
// геометрический центр корпуса бульдозера (без катушки) — точка (105,60) из viewBox 180x120,
// именно она "садится" на линию участка и служит осью поворота.
const CONTRACTOR_SVG_MARKUP = `
  <!-- Нижняя линия земли -->
  <line x1="10" y1="88" x2="150" y2="88" stroke="#212529" stroke-width="4" stroke-linecap="round"/>

  <!-- Гусеницы (основа) -->
  <rect x="45" y="68" width="95" height="20" rx="10" fill="#545b62" stroke="#212529" stroke-width="4" stroke-linejoin="round"/>
  
  <!-- Маленькие катки внутри гусениц -->
  <circle cx="58" cy="78" r="3" fill="#ced4da" />
  <circle cx="72" cy="78" r="3" fill="#ced4da" />
  <circle cx="86" cy="78" r="3" fill="#ced4da" />
  <circle cx="100" cy="78" r="3" fill="#ced4da" />
  <circle cx="114" cy="78" r="3" fill="#ced4da" />
  <line x1="58" y1="78" x2="114" y2="78" stroke="#212529" stroke-width="2" stroke-linecap="round" opacity="0.3"/>

  <!-- Соединение под кабиной -->
  <rect x="65" y="58" width="65" height="10" fill="#f5af42" stroke="#212529" stroke-width="4" stroke-linejoin="round" />

  <!-- Корпус и кабина трактора -->
  <path d="M 65 58 L 130 58 L 130 30 C 130 18, 115 12, 95 12 L 88 12 L 88 30 L 65 30 Z" fill="#ffe082" stroke="#212529" stroke-width="4" stroke-linejoin="round"/>
  
  <!-- Тень на корпусе -->
  <path d="M 65 58 L 88 58 L 88 30 L 65 30 Z" fill="#ffd54f" />

  <!-- Окно кабины -->
  <path d="M 95 20 L 120 20 L 120 32 L 95 32 Z" fill="#e0f7fa" stroke="#212529" stroke-width="3" stroke-linejoin="round"/>

  <!-- Выхлопная труба -->
  <rect x="73" y="16" width="8" height="14" fill="#757575" stroke="#212529" stroke-width="3" stroke-linejoin="round"/>
  <line x1="77" y1="16" x2="77" y2="8" stroke="#212529" stroke-width="3" stroke-linecap="round"/>

  <!-- Крепление переднего ковша -->
  <line x1="25" y1="72" x2="65" y2="72" stroke="#212529" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="5" fill="#ffd54f" stroke="#212529" stroke-width="3" />

  <!-- Передний большой ковш -->
  <path d="M 32 30 C 15 40, 15 70, 32 80" fill="none" stroke="#ffe082" stroke-width="10" stroke-linecap="round"/>
  <path d="M 32 30 C 15 40, 15 70, 32 80" fill="none" stroke="#212529" stroke-width="4" stroke-linecap="round"/>
`;


// Доля от ширины/высоты viewBox (180x120), где расположен корпус бульдозера — используется
// и как якорь маркера (иконка "садится" на карту корпусом, а не серединой всей картинки с катушкой),
// и как центр вращения (transform-origin), чтобы при повороте корпус оставался на месте, а не съезжал
const CONTRACTOR_ANCHOR_FRACTION = { x: 105 / 180, y: 60 / 120 };

// Создаёт иконку бульдозера, развёрнутую на нужный угол (0-360°, компас: 0/360=вверх, 90=вправо, 180=вниз, 270=влево).
// Иконка нарисована "лицом вправо", поэтому к введённому углу прибавляем поправку -90°.
// Иконка нарисована сбоку (профиль техники, как на референс-фото) — её можно только "развернуть"
// влево/вправо зеркально, а не крутить на произвольный угол компаса: при повороте на 90°/180°
// боковой силуэт визуально встаёт "на попа" или переворачивается вверх ногами, что для техники
// на земле не имеет смысла. Поэтому раскладываем направление на "смотрит влево или вправо"
// по восточной составляющей (sin) и просто зеркалим через scaleX, без вращения.
function makeContractorIcon(directionDeg = 90) {
  const W = 72, H = 48; // 2x от прежнего размера
  const anchorX = W * CONTRACTOR_ANCHOR_FRACTION.x;
  const anchorY = H * CONTRACTOR_ANCHOR_FRACTION.y;
  const rad = ((directionDeg ?? 90) * Math.PI) / 180;
  const facingLeft = Math.sin(rad) < 0; // компас: 0=вверх,90=вправо,180=вниз,270=влево
  const scaleX = facingLeft ? -1 : 1;
  return L.divIcon({
    className: '',
    html: `<div style="width:${W}px;height:${H}px;transform:scaleX(${scaleX});transform-origin:${CONTRACTOR_ANCHOR_FRACTION.x * 100}% ${CONTRACTOR_ANCHOR_FRACTION.y * 100}%;">
      <svg width="${W}" height="${H}" viewBox="0 0 180 120" xmlns="http://www.w3.org/2000/svg"
          style="filter: drop-shadow(0 0 3px rgba(0,0,0,0.8));">
        ${CONTRACTOR_SVG_MARKUP}
      </svg>
    </div>`,
    iconSize: [W, H],
    iconAnchor: [anchorX, anchorY],
  });
}

// Мини-версия того же бульдозера (без катушки) — для кнопки-переключателя слоя в панели "СЛОИ"
const contractorButtonIconSvg = "<svg width=\"16\" height=\"14\" viewBox=\"60 25 80 62\" xmlns=\"http://www.w3.org/2000/svg\" style=\"vertical-align: -2px;\">\n  <!-- Земля -->\n  <line x1=\"60\" y1=\"85\" x2=\"140\" y2=\"85\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n\n  <!-- Гусеницы -->\n  <rect x=\"70\" y=\"68\" width=\"65\" height=\"14\" rx=\"7\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linejoin=\"round\"/>\n  <circle cx=\"78\" cy=\"75\" r=\"2\" fill=\"currentColor\" />\n  <circle cx=\"88\" cy=\"75\" r=\"2\" fill=\"currentColor\" />\n  <circle cx=\"98\" cy=\"75\" r=\"2\" fill=\"currentColor\" />\n  <circle cx=\"108\" cy=\"75\" r=\"2\" fill=\"currentColor\" />\n  <circle cx=\"118\" cy=\"75\" r=\"2\" fill=\"currentColor\" />\n\n  <!-- Рама под кабиной -->\n  <rect x=\"80\" y=\"61\" width=\"48\" height=\"8\" fill=\"currentColor\" opacity=\"0.5\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linejoin=\"round\" />\n\n  <!-- Кабина и корпус -->\n  <path d=\"M 80 61 L 128 61 L 128 42 C 128 32, 118 28, 102 28 L 96 28 L 96 42 L 80 42 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linejoin=\"round\"/>\n  <path d=\"M 80 61 L 96 61 L 96 42 L 80 42 Z\" fill=\"currentColor\" opacity=\"0.3\" />\n\n  <!-- Окно -->\n  <path d=\"M 102 34 L 120 34 L 120 44 L 102 44 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/>\n\n  <!-- Труба выхлопная -->\n  <rect x=\"85\" y=\"32\" width=\"6\" height=\"10\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/>\n  <line x1=\"88\" y1=\"32\" x2=\"88\" y2=\"26\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n\n  <!-- Крепление ковша -->\n  <line x1=\"62\" y1=\"71\" x2=\"80\" y2=\"71\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\"/>\n  <circle cx=\"72\" cy=\"54\" r=\"4\" fill=\"currentColor\" />\n\n  <!-- Большой ковш спереди -->\n  <path d=\"M 67 42 C 58 48, 58 68, 67 76\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linecap=\"round\"/>\n</svg>";


// Скрываем декоративный флаг в стандартной атрибуции Leaflet (сам текст атрибуции
// оставляем — это обязательное условие бесплатных тайлов Esri/OSM) и стилизуем блок под тёмную тему
const LeafletAttributionStyles = () => (
  <style>{`
    .leaflet-control-attribution .leaflet-attribution-flag { display: none !important; }
    .leaflet-control-attribution {
      background: rgba(15, 23, 36, 0.75) !important;
      color: #94a3b8 !important;
      font-size: 10px !important;
    }
    .leaflet-control-attribution a { color: #cbd5e1 !important; }
    /* Осветляем тёмную подложку CartoDB, чтобы не была угольно-чёрной */
    .vols-map-tiles-lighter { filter: brightness(1.45) contrast(0.92); }
    /* Убираем стандартную рамку фокуса браузера, которая появляется вокруг линии после клика */
    .leaflet-interactive:focus { outline: none !important; }
    /* Тултип при наведении — тот же тёмный стиль, что и у панели с деталями по клику,
       вместо стандартного белого Leaflet-тултипа */
    .vols-dark-tooltip.leaflet-tooltip {
      background: rgba(15, 17, 26, 0.95);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 10px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.5);
    }
    .vols-dark-tooltip.leaflet-tooltip::before {
      display: none;
    }
  `}</style>
);

// Слушает клики по самой карте (не по линиям/маркерам) — используется, чтобы закрывать
// информационную панель при клике на пустое место
const MapClickCatcher = ({ onEmptyClick }) => {
  useMapEvents({ click: () => onEmptyClick() });
  return null;
};

export function VolsMapTab({ volsRouteData = [], musVolsData = [], codVolsData = [], contractorsData = [], usGreenData = [], usBlueData = [], usRedData = [] }) {
  const [visibleBranches, setVisibleBranches] = useState(new Set(BRANCHES));
  const [showMus, setShowMus] = useState(true);
  const [showCod, setShowCod] = useState(true);
  const [showContractors, setShowContractors] = useState(true);
  const [selectedSegment, setSelectedSegment] = useState(null);
  const [selectedMus, setSelectedMus] = useState(null);
  const [selectedContractor, setSelectedContractor] = useState(null);

  // % готовности каждого МУС — берём из того же чек-листа (DB_US_GREEN/BLUE/RED), что и кнопка "МУС",
  // чтобы цифры на карте и на вкладке "МУС" совпадали 1-в-1. Ключ — точное имя объекта (например 'УС "Уральск"').
  const musPercentByName = useMemo(() => {
    const map = {};
    [...parseUsSheet(usGreenData), ...parseUsSheet(usBlueData), ...parseUsSheet(usRedData)].forEach(o => {
      map[o.name] = o.totalPercent;
    });
    return map;
  }, [usGreenData, usBlueData, usRedData]);

  const toggleBranch = (branch) => {
    setVisibleBranches(prev => {
      const next = new Set(prev);
      next.has(branch) ? next.delete(branch) : next.add(branch);
      return next;
    });
  };

  // Сегменты трассы -> готовые полилинии с координатами и стилем
  const segments = useMemo(() => {
    return (volsRouteData || [])
      .map(r => {
        const latA = toNum(r["Lat_А"] ?? r["Lat_A"]);
        const lonA = toNum(r["Lon_А"] ?? r["Lon_A"]);
        const latB = toNum(r["Lat_Б"] ?? r["Lat_B"]);
        const lonB = toNum(r["Lon_Б"] ?? r["Lon_B"]);
        if (latA === null || lonA === null || latB === null || lonB === null) return null;

        // "Путь" — детальная трасса из KMZ (много точек, повторяет реальный маршрут);
        // если её нет или она битая — просто прямая линия между А и Б
        let positions = [[latA, lonA], [latB, lonB]];
        const pathStr = r["Путь"];
        if (pathStr && typeof pathStr === 'string') {
          const parsed = pathStr.split(';').map(pair => {
            const [lat, lon] = pair.split(',').map(Number);
            return (Number.isFinite(lat) && Number.isFinite(lon)) ? [lat, lon] : null;
          }).filter(Boolean);
          if (parsed.length >= 2) positions = parsed;
        }

        return {
          branch: r["Ветка"] || '',
          name: r["Участок"] || '',
          status: r["Статус"] || '',
          pct: toNum(r["Процент_выполнения"]),
          planKm: r["План_км"] ?? '',
          factKm: r["Факт_км"] ?? '',
          contractor: r["Подрядчик"] ?? r["Подрядчик "] ?? '',
          positions,
        };
      })
      .filter(Boolean)
      .filter(s => visibleBranches.has(s.branch));
  }, [volsRouteData, visibleBranches]);

  // МУС -> точки с координатами
  const musPoints = useMemo(() => {
    return (musVolsData || [])
      .map(r => {
        const lat = toNum(r["Lat"]);
        const lon = toNum(r["Lon"]);
        if (lat === null || lon === null) return null;
        const name = r["Название_МУС"] || '';
        return {
          name,
          branch: r["Ветка"] || '',
          type: r["Тип"] || '',
          region: r["Область"] || '',
          district: r["Район"] || '',
          percent: musPercentByName[name] ?? null,
          lat, lon,
        };
      })
      .filter(Boolean)
      .filter(m => !m.branch || visibleBranches.has(m.branch.split('/')[0].trim()));
  }, [musVolsData, visibleBranches, musPercentByName]);

  const kazakhstanCenter = [48.0, 68.0];

  // ЦОД -> точки с координатами (отдельный источник от МУС)
  const codPoints = useMemo(() => {
    return (codVolsData || [])
      .map(r => {
        const lat = toNum(r["Lat"]);
        const lon = toNum(r["Lon"]);
        if (lat === null || lon === null) return null;
        return {
          name: r["Название_ЦОД"] || '',
          region: r["Область"] || '',
          district: r["Район"] || '',
          lat, lon,
        };
      })
      .filter(Boolean);
  }, [codVolsData]);

  // Кабелеукладчики/подрядчики — координаты из таблицы служат лишь ориентиром: находим ближайшую
  // точку на ближайшем сегменте трассы и "прилипаем" именно к ней. Направление — из колонки
  // "Направление", если она заполнена; иначе авто, по касательной найденного отрезка линии.
  const contractorPoints = useMemo(() => {
    return (contractorsData || [])
      .map(r => {
        const rawLat = toNum(r["Lat"]);
        const rawLon = toNum(r["Lon"]);
        if (rawLat === null || rawLon === null) return null;

        const manualBearing = toNumLoose(r["Направление"] ?? r["Направление "]);
        // Прилипания к линии больше нет — точка ставится ровно там, где указаны координаты
        // (можно поставить чуть в стороне от трассы). Поиск ближайшего сегмента используется
        // только для расчёта направления по умолчанию, если "Направление" не заполнено вручную.
        const nearest = manualBearing === null && segments.length > 0
          ? snapToNearestRoute(rawLat, rawLon, segments)
          : null;
        const bearing = manualBearing !== null ? manualBearing : (nearest ? nearest.bearing : 90);

        return {
          name: r["Подрядчик"] || '',
          section: r["Участок"] || '',
          lat: rawLat, lon: rawLon, bearing,
        };
      })
      .filter(Boolean);
  }, [contractorsData, segments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <LeafletAttributionStyles />
      {/* Панель управления слоями */}
      <div style={{ ...card, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: '20px', padding: '16px 22px' }}>
        <div>
          <div style={lbl}>Ветки</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {BRANCHES.map(branch => {
              const active = visibleBranches.has(branch);
              return (
                <button
                  key={branch}
                  onClick={() => toggleBranch(branch)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '10px',
                    border: `1px solid ${active ? branchColor(branch) : 'rgba(255,255,255,0.1)'}`,
                    background: active ? `${branchColor(branch)}22` : 'transparent',
                    color: active ? branchColor(branch) : '#6b7280',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: branchColor(branch), display: 'inline-block' }} />
                  {branch}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={lbl}>Слои</div>
          <button
            onClick={() => setShowMus(v => !v)}
            style={{
              padding: '6px 12px', borderRadius: '10px',
              border: `1px solid ${showMus ? '#2de2a6' : 'rgba(255,255,255,0.1)'}`,
              background: showMus ? '#2de2a622' : 'transparent',
              color: showMus ? '#2de2a6' : '#6b7280',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            📡 МУС
          </button>
          <button
            onClick={() => setShowCod(v => !v)}
            style={{
              marginLeft: '8px',
              padding: '6px 12px', borderRadius: '10px',
              border: `1px solid ${showCod ? '#f5c518' : 'rgba(255,255,255,0.1)'}`,
              background: showCod ? '#f5c51822' : 'transparent',
              color: showCod ? '#f5c518' : '#6b7280',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            ◆ ЦОД
          </button>
          <button
            onClick={() => setShowContractors(v => !v)}
            style={{
              marginLeft: '8px',
              padding: '6px 12px', borderRadius: '10px',
              border: `1px solid ${showContractors ? '#f5a623' : 'rgba(255,255,255,0.1)'}`,
              background: showContractors ? '#f5a62322' : 'transparent',
              color: showContractors ? '#f5a623' : '#6b7280',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <span dangerouslySetInnerHTML={{ __html: contractorButtonIconSvg }} /> Подрядчики
          </button>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 20, height: 0, borderTop: '3px solid #6b7280' }} /> Построено
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 20, height: 0, borderTop: '3px dashed #6b7280' }} /> Идёт строительство
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 20, height: 0, borderTop: '3px dotted #6b7280', opacity: 0.6 }} /> Строительство не началось
          </div>
        </div>
      </div>

      {/* Карта */}
      <div style={{ ...card, padding: 0, overflow: 'hidden', height: '640px', position: 'relative' }}>
        <MapContainer
          center={kazakhstanCenter}
          zoom={5}
          style={{ width: '100%', height: '100%', background: '#1c1d26' }}
          scrollWheelZoom={true}
        >
          {/* Тёмная подложка CartoDB — лёгкие растровые тайлы, быстрая загрузка,
              осветлена через CSS-фильтр (className ниже), чтобы не была угольно-чёрной.
              С августа 2026 CARTO требует бесплатный API-ключ для анонимных запросов —
              без него тайлы показывают водяной знак "API KEY REQUIRED".
              Ключ берётся из VITE_CARTO_API_KEY (Netlify → Environment variables),
              получить бесплатно: https://carto.com/basemaps/apikey/ */}
          <TileLayer
            url={`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png${CARTO_API_KEY ? `?key=${CARTO_API_KEY}` : ''}`}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            className="vols-map-tiles-lighter"
          />

          <MapClickCatcher onEmptyClick={() => { setSelectedSegment(null); setSelectedMus(null); setSelectedContractor(null); }} />

          {segments.map((s, i) => {
            const style = statusStyle(s.status);
            const isBuilt = (s.status || '').toLowerCase().includes('построено') && !(s.status || '').toLowerCase().includes('не построено');
            const color = isBuilt ? darkenColor(branchColor(s.branch)) : branchColor(s.branch);
            return (
              <React.Fragment key={`seg-${i}`}>
                {/* Тёмная обводка под линией — для контраста на пёстром спутниковом фоне */}
                <Polyline
                  positions={s.positions}
                  pathOptions={{
                    color: '#0a0a0f',
                    weight: style.weight + 3,
                    opacity: 0.55,
                    dashArray: style.dashArray,
                    lineCap: 'round',
                  }}
                  interactive={false}
                />
                {/* Цветная линия ветки поверх обводки — чисто визуальная, клик не обрабатывает
                    (у тонкой линии слишком маленькая область попадания) */}
                <Polyline
                  positions={s.positions}
                  pathOptions={{
                    color,
                    weight: style.weight,
                    opacity: style.opacity,
                    dashArray: style.dashArray,
                    lineCap: 'round',
                  }}
                  interactive={false}
                />
                {/* Невидимая широкая линия поверх — только она ловит клики, зато область попадания
                    в разы больше видимой линии, кликать становится намного проще.
                    bubblingMouseEvents=false обязателен: иначе клик "проваливается" дальше до карты
                    и MapClickCatcher тут же закрывает панель, которую мы только что открыли */}
                <Polyline
                  positions={s.positions}
                  bubblingMouseEvents={false}
                  pathOptions={{ color: '#000', weight: 20, opacity: 0 }}
                  eventHandlers={{
                    click: (e) => {
                      if (e.originalEvent) e.originalEvent.stopPropagation();
                      L.DomEvent.stopPropagation(e);
                      setSelectedMus(null);
                      setSelectedContractor(null);
                      setSelectedSegment(s);
                    },
                  }}
                />
              </React.Fragment>
            );
          })}

          {showMus && musPoints.map((m, i) => {
            const isDone = m.percent !== null && m.percent >= 99.5; // тот же порог, что и "готов" на вкладке МУС
            const musColor = isDone ? darkenColor(branchColor(m.branch)) : branchColor(m.branch);
            return (
            <React.Fragment key={`mus-${i}`}>
              {/* Видимый маркер — чисто визуальный */}
              <CircleMarker
                center={[m.lat, m.lon]}
                radius={6}
                interactive={false}
                pathOptions={{
                  color: '#0a0a0f',
                  weight: 2.5,
                  fillColor: musColor,
                  fillOpacity: 1,
                }}
              />
              {/* Невидимая широкая область поверх — ловит и наведение (тултип), и клик (панель с деталями).
                  bubblingMouseEvents=false — иначе клик проваливается до карты и сразу закрывает панель */}
              <CircleMarker
                center={[m.lat, m.lon]}
                radius={14}
                bubblingMouseEvents={false}
                pathOptions={{ color: '#000', weight: 0, opacity: 0, fillOpacity: 0 }}
                eventHandlers={{
                  click: (e) => {
                    if (e.originalEvent) e.originalEvent.stopPropagation();
                    L.DomEvent.stopPropagation(e);
                    setSelectedSegment(null);
                    setSelectedContractor(null);
                    setSelectedMus(m);
                  },
                }}
              >
                <LeafletTooltip sticky className="vols-dark-tooltip">
                  {m.name}
                </LeafletTooltip>
              </CircleMarker>
            </React.Fragment>
            );
          })}

          {showCod && codPoints.map((c, i) => (
            <Marker key={`cod-${i}`} position={[c.lat, c.lon]} icon={codIcon}>
              <LeafletTooltip sticky className="vols-dark-tooltip">
                {c.name}
              </LeafletTooltip>
            </Marker>
          ))}

          {showContractors && contractorPoints.map((ct, i) => (
            <Marker
              key={`contractor-${i}`}
              position={[ct.lat, ct.lon]}
              icon={makeContractorIcon(ct.bearing)}
              eventHandlers={{
                click: (e) => {
                  if (e.originalEvent) e.originalEvent.stopPropagation();
                  L.DomEvent.stopPropagation(e);
                  setSelectedSegment(null);
                  setSelectedMus(null);
                  setSelectedContractor(ct);
                },
              }}
            >
              <LeafletTooltip sticky className="vols-dark-tooltip">
                {ct.name}
              </LeafletTooltip>
            </Marker>
          ))}
        </MapContainer>

        {/* Панель с деталями участка — появляется по клику на линию, закрывается по клику на пустое место/другой участок */}
        {selectedSegment && (
          <div style={{
            position: 'absolute', top: 16, right: 16, zIndex: 1000,
            background: 'rgba(15, 17, 26, 0.95)', border: `1px solid ${branchColor(selectedSegment.branch)}55`,
            borderRadius: 14, padding: '16px 18px', minWidth: 260, maxWidth: 320,
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>{selectedSegment.name}</div>
              <button
                onClick={() => setSelectedSegment(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>План, км</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedSegment.planKm || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Факт, км</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedSegment.factKm || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Процент выполнения</span>
                <span style={{ color: branchColor(selectedSegment.branch), fontWeight: 700 }}>
                  {selectedSegment.pct !== null ? `${selectedSegment.pct}%` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Статус</span>
                <span style={{ color: '#e2e8f0' }}>{statusLabel(selectedSegment.status)}</span>
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Подрядчик</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600, textAlign: 'right' }}>{selectedSegment.contractor || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Панель с деталями МУС — появляется по клику на маркер, закрывается по клику на пустое место/другой объект.
            Процент выполнения берётся из того же чек-листа, что и кнопка "МУС" — цифры совпадают 1-в-1 */}
        {selectedMus && (
          <div style={{
            position: 'absolute', top: 16, right: 16, zIndex: 1000,
            background: 'rgba(15, 17, 26, 0.95)', border: `1px solid ${branchColor(selectedMus.branch)}55`,
            borderRadius: 14, padding: '16px 18px', minWidth: 260, maxWidth: 320,
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>{selectedMus.name}</div>
              <button
                onClick={() => setSelectedMus(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Тип</span>
                <span style={{ color: '#e2e8f0', fontWeight: 600, textAlign: 'right' }}>{selectedMus.type || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: '#94a3b8' }}>Процент выполнения</span>
                <span style={{ color: branchColor(selectedMus.branch), fontWeight: 700 }}>
                  {selectedMus.percent !== null ? `${selectedMus.percent.toFixed(1)}%` : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Панель с деталями подрядчика — появляется по клику на кабелеукладчик */}
        {selectedContractor && (
          <div style={{
            position: 'absolute', top: 16, right: 16, zIndex: 1000,
            background: 'rgba(15, 17, 26, 0.95)', border: '1px solid #f5a62355',
            borderRadius: 14, padding: '16px 18px', minWidth: 260, maxWidth: 320,
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.3 }}>{selectedContractor.name}</div>
              <button
                onClick={() => setSelectedContractor(null)}
                style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Участок</div>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600, lineHeight: 1.4 }}>{selectedContractor.section || '—'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
