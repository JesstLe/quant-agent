import { FormEvent, useMemo, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { formatRelativeTime } from '../../utils/formatters'
import { getDashboardCopy, getSignedTextClass } from '../../utils/market'

export function WatchlistManagerPanel() {
  const {
    marketType,
    watchlist,
    markets,
    addWatchlistSymbol,
    toggleWatchlistSymbol,
    selectedSymbol,
    setSelectedSymbol,
  } = useApp()
  const copy = getDashboardCopy(marketType)
  const [input, setInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const suggestions = useMemo(
    () => markets.map((market) => market.symbol),
    [markets],
  )

  const watchlistMarkets = useMemo(
    () => watchlist
      .map((item) => ({
        item,
        market: markets.find((market) => market.symbol === item.symbol),
      })),
    [markets, watchlist],
  )

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const normalized = input.trim()
    if (!normalized) {
      return
    }
    setIsSubmitting(true)
    try {
      await addWatchlistSymbol(normalized)
      setInput('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border border-dark-border bg-dark-card">
      <div className="border-b border-dark-border px-4 py-3">
        <h2 className="text-sm font-semibold text-dark-text">{copy.watchlistManager}</h2>
        <div className="mt-1 text-xs text-dark-muted">{copy.watchlistManagerDesc}</div>
      </div>

      <div className="space-y-4 p-4">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
          <label className="block text-xs uppercase tracking-[0.14em] text-dark-muted">
            {copy.watchlistInput}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              list={`watchlist-manager-suggestions-${marketType}`}
              placeholder={copy.watchlistInputHint}
              className="min-w-0 flex-1 rounded-lg border border-dark-border bg-dark-hover px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-primary"
            />
            <button
              type="submit"
              disabled={isSubmitting || !input.trim()}
              className="rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? copy.working : copy.watchlistAdd}
            </button>
          </div>
          <datalist id={`watchlist-manager-suggestions-${marketType}`}>
            {suggestions.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </form>

        {watchlistMarkets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-dark-border px-4 py-6 text-center text-sm text-dark-muted">
            {copy.noWatchlist}
          </div>
        ) : (
          <div className="space-y-2">
            {watchlistMarkets.map(({ item, market }) => (
              <div
                key={item.symbol}
                className={`rounded-lg border px-3 py-3 transition-colors ${
                  selectedSymbol === item.symbol
                    ? 'border-brand-primary/40 bg-brand-primary/10'
                    : 'border-dark-border bg-dark-hover/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedSymbol(item.symbol)}
                    className="min-w-0 text-left"
                  >
                    <div className="text-sm font-semibold text-dark-text">{item.symbol}</div>
                    <div className="mt-1 text-xs text-dark-muted">{item.name || market?.name || item.symbol}</div>
                    <div className="mt-2 text-xs text-dark-muted">
                      {copy.updated}: {formatRelativeTime(item.addedAt, marketType)}
                    </div>
                  </button>
                  <div className="text-right">
                    {market ? (
                      <>
                        <div className="text-sm font-medium text-dark-text">{market.price.toFixed(2)}</div>
                        <div className={`mt-1 text-xs ${getSignedTextClass(market.changePercent, marketType)}`}>
                          {market.changePercent >= 0 ? '+' : ''}{market.changePercent.toFixed(2)}%
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-dark-muted">{copy.noMarketData}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleWatchlistSymbol(item.symbol)}
                      className="mt-3 rounded-md border border-dark-border px-2.5 py-1 text-xs text-dark-muted transition-colors hover:border-loss/30 hover:bg-loss/10 hover:text-loss"
                    >
                      {copy.removeFromWatchlist}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
