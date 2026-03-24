import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters'
import { getDashboardCopy, getRangeTextClasses, getSignedTextClass } from '../../utils/market'

export function MarketsTable() {
  const {
    markets,
    isLoading,
    marketType,
    selectedSymbol,
    setSelectedSymbol,
    isWatchlistSymbol,
    toggleWatchlistSymbol,
  } = useApp()
  const copy = getDashboardCopy(marketType)
  const rangeClasses = getRangeTextClasses(marketType)

  if (isLoading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 animate-pulse">
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-dark-hover rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-dark-muted">
        {copy.noMarketData}
      </div>
    )
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.marketOverview}</h2>
        <span className="text-xs text-dark-muted">
          {new Date().toLocaleDateString(marketType === 'A' ? 'zh-CN' : 'en-US', {
            weekday: 'short',
            month: marketType === 'A' ? 'numeric' : 'short',
            day: 'numeric',
          })}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-dark-muted uppercase tracking-wider border-b border-dark-border">
              <th className="px-3 py-3 text-center">★</th>
              <th className="px-4 py-3 text-left">{copy.symbol}</th>
              <th className="px-4 py-3 text-right">{copy.price}</th>
              <th className="px-4 py-3 text-right">{copy.change}</th>
              <th className="px-4 py-3 text-right">{copy.volume}</th>
              <th className="px-4 py-3 text-right">{copy.intradayRange}</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market) => (
              <tr
                key={market.symbol}
                onClick={() => setSelectedSymbol(market.symbol)}
                className={`border-b border-dark-border transition-colors cursor-pointer ${
                  selectedSymbol === market.symbol ? 'bg-info/5' : 'hover:bg-dark-hover'
                }`}
              >
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    aria-label={isWatchlistSymbol(market.symbol) ? copy.removeFromWatchlist : copy.addToWatchlist}
                    onClick={(event) => {
                      event.stopPropagation()
                      void toggleWatchlistSymbol(market.symbol)
                    }}
                    className={`text-lg transition-colors ${
                      isWatchlistSymbol(market.symbol)
                        ? 'text-warning'
                        : 'text-dark-muted hover:text-warning'
                    }`}
                  >
                    {isWatchlistSymbol(market.symbol) ? '★' : '☆'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-dark-hover flex items-center justify-center text-xs font-bold text-dark-text">
                      {market.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-medium text-dark-text">{market.symbol}</div>
                      <div className="text-xs text-dark-muted">{market.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-medium text-dark-text">{formatCurrency(market.price, false, marketType)}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={getSignedTextClass(market.changePercent, marketType)}>
                    <div className="font-medium">
                      {market.change >= 0 ? '+' : ''}{formatCurrency(market.change, false, marketType)}
                    </div>
                    <div className="text-xs">
                      {formatPercent(market.changePercent)}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-dark-muted">
                  {formatNumber(market.volume, true, marketType)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="text-xs text-dark-muted">
                    <span className={rangeClasses.low}>{formatCurrency(market.low24h, false, marketType)}</span>
                    <span className="mx-1">-</span>
                    <span className={rangeClasses.high}>{formatCurrency(market.high24h, false, marketType)}</span>
                  </div>
                  <div className="w-full h-1 bg-dark-border rounded-full mt-1">
                    <div
                      className="h-full bg-info rounded-full"
                      style={{
                        width: `${((market.price - market.low24h) / (market.high24h - market.low24h)) * 100}%`
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
