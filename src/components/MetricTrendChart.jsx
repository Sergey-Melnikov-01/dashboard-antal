import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { card, lbl } from '../styles/theme';

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
          <Tooltip contentStyle={{ background: '#0f1b15', border: '1px solid #1d2d24', fontSize: 12 }} />

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
