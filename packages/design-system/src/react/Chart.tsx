'use client';

import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const GRID_COLOR = 'rgba(203, 195, 215, 0.12)';
const AXIS_COLOR = '#958ea0';

type Point = Record<string, number | string>;

/** Tiny inline trend line — no axes, no grid, just shape + an emphasized endpoint. For table cells and stat-card corners. */
export function Sparkline({
  data,
  dataKey,
  color = 'var(--color-secondary)',
  height = 40,
  width = 120,
}: {
  data: Point[];
  dataKey: string;
  color?: string;
  height?: number;
  width?: number;
}) {
  if (!data || data.length === 0) return null;
  const last = data[data.length - 1];
  return (
    <div style={{ width, height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#spark-${dataKey})`}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) =>
              props.index === data.length - 1 ? (
                <circle key="endpoint" cx={props.cx} cy={props.cy} r={2.5} fill={color} />
              ) : (
                <g key={`dot-${props.index}`} />
              )
            }
          />
        </AreaChart>
      </ResponsiveContainer>
      <span className="sr-only">{String(last[dataKey])}</span>
    </div>
  );
}

/** Full trend chart for dashboards — faint grid, tabular tooltip, one or more series. */
export function TrendChart({
  data,
  series,
  height = 240,
  xKey = 'label',
}: {
  data: Point[];
  series: { dataKey: string; color: string; label: string }[];
  height?: number;
  xKey?: string;
}) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID_COLOR} vertical={false} />
          <XAxis
            dataKey={xKey}
            stroke={AXIS_COLOR}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            axisLine={{ stroke: GRID_COLOR }}
            tickLine={false}
          />
          <YAxis
            stroke={AXIS_COLOR}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: '#211e27',
              border: '1px solid rgba(73,68,84,0.4)',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: '#cbc3d7' }}
            itemStyle={{ fontVariantNumeric: 'tabular-nums' }}
          />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
