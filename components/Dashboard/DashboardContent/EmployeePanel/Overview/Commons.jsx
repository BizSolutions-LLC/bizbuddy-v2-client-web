// components/Dashboard/DashboardContent/Features/Overview/Commons.jsx
/* eslint-disable react-hooks/exhaustive-deps */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  LineChart,
  Line,
  Tooltip as RTooltip,
  Legend,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

const COLORS = ["#f97316", "#0ea5e9", "#84cc16", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#6366f1"];

// Enhanced Custom Tooltip with better styling
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl px-3 py-2.5 backdrop-blur-sm">
        {label && (
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 pb-1.5 border-b border-gray-100 dark:border-gray-800">
            {label}
          </p>
        )}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <div 
                  className="w-2 h-2 rounded-full shadow-sm" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {entry.name}:
                </span>
              </div>
              <span className="text-sm font-bold" style={{ color: entry.color }}>
                {entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Enhanced ChartCard with gradient accent and empty state support
export const ChartCard = ({ title, children, isEmpty = false }) => (
  <Card className="border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 overflow-hidden shadow-none hover:shadow-md group">
    <div className="h-1 w-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 group-hover:from-orange-600 group-hover:via-orange-500 group-hover:to-orange-600 transition-all duration-300" />
    <CardHeader className="py-3.5 px-4 bg-gradient-to-br from-gray-50/80 to-gray-100/40 dark:from-gray-900/40 dark:to-gray-900/20 backdrop-blur-sm">
      <CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
        {title}
        {isEmpty && (
          <span className="text-xs font-normal text-gray-500 dark:text-gray-500">
            (No data)
          </span>
        )}
      </CardTitle>
    </CardHeader>
    <CardContent className="h-72 p-4 bg-gradient-to-br from-white to-gray-50/30 dark:from-gray-950 dark:to-gray-900/30">
      {children}
    </CardContent>
  </Card>
);

// Enhanced PieSimple with better labels and animations
export const PieSimple = ({ data }) => {
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is significant (>5%)
    if (percent < 0.05) return null;

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        style={{ 
          fontSize: '12px',
          fontFamily: 'inherit',
          fontWeight: '600',
          textShadow: '0 1px 3px rgba(0,0,0,0.3)'
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer>
      <PieChart 
        margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
        style={{ fontFamily: 'inherit' }}
      >
        <defs>
          {COLORS.map((color, index) => (
            <linearGradient key={`gradient-${index}`} id={`pieGradient${index}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.8} />
            </linearGradient>
          ))}
        </defs>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={70}
          innerRadius={30}
          paddingAngle={3}
          label={renderLabel}
          labelLine={false}
          animationBegin={0}
          animationDuration={1000}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell 
              key={i} 
              fill={`url(#pieGradient${i % COLORS.length})`}
              strokeWidth={2}
              stroke="white"
              className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-md"
            />
          ))}
        </Pie>
        <RTooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
};

// Enhanced BarSimple with gradient bars and better styling
export const BarSimple = ({ data, x, y }) => (
  <ResponsiveContainer>
    <BarChart 
      data={data} 
      margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
          <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8} />
        </linearGradient>
        <filter id="shadow" height="130%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.2"/>
          </feComponentTransfer>
          <feMerge> 
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/> 
          </feMerge>
        </filter>
      </defs>
      <CartesianGrid 
        strokeDasharray="3 3" 
        vertical={false} 
        stroke="currentColor"
        opacity={0.08}
        className="stroke-gray-300 dark:stroke-gray-700"
      />
      <XAxis 
        dataKey={x} 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10} 
      />
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10}
        width={40}
      />
      <Bar 
        dataKey={y} 
        fill="url(#barGradient)"
        radius={[6, 6, 0, 0]} 
        maxBarSize={40}
        animationDuration={1200}
        animationEasing="ease-out"
        filter="url(#shadow)"
      />
      <RTooltip 
        content={<CustomTooltip />}
        cursor={{ fill: "rgba(249, 115, 22, 0.06)", radius: 4 }} 
      />
    </BarChart>
  </ResponsiveContainer>
);

// Enhanced LineSimple with gradient and glow effect
export const LineSimple = ({ data, x, y }) => (
  <ResponsiveContainer>
    <LineChart 
      data={data} 
      margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
          <stop offset="100%" stopColor="#fb923c" stopOpacity={1} />
        </linearGradient>
      </defs>
      <CartesianGrid 
        strokeDasharray="3 3" 
        opacity={0.08}
        className="stroke-gray-300 dark:stroke-gray-700"
      />
      <XAxis 
        dataKey={x} 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10} 
      />
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10}
        width={40}
      />
      <Line
        type="monotone"
        dataKey={y}
        stroke="url(#lineGradient)"
        strokeWidth={3}
        dot={{ 
          r: 4, 
          strokeWidth: 2.5, 
          fill: "#fff",
          stroke: "#f97316",
          filter: "url(#glow)"
        }}
        activeDot={{ 
          r: 6, 
          strokeWidth: 0, 
          fill: "#f97316",
          filter: "url(#glow)"
        }}
        animationDuration={1500}
        animationEasing="ease-in-out"
      />
      <RTooltip content={<CustomTooltip />} />
    </LineChart>
  </ResponsiveContainer>
);

// Enhanced GroupedBarSimple with gradients
export const GroupedBarSimple = ({ data, x, y1, y2, label1, label2 }) => (
  <ResponsiveContainer>
    <BarChart 
      data={data} 
      margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
          <stop offset="100%" stopColor="#fb923c" stopOpacity={0.85} />
        </linearGradient>
        <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.85} />
        </linearGradient>
      </defs>
      <CartesianGrid 
        strokeDasharray="3 3" 
        vertical={false} 
        opacity={0.08}
        className="stroke-gray-300 dark:stroke-gray-700"
      />
      <XAxis 
        dataKey={x} 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10} 
      />
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10}
        width={40}
      />
      <Bar 
        dataKey={y1} 
        name={label1} 
        fill="url(#barGradient1)"
        radius={[6, 6, 0, 0]} 
        maxBarSize={20}
        animationDuration={1200} 
      />
      <Bar 
        dataKey={y2} 
        name={label2} 
        fill="url(#barGradient2)"
        radius={[6, 6, 0, 0]} 
        maxBarSize={20}
        animationDuration={1200} 
      />
      <Legend 
        iconType="circle" 
        iconSize={10}
        wrapperStyle={{ 
          fontSize: '12px',
          fontFamily: 'inherit',
          fontWeight: 500,
          paddingTop: '15px'
        }}
      />
      <RTooltip 
        content={<CustomTooltip />} 
        cursor={{ fill: "rgba(0, 0, 0, 0.03)", radius: 4 }} 
      />
    </BarChart>
  </ResponsiveContainer>
);

