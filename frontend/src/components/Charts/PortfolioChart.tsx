import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useApp } from '../../hooks/useApp'
import type { HistoricalDataPoint, DailyHistoryPoint } from '../../types'
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters'
import { getDashboardCopy, getSignedFillColor, getSignedTextClass } from '../../utils/market'

const PIE_COLORS = ['#58A6FF', '#8B5CF6', '#3FB950', '#D29922', '#F85149', '#06B6D4', '#EC4899', '#84CC16']
const GRID_STROKE = '#21262D'
const TEXT_MUTED = '#8B949E'
const PROFIT = '#3FB950'
const INFO = '#58A6FF'

interface PortfolioChartProps {
  data?: HistoricalDataPoint[]
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ color?: string; name?: string; value?: number }>
  label?: string
}

function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-dark-border bg-dark-card/95 px-3 py-2 shadow-xl backdrop-blur">
      {label && (
        <div className="mb-2 text-xs font-medium text-dark-text">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-2 text-dark-muted">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color || INFO }}
              />
              {entry.name}
            </span>
            <span className="font-medium text-dark-text">
              {typeof entry.value === 'number' ? formatCurrency(entry.value) : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ title, message, height }: { title: string; message: string; height: string }) {
  return (
    <div className="bg-dark-card border border-dark-border rounded-lg p-6">
      <div className="text-sm font-semibold text-dark-text mb-4">{title}</div>
      <div className={`${height} flex items-center justify-center text-dark-muted`}>
        {message}
      </div>
    </div>
  )
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  const { historicalData, marketType } = useApp()
  const copy = getDashboardCopy(marketType)
  const chartData = (data || historicalData || []).map((point) => ({
    ...point,
    shortDate: formatDate(point.date, marketType),
  }))

  if (chartData.length === 0) {
    return (
      <EmptyState
        title={copy.portfolioPerformance}
        message={copy.noHistorical}
        height="h-[280px]"
      />
    )
  }

  const latestValue = chartData[chartData.length - 1]?.value ?? 0
  const firstValue = chartData[0]?.value ?? latestValue
  const totalReturn = firstValue ? ((latestValue - firstValue) / firstValue) * 100 : 0

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.portfolioPerformance}</h2>
        <div className="text-right">
          <div className="text-xs text-dark-muted">{copy.return30d}</div>
          <div className={`text-sm font-semibold ${getSignedTextClass(totalReturn, marketType)}`}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-dark-muted">{copy.currentEquity}</div>
            <div className="text-2xl font-semibold text-dark-text">
              {formatCurrency(latestValue, true, marketType)}
            </div>
          </div>
          <div className="text-xs text-dark-muted">
            {copy.benchmarkOverlay}
          </div>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={INFO} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={INFO} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="benchmarkFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PROFIT} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={PROFIT} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="shortDate"
                tick={{ fill: TEXT_MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: TEXT_MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={72}
                tickFormatter={(value) => formatCurrency(value, true, marketType)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="benchmark"
                name="Benchmark"
                stroke={PROFIT}
                strokeWidth={2}
                fill="url(#benchmarkFill)"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name="Portfolio"
                stroke={INFO}
                strokeWidth={2.5}
                fill="url(#portfolioValueFill)"
                dot={false}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

interface AllocationPieChartProps {
  data?: Array<{ name: string; value: number }>
}

export function AllocationPieChart({ data }: AllocationPieChartProps) {
  const { portfolio, marketType } = useApp()
  const copy = getDashboardCopy(marketType)
  const chartData = data || portfolio?.positions?.map((pos) => ({
    name: pos.symbol,
    value: pos.marketValue,
  })) || []

  if (chartData.length === 0) {
    return (
      <EmptyState
        title={copy.assetAllocation}
        message={copy.noAllocation}
        height="h-[220px]"
      />
    )
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-semibold text-dark-text">{copy.assetAllocation}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={92}
                paddingAngle={3}
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null
                  }
                  const item = payload[0]
                  const value = typeof item.value === 'number' ? item.value : 0
                  return (
                    <div className="rounded-lg border border-dark-border bg-dark-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
                      <div className="mb-1 font-medium text-dark-text">{item.name}</div>
                      <div className="text-dark-muted">
                        {formatCurrency(value, false, marketType)} ({((value / total) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div key={item.name} className="rounded-lg border border-dark-border bg-dark-hover/50 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                  />
                  <span className="text-sm font-medium text-dark-text">{item.name}</span>
                </div>
                <span className="text-sm text-dark-muted">
                  {((item.value / total) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 text-xs text-dark-muted">
                {formatCurrency(item.value, true, marketType)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface DailyPnlChartProps {
  data?: DailyHistoryPoint[]
}

export function DailyPnlChart({ data }: DailyPnlChartProps) {
  const { dailyHistory, marketType } = useApp()
  const copy = getDashboardCopy(marketType)
  const chartData = data || dailyHistory || []

  if (chartData.length === 0) {
    return (
      <EmptyState
        title={copy.dailyPnlChart}
        message={copy.noDailyPnl}
        height="h-[180px]"
      />
    )
  }

  const totalPnl = chartData.reduce((sum, item) => sum + item.pnl, 0)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.dailyPnlChart}</h2>
        <span className={`text-base font-bold ${getSignedTextClass(totalPnl, marketType)}`}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl, false, marketType)}
        </span>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between text-xs text-dark-muted">
          <span>{copy.intradayMovement}</span>
          <span>{chartData.length} {copy.points}</span>
        </div>
        <div className="h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: TEXT_MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: TEXT_MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={64}
                tickFormatter={(value) => formatCurrency(value, true, marketType)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) {
                    return null
                  }
                  const value = typeof payload[0].value === 'number' ? payload[0].value : 0
                  return (
                    <div className="rounded-lg border border-dark-border bg-dark-card/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
                      <div className="mb-1 font-medium text-dark-text">{label}</div>
                      <div className={getSignedTextClass(value, marketType)}>
                        {value >= 0 ? '+' : ''}{formatCurrency(value, false, marketType)}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`${entry.time}-${index}`} fill={getSignedFillColor(entry.pnl, marketType)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

interface VolumeChartProps {
  data?: Array<{ time: string; volume: number; price: number }>
}

export function VolumeChart({ data }: VolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Volume Profile"
        message="No volume data available"
        height="h-[140px]"
      />
    )
  }

  const maxVolume = Math.max(...data.map((item) => item.volume), 1)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-semibold text-dark-text">Volume Profile</h2>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={`${item.time}-${index}`} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 text-xs">
              <span className="text-dark-muted">{item.time}</span>
              <div className="h-2 overflow-hidden rounded-full bg-dark-border">
                <div
                  className="h-full rounded-full bg-info"
                  style={{ width: `${(item.volume / maxVolume) * 100}%` }}
                />
              </div>
              <span className="text-dark-text">{formatNumber(item.volume, true)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
