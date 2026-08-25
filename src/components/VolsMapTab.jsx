import React, { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Tooltip as LeafletTooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ---------------------------------------------
// Стили, согласованные с общим тёмным оформлением дашборда
// ---------------------------------------------
const card = { background: '#21222d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '18px', padding: '22px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' };
const lbl = { color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.8px' };

const BRANCHES = ['Зеленая', 'Синяя', 'Красная'];

const branchColor = (branch) => {
  const b = (branch || '').toLowerCase();
  if (b.includes('зел')) return '#2de2a6';
  if (b.includes('син')) return '#2898ff';
  if (b.includes('красн')) return '#ff4d4d';
  return '#94a3b8';
};

// Статус сегмента -> стиль линии (пунктир + прозрачность)
const statusStyle = (status) => {
  const s = (status || '').toLowerCase();
  if (s.includes('освоено')) return { dashArray: null, opacity: 1, weight: 5 };
  if (s.includes('не достроено')) return { dashArray: '12 8', opacity: 0.95, weight: 5 };
  return { dashArray: '3 9', opacity: 0.85, weight: 4 }; // не построено
};

const toNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

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
  `}</style>
);

export function VolsMapTab({ volsRouteData = [], musVolsData = [], codVolsData = [] }) {
  const [visibleBranches, setVisibleBranches] = useState(new Set(BRANCHES));
  const [showMus, setShowMus] = useState(true);
  const [showCod, setShowCod] = useState(true);

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
          lengthKm: r["Длина_км"] || '',
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
        return {
          name: r["Название_МУС"] || '',
          branch: r["Ветка"] || '',
          type: r["Тип"] || '',
          region: r["Область"] || '',
          district: r["Район"] || '',
          lat, lon,
        };
      })
      .filter(Boolean)
      .filter(m => !m.branch || visibleBranches.has(m.branch.split('/')[0].trim()));
  }, [musVolsData, visibleBranches]);

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
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 20, height: 0, borderTop: '3px solid #6b7280' }} /> Освоено
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 20, height: 0, borderTop: '3px dashed #6b7280' }} /> Не достроено
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 20, height: 0, borderTop: '3px dotted #6b7280', opacity: 0.6 }} /> Не построено
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 10, height: 10, background: '#f5c518', transform: 'rotate(45deg)', display: 'inline-block' }} /> ЦОД
          </div>
        </div>
      </div>

      {/* Карта */}
      <div style={{ ...card, padding: 0, overflow: 'hidden', height: '640px' }}>
        <MapContainer
          center={kazakhstanCenter}
          zoom={5}
          style={{ width: '100%', height: '100%', background: '#1c1d26' }}
          scrollWheelZoom={true}
        >
          {/* Тёмная подложка CartoDB — лёгкие растровые тайлы, быстрая загрузка,
              осветлена через CSS-фильтр (className ниже), чтобы не была угольно-чёрной */}
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            className="vols-map-tiles-lighter"
          />

          {segments.map((s, i) => {
            const style = statusStyle(s.status);
            const color = branchColor(s.branch);
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
                {/* Цветная линия ветки поверх обводки */}
                <Polyline
                  positions={s.positions}
                  pathOptions={{
                    color,
                    weight: style.weight,
                    opacity: style.opacity,
                    dashArray: style.dashArray,
                    lineCap: 'round',
                  }}
                >
                  <LeafletTooltip sticky>
                    <div style={{ fontSize: 12 }}>
                      <b>{s.name}</b><br />
                      Ветка: {s.branch}<br />
                      Статус: {s.status}{s.pct !== null ? ` (${s.pct}%)` : ''}<br />
                      {s.lengthKm ? <>Длина: {s.lengthKm} км</> : null}
                    </div>
                  </LeafletTooltip>
                </Polyline>
              </React.Fragment>
            );
          })}

          {showMus && musPoints.map((m, i) => (
            <CircleMarker
              key={`mus-${i}`}
              center={[m.lat, m.lon]}
              radius={6}
              pathOptions={{
                color: '#0a0a0f',
                weight: 2.5,
                fillColor: branchColor(m.branch),
                fillOpacity: 1,
              }}
            >
              <LeafletTooltip sticky>
                <div style={{ fontSize: 12 }}>
                  <b>{m.name}</b><br />
                  {m.type ? <>Тип: {m.type}<br /></> : null}
                  {m.branch ? <>Ветка: {m.branch}<br /></> : null}
                  {m.region ? <>{m.region}{m.district ? `, ${m.district}` : ''}</> : null}
                </div>
              </LeafletTooltip>
            </CircleMarker>
          ))}

          {showCod && codPoints.map((c, i) => (
            <Marker key={`cod-${i}`} position={[c.lat, c.lon]} icon={codIcon}>
              <LeafletTooltip sticky>
                <div style={{ fontSize: 12 }}>
                  <b>{c.name}</b><br />
                  ЦОД (дата-центр)<br />
                  {c.region ? <>{c.region}{c.district ? `, ${c.district}` : ''}</> : null}
                </div>
              </LeafletTooltip>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
