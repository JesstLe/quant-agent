import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatRelativeTime } from '../../utils/formatters'
import { getDashboardCopy } from '../../utils/market'

function StatusCard({
  label,
  value,
  accent = 'text-dark-text',
  secondary,
}: {
  label: string
  value: string
  accent?: string
  secondary?: string
}) {
  return (
    <div className="flex h-full min-h-[128px] flex-col rounded-lg border border-dark-border bg-dark-hover/70 p-4">
      <div className="text-[11px] uppercase tracking-[0.16em] text-dark-muted">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${accent}`}>{value}</div>
      {secondary && <div className="mt-auto pt-2 text-xs text-dark-muted">{secondary}</div>}
    </div>
  )
}

export function PortfolioSummary() {
  const { portfolio, lastUpdate, isLoading, marketType, strategyType, selectedSymbol } = useApp()
  const copy = getDashboardCopy(marketType)

  if (isLoading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 animate-pulse">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-dark-hover rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  const totalValue = portfolio?.totalValue ?? 0
  const cashBalance = portfolio?.cashBalance ?? 0
  const investedValue = portfolio?.investedValue ?? 0
  const positionsCount = portfolio?.positions.length ?? 0
  const marketLabel = marketType === 'A' ? 'A股' : 'US Equities'
  const dataSourceLabel = marketType === 'A' ? 'Yahoo Finance + Google 新闻' : 'Yahoo Finance + Google News'
  const executionLabel = copy.paperTrading
  const strategyLabel = strategyType === 'fortress'
    ? (marketType === 'A' ? '堡垒策略' : 'Fortress')
    : strategyType === 'vwap_pullback'
      ? 'VWAP Pullback'
      : 'ORB'
  const refreshLabel = lastUpdate ? formatRelativeTime(lastUpdate, marketType) : '--'

  return (
    <div className="flex h-full flex-col bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-dark-text">{copy.terminalStatus}</h2>
          <div className="mt-1 text-xs text-dark-muted">{copy.accountStatus}</div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-dark-border bg-dark-hover px-3 py-1">
          <span className="h-2 w-2 rounded-full bg-profit animate-pulse" />
          <span className="text-xs text-dark-muted">{copy.liveConnection}</span>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatusCard
            label={copy.currentMarket}
            value={marketLabel}
            accent={marketType === 'A' ? 'text-info' : 'text-purple-400'}
          />
          <StatusCard
            label={copy.currentSymbol}
            value={selectedSymbol ?? '--'}
            secondary={copy.selectedSymbol}
          />
          <StatusCard
            label={copy.dataSource}
            value={dataSourceLabel}
          />
          <StatusCard
            label={copy.executionMode}
            value={executionLabel}
            secondary={`${copy.strategyLabel}: ${strategyLabel}`}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatusCard
            label={copy.totalValue}
            value={formatCurrency(totalValue, true, marketType)}
            accent="text-profit"
          />
          <StatusCard
            label={copy.cash}
            value={formatCurrency(cashBalance, true, marketType)}
          />
          <StatusCard
            label={copy.invested}
            value={formatCurrency(investedValue, true, marketType)}
          />
          <StatusCard
            label={copy.positions}
            value={String(positionsCount)}
            secondary={`${copy.lastRefresh}: ${refreshLabel}`}
          />
        </div>
      </div>
    </div>
  )
}