// Enhanced StackedBarSimple with better colors
export const StackedBarSimple = ({ data, x, series }) => (
  <ResponsiveContainer>
    <BarChart 
      data={data} 
      margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        {series.map((s, i) => (
          <linearGradient key={`stackGradient${i}`} id={`stackGradient${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[i % COLORS.length]} stopOpacity={1} />
            <stop offset="100%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.85} />
          </linearGradient>
        ))}
      </defs>
      <CartesianGrid 
        strokeDasharray="3 3" 
        vertical={false} 
        opacity={0.08}
        className="stroke-gray-300 dark:stroke-gray-700"
      />
      <XAxis 
        dataKey={x} 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10} 
      />
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10}
        width={40}
      />
      {series.map((s, i) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          stackId="a"
          name={s.label}
          fill={`url(#stackGradient${i})`}
          radius={i === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
          animationDuration={1200}
        />
      ))}
      <Legend 
        iconType="circle" 
        iconSize={10}
        wrapperStyle={{ 
          fontSize: '12px',
          fontFamily: 'inherit',
          fontWeight: 500,
          paddingTop: '15px'
        }}
      />
      <RTooltip 
        content={<CustomTooltip />} 
        cursor={{ fill: "rgba(0, 0, 0, 0.03)", radius: 4 }} 
      />
    </BarChart>
  </ResponsiveContainer>
);

// Enhanced AreaSimple with better gradient
export const AreaSimple = ({ data, x, y }) => (
  <ResponsiveContainer>
    <AreaChart 
      data={data} 
      margin={{ top: 15, right: 30, left: 0, bottom: 5 }}
      style={{ fontFamily: 'inherit' }}
    >
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
          <stop offset="50%" stopColor="#f97316" stopOpacity={0.15} />
          <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
        </linearGradient>
        <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
          <stop offset="100%" stopColor="#fb923c" stopOpacity={1} />
        </linearGradient>
      </defs>
      <CartesianGrid 
        strokeDasharray="3 3" 
        opacity={0.08}
        className="stroke-gray-300 dark:stroke-gray-700"
      />
      <XAxis 
        dataKey={x} 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10} 
      />
      <YAxis 
        axisLine={false} 
        tickLine={false} 
        tick={{ 
          fontSize: 11,
          fontFamily: 'inherit',
          fill: 'currentColor',
          fontWeight: 500
        }}
        className="text-gray-600 dark:text-gray-400"
        tickMargin={10}
        width={40}
      />
      <Area 
        type="monotone" 
        dataKey={y} 
        stroke="url(#strokeGradient)"
        fill="url(#areaGradient)" 
        strokeWidth={2.5} 
        animationDuration={1500}
        dot={{ 
          r: 3, 
          strokeWidth: 2, 
          fill: "#fff",
          stroke: "#f97316"
        }}
        activeDot={{ 
          r: 5, 
          strokeWidth: 0, 
          fill: "#f97316"
        }}
      />
      <RTooltip content={<CustomTooltip />} />
    </AreaChart>
  </ResponsiveContainer>
);