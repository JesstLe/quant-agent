import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatPercent, formatRelativeTime } from '../../utils/formatters'

export function PortfolioSummary() {
  const { portfolio, riskMetrics, lastUpdate, isLoading } = useApp()

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
        No portfolio data available
      </div>
    )
  }

  const metrics = [
    {
      label: 'Total Value',
      value: formatCurrency(portfolio.totalValue, true),
      subValue: formatCurrency(portfolio.dayPnl),
      subLabel: 'Day P&L',
      isPositive: portfolio.dayPnl >= 0,
    },
    {
      label: 'Day Return',
      value: formatPercent(portfolio.dayPnlPercent),
      subValue: formatPercent(portfolio.weekPnlPercent),
      subLabel: 'Week',
      isPositive: portfolio.dayPnlPercent >= 0,
    },
    {
      label: 'Sharpe Ratio',
      value: portfolio.sharpeRatio.toFixed(2),
      subValue: `${portfolio.winRate.toFixed(1)}%`,
      subLabel: 'Win Rate',
      isPositive: portfolio.sharpeRatio >= 1,
    },
    {
      label: 'Max Drawdown',
      value: formatPercent(portfolio.maxDrawdown),
      subValue: riskMetrics ? `Risk: ${riskMetrics.overallRiskScore}/10` : 'Risk: --',
      subLabel: 'Risk Score',
      isPositive: portfolio.maxDrawdown >= -5,
      invertColors: true,
    },
  ]

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">Portfolio Overview</h2>
        {lastUpdate && (
          <span className="text-xs text-dark-muted">
            Updated {formatRelativeTime(lastUpdate)}
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
              <div className={`text-2xl font-bold ${metric.isPositive ? 'text-profit' : 'text-loss'}`}>
                {metric.value}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs">
                <span className="text-dark-muted">{metric.subLabel}:</span>
                <span className={metric.invertColors
                  ? (metric.isPositive ? 'text-profit' : 'text-loss')
                  : (parseFloat(metric.subValue.replace(/[^0-9.-]/g, '')) >= 0 ? 'text-profit' : 'text-loss')}>
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
                <span className="text-dark-muted">Invested: </span>
                <span className="text-dark-text font-medium">
                  {formatCurrency(portfolio.investedValue, true)}
                </span>
              </div>
              <div>
                <span className="text-dark-muted">Cash: </span>
                <span className="text-dark-text font-medium">
                  {formatCurrency(portfolio.cashBalance, true)}
                </span>
              </div>
              <div>
                <span className="text-dark-muted">Positions: </span>
                <span className="text-dark-text font-medium">{portfolio.positions.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-profit animate-pulse"></span>
              <span className="text-xs text-dark-muted">Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
