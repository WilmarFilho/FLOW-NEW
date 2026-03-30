// Libs
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
// Css
import Styles from './GaugeMetricChart.module.css';

interface GaugeMetricChartProps {
  filled: number;
  empty: number;
  valueText: string;
  labelText: string;
}

export default function GaugeMetricChart({
  filled,
  empty,
  valueText,
  labelText
}: GaugeMetricChartProps) {
  return (
    <div className={Styles.gaugeChartContainer}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[
              { name: 'preenchido', value: filled },
              { name: 'vazio', value: empty }
            ]}
            cx="50%"
            cy="100%"
            outerRadius="180%"
            innerRadius="125%"
            startAngle={200}
            endAngle={-20}
            dataKey="value"
            stroke="none"
          >
            <Cell className={Styles.gaugeFill} />
            <Cell className={Styles.gaugeBackground} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className={Styles.gaugeFooter}>
        <div className={Styles.gaugeValue}>{valueText}</div>
        <div className={Styles.gaugeLabel}>{labelText}</div>
      </div>
    </div>
  );
}