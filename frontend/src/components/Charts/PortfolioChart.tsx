import { useApp } from '../../hooks/useApp'
import type { HistoricalDataPoint, DailyHistoryPoint } from '../../types'
import { formatCurrency, formatNumber } from '../../utils/formatters'

const PIE_COLORS = ['#58A6FF', '#8B5CF6', '#3FB950', '#D29922', '#F85149', '#06B6D4', '#EC4899', '#84CC16']

interface PortfolioChartProps {
  data?: HistoricalDataPoint[]
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  const { historicalData } = useApp()
  const chartData = data || historicalData || []

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="text-sm font-semibold text-dark-text mb-4">Portfolio Performance</div>
        <div className="h-[280px] flex items-center justify-center text-dark-muted">
          No historical data available
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-semibold text-dark-text">Portfolio Performance</h2>
      </div>
      <div className="p-4">
        <div className="h-[280px]">
          <div className="text-center text-dark-muted text-sm">
            Chart requires recharts library
          </div>
        </div>
      </div>
    </div>
  )
}

interface AllocationPieChartProps {
  data?: Array<{ name: string; value: number }>
}

export function AllocationPieChart({ data }: AllocationPieChartProps) {
  const { portfolio } = useApp()
  const chartData = data || portfolio?.positions?.map(pos => ({
    name: pos.symbol,
    value: pos.marketValue,
  })) || []

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="text-sm font-semibold text-dark-text mb-4">Asset Allocation</div>
        <div className="h-[220px] flex items-center justify-center text-dark-muted">
          No positions to display
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-semibold text-dark-text">Asset Allocation</h2>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {chartData.map((item, index) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="text-sm text-dark-text">{item.name}</span>
              </div>
              <span className="text-sm text-dark-muted">{formatCurrency(item.value)}</span>
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
  const { dailyHistory } = useApp()
  const chartData = data || dailyHistory || []

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="text-sm font-semibold text-dark-text mb-4">Daily P&L</div>
        <div className="h-[180px] flex items-center justify-center text-dark-muted">
          No P&L data available
        </div>
      </div>
    )
  }

  const totalPnl = chartData.reduce((sum, d) => sum + d.pnl, 0)

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">Daily P&L</h2>
        <span className={`text-base font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
          {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
        </span>
      </div>
      <div className="p-4">
        <div className="space-y-1 max-h-[180px] overflow-y-auto">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-xs py-1">
              <span className="text-dark-muted">{item.time}</span>
              <span className={item.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)}
              </span>
            </div>
          ))}
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
      <div className="bg-dark-card border border-dark-border rounded-lg p-6">
        <div className="text-sm font-semibold text-dark-text mb-4">Volume Profile</div>
        <div className="h-[140px] flex items-center justify-center text-dark-muted">
          No volume data available
        </div>
      </div>
    )
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border">
        <h2 className="text-sm font-semibold text-dark-text">Volume Profile</h2>
      </div>
      <div className="p-4">
        <div className="space-y-1 max-h-[140px] overflow-y-auto">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-xs py-1">
              <span className="text-dark-muted">{item.time}</span>
              <span className="text-dark-text">{formatNumber(item.volume)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
