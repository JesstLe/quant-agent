import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatPercent, formatRelativeTime } from '../../utils/formatters'
import { getDashboardCopy, getSignedTextClass } from '../../utils/market'

export function PortfolioSummary() {
  const { portfolio, riskMetrics, lastUpdate, isLoading, marketType } = useApp()
  const copy = getDashboardCopy(marketType)

  if (isLoading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-dark-hover rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-dark-muted">
        {copy.noPortfolio}
      </div>
    )
  }

  const metrics = [
    {
      label: copy.totalValue,
      value: formatCurrency(portfolio.totalValue, true, marketType),
      subValue: formatCurrency(portfolio.dayPnl, false, marketType),
      subLabel: copy.dayPnl,
      signalValue: portfolio.dayPnl,
    },
    {
      label: copy.dayReturn,
      value: formatPercent(portfolio.dayPnlPercent),
      subValue: formatPercent(portfolio.weekPnlPercent),
      subLabel: copy.week,
      signalValue: portfolio.dayPnlPercent,
    },
    {
      label: copy.sharpeRatio,
      value: portfolio.sharpeRatio.toFixed(2),
      subValue: `${portfolio.winRate.toFixed(1)}%`,
      subLabel: copy.winRate,
      signalValue: portfolio.sharpeRatio,
      isPositive: portfolio.sharpeRatio >= 1,
    },
    {
      label: copy.maxDrawdown,
      value: formatPercent(portfolio.maxDrawdown),
      subValue: riskMetrics ? `${copy.riskScore}: ${riskMetrics.overallRiskScore}/10` : `${copy.riskScore}: --`,
      subLabel: copy.riskScore,
      signalValue: portfolio.maxDrawdown,
      isPositive: portfolio.maxDrawdown >= -5,
      invertColors: true,
    },
  ]

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.portfolioOverview}</h2>
        {lastUpdate && (
          <span className="text-xs text-dark-muted">
            {copy.updated} {formatRelativeTime(lastUpdate, marketType)}
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-dark-hover rounded-lg p-4">
              <div className="text-xs text-dark-muted uppercase tracking-wider mb-2">
                {metric.label}
              </div>
              <div className={`text-2xl font-bold ${metric.invertColors
                ? (metric.isPositive ? 'text-profit' : 'text-loss')
                : getSignedTextClass(metric.signalValue ?? 0, marketType)}`}>
                {metric.value}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-dark-muted">{metric.subLabel}:</span>
                <span className={metric.invertColors
                  ? (metric.isPositive ? 'text-profit' : 'text-loss')
                  : getSignedTextClass(parseFloat(metric.subValue.replace(/[^0-9.-]/g, '')) || 0, marketType)}>
                  {metric.subValue}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Position Summary */}
        <div className="mt-4 pt-4 border-t border-dark-border">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-dark-muted">{copy.invested}: </span>
                <span className="text-dark-text font-medium">
                  {formatCurrency(portfolio.investedValue, true, marketType)}
                </span>
              </div>
              <div>
                <span className="text-dark-muted">{copy.cash}: </span>
                <span className="text-dark-text font-medium">
                  {formatCurrency(portfolio.cashBalance, true, marketType)}
                </span>
              </div>
              <div>
                <span className="text-dark-muted">{copy.positions}: </span>
                <span className="text-dark-text font-medium">{portfolio.positions.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit animate-pulse"></span>
              <span className="text-xs text-dark-muted">{copy.live}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
