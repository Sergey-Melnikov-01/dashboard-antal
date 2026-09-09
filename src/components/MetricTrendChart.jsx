import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { card, lbl } from '../styles/theme';

// Кастомный тултип — тот же стиль, что и на графике "Динамика выполнения плана" (вкладка СМР)
// и на карте (HoverTooltip): тёмный фон, скругления, тень. Подписи «План»/«Факт» вместо dataKey.
const TrendChartTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload || !payload.length) return null;
  const seriesLabels = { plan: 'План', fact: 'Факт' };
  const seriesColors = { plan: '#2898ff', fact: '#2de2a6' };
  return (
    <div style={{
      background: '#0f1724',
      color: '#e2e8f0',
      padding: '8px 10px',
      borderRadius: 8,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
      fontSize: 12,
    }}>
      <div style={{ marginBottom: 4, color: '#9ca3af' }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: seriesColors[entry.dataKey] || entry.color, fontWeight: 600 }}>
          {seriesLabels[entry.dataKey] || entry.name}: {Number(entry.value).toLocaleString('ru-RU')}{unit ? ` ${unit}` : ''}
        </div>
      ))}
    </div>
  );
};

// Графики динамики план/факт по датам для вкладки «Метрики» (Кабель/Труба/Засыпка/ГНБ).
// Визуально повторяет график "Динамика выполнения плана" со вкладки СМР.
export const MetricTrendChart = ({ title, data, unit }) => {
  return (
    <div style={{ ...card, marginBottom: '12px' }}>
      <div style={lbl}>{title} — динамика по датам{unit ? ` (${unit})` : ''}</div>
      <ResponsiveContainer width="100%" height={252}>
        <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1d2d24" vertical={false} />
          <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tick={{ fill: '#9ca3af' }} />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip content={<TrendChartTooltip unit={unit} />} cursor={{ stroke: '#2d3748', strokeWidth: 1 }} />

          <Line
            type="monotone"
            dataKey="plan"
            stroke="#2898ff"
            strokeWidth={2}
            dot={{ r: 4, fill: '#1c1d26', stroke: '#2898ff', strokeWidth: 2 }}
          />
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
  );
};
