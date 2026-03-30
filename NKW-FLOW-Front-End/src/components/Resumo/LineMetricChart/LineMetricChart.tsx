// Libs
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, LabelList } from 'recharts';
// Css
import Styles from './LineMetricChart.module.css';

interface LineMetricChartProps {
  data: unknown[];
  dataKey: string;
  width?: number;
}

export default function LineMetricChart({
  data,
  dataKey,
  width = 400
}: LineMetricChartProps) {
  return (
    <ResponsiveContainer className={Styles.chartContainer} height="100%">
      <LineChart data={data} margin={{ top: 60, right: 50, left: 50, bottom: 5 }}>
        <XAxis
          dataKey="name"
          type="category"
          scale="point"          // coloca os pontos exatamente nas extremidades
          interval={0}
          axisLine={false}
          tickLine={false}
          dy={10}
          padding={{ left: 30, right: 30 }} // garante que use 100% da largura
        />

        <YAxis hide />
        <Line
          type="natural"
          dataKey={dataKey}
          stroke="#9ca3af"
          strokeWidth={3}
          dot={{ r: 6, stroke: '#9ca3af', strokeWidth: 2, fill: 'white' }}
          isAnimationActive={false}
        >
          <LabelList dataKey={dataKey} position="top" offset={15} className={Styles.chartLabelConnectionValue} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}