// Libs
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
// Css
import Styles from './BarMetricChart.module.css';

interface BarMetricChartProps {
  data: unknown[];
  dataKey: string;
  vertical?: boolean;
  barSize?: number;
  height?: number;
  barClassName?: string;
}

export default function BarMetricChart({
  data,
  dataKey,
  vertical = false,
  barSize = 60,
  height = 150,
}: BarMetricChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={vertical ? 'vertical' : 'horizontal'}
        barSize={barSize}
        margin={vertical ? { top: 0, right: 20, left: 0, bottom: 0 } : undefined}
      >
        {vertical ? (
          <>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
          </>
        ) : (
          <XAxis dataKey="name" axisLine={false} tickLine={false} />
        )}
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: 8, border: 'none' }} />
        <Bar dataKey={dataKey} className={Styles.chartBarPrimary} radius={[8, 8, 0, 0]}>
          {vertical && (
            <>
              <LabelList dataKey="name" position="insideLeft" offset={12} className={Styles.chartLabelAttendantName} />
              <LabelList dataKey={dataKey} position="right" offset={8} className={Styles.chartLabelChatCount} />
            </>
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}