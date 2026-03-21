import React from 'react'
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, ComposedChart, Bar, XArea, YArea, BarChart, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { useApp } from '../hooks/useApp'
import { formatCurrency, formatPercent } from '../utils/formatters'

// Color palette
const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B9818',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#06B6D4',
  neutral: '#64748B',
}

interface PortfolioChartProps {
  data?: Array<{ date: string; value: number; benchmark?: number }>
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  const { portfolio } = useApp()

  // Use provided data or fallback to portfolio historical data
  const chartData = data || portfolio?.historicalData || []

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Performance</h3>
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          No historical data available
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorBenchmark" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.neutral} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={COLORS.neutral} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS.primary}
            fillOpacity={1}
            fill="url(#colorValue)"
            name="Portfolio"
          />
          {chartData[0]?.benchmark !== undefined && (
            <Area
              type="monotone"
              dataKey="benchmark"
              stroke={COLORS.neutral}
              strokeDasharray="5 5"
              fillOpacity={1}
              fill="url(#colorBenchmark)"
              name="Benchmark"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface AllocationPieChartProps {
  data?: Array<{ name: string; value: number; color?: string }>
}

const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#10B9818', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#84CC16']

export function AllocationPieChart({ data }: AllocationPieChartProps) {
  const { portfolio } = useApp()

  // Use provided data or fallback to positions
  const chartData = data || portfolio?.positions?.map(pos => ({
    name: pos.symbol,
    value: pos.marketValue,
  })) || []

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Allocation</h3>
        <div className="h-[250px] flex items-center justify-center text-gray-500">
          No positions to display
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Asset Allocation</h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface DailyPnlChartProps {
  data?: Array<{ time: string; pnl: number }>
}

export function DailyPnlChart({ data }: DailyPnlChartProps) {
  const { portfolio } = useApp()

  // Use provided data or fallback to daily history
  const chartData = data || portfolio?.dailyHistory || []

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily P&L</h3>
        <div className="h-[200px] flex items-center justify-center text-gray-500">
          No P&L data available
        </div>
      </div>
    )
  }

  const totalPnl = chartData.reduce((sum, d) => sum + d.pnl, 0)

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Daily P&L</h3>
        <span className={`text-lg font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 10 }} stroke="#9CA3AF" tickFormatter={(value) => `$${value}`} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value: number) => [formatCurrency(value), 'P&L']}
          />
          <Bar
            dataKey="pnl"
            fill={(entry: { pnl: number }) => entry.pnl >= 0 ? COLORS.success : COLORS.danger}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface VolumeChartProps {
  data?: Array<{ time: string; volume: number; price: number }>
}

export function VolumeChart({ data }: VolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume Profile</h3>
        <div className="h-[150px] flex items-center justify-center text-gray-500">
          No volume data available
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Volume Profile</h3>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data}>
          <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
          <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#9CA3AF" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: 'none',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
          />
          <Bar yAxisId="left" dataKey="volume" fill={COLORS.info} opacity={0.6} name="Volume" />
          <Line yAxisId="right" type="monotone" dataKey="price" stroke={COLORS.primary} strokeWidth={2} name="Price" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
