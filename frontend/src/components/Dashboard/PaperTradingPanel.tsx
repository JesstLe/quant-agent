import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatNumber, formatRelativeTime } from '../../utils/formatters'
import { getDashboardCopy, getSignedTextClass } from '../../utils/market'

function Metric({
  label,
  value,
  accent = 'text-dark-text',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex h-full min-h-[110px] flex-col rounded-lg border border-dark-border bg-dark-hover/60 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-dark-muted">{label}</div>
      <div className={`mt-auto pt-2 text-lg font-semibold ${accent}`}>{value}</div>
    </div>
  )
}

export function PaperTradingPanel() {
  const {
    paperAccount,
    marketType,
    strategyType,
    selectedSymbol,
    markets,
    setAutoTradingEnabled,
    resetPaperAccount,
    updatePaperCapital,
    placeManualPaperOrder,
    isLoading,
  } = useApp()
  const copy = getDashboardCopy(marketType)
  const [isWorking, setIsWorking] = useState(false)
  const [capitalDraft, setCapitalDraft] = useState('')
  const [quantityUnit, setQuantityUnit] = useState<'SHARE' | 'LOT'>(marketType === 'A' ? 'LOT' : 'SHARE')
  const [liveQuotePrice, setLiveQuotePrice] = useState(0)
  const quoteRequestIdRef = useRef(0)
  const [orderDraft, setOrderDraft] = useState({
    symbol: selectedSymbol ?? '',
    side: 'BUY' as 'BUY' | 'SELL',
    quantity: '',
    price: '',
    stopLossPct: '5',
    targetPct: '10',
  })

  const selectedMarket = markets.find((market) => market.symbol === orderDraft.symbol)
  const livePrice = liveQuotePrice || selectedMarket?.price || markets.find((market) => market.symbol === selectedSymbol)?.price || 0
  const effectivePrice = Number(orderDraft.price || livePrice || 0)
  const stopLossPct = Number(orderDraft.stopLossPct || 0)
  const targetPct = Number(orderDraft.targetPct || 0)
  const quantityValue = Number(orderDraft.quantity || 0)
  const quantityInShares = quantityUnit === 'LOT' ? quantityValue * 100 : quantityValue
  const derivedStopLoss = effectivePrice > 0
    ? orderDraft.side === 'BUY'
      ? effectivePrice * (1 - stopLossPct / 100)
      : effectivePrice * (1 + stopLossPct / 100)
    : 0
  const derivedTargetPrice = effectivePrice > 0
    ? orderDraft.side === 'BUY'
      ? effectivePrice * (1 + targetPct / 100)
      : effectivePrice * (1 - targetPct / 100)
    : 0

  useEffect(() => {
    if (selectedSymbol) {
      setOrderDraft((current) => ({ ...current, symbol: selectedSymbol, price: '' }))
    }
  }, [selectedSymbol])

  useEffect(() => {
    setQuantityUnit(marketType === 'A' ? 'LOT' : 'SHARE')
    setOrderDraft((current) => ({
      ...current,
      quantity: current.quantity || (marketType === 'A' ? '1' : '10'),
    }))
  }, [marketType])

  useEffect(() => {
    if (!orderDraft.symbol) {
      setLiveQuotePrice(0)
      return
    }

    const requestId = ++quoteRequestIdRef.current
    const controller = new AbortController()

    void (async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/chart?market=${marketType}&strategy=${strategyType}&symbol=${encodeURIComponent(orderDraft.symbol)}&interval=1d`,
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Chart API Error: ${response.statusText}`)
        }
        const payload = await response.json() as { quote?: { price?: number } }
        if (requestId !== quoteRequestIdRef.current) {
          return
        }
        const nextPrice = Number(payload.quote?.price || 0)
        setLiveQuotePrice(nextPrice)
        if (nextPrice > 0) {
          setOrderDraft((current) => (
            current.symbol === orderDraft.symbol
              ? { ...current, price: nextPrice.toFixed(2) }
              : current
          ))
        }
      } catch {
        if (requestId === quoteRequestIdRef.current) {
          const fallbackPrice = selectedMarket?.price ?? markets.find((market) => market.symbol === selectedSymbol)?.price ?? 0
          setLiveQuotePrice(fallbackPrice)
          if (fallbackPrice > 0) {
            setOrderDraft((current) => (
              current.symbol === orderDraft.symbol
                ? { ...current, price: fallbackPrice.toFixed(2) }
                : current
            ))
          }
        }
      }
    })()

    return () => controller.abort()
  }, [marketType, markets, orderDraft.symbol, selectedMarket?.price, selectedSymbol, strategyType])

  const handleToggle = async () => {
    if (!paperAccount) return
    setIsWorking(true)
    try {
      await setAutoTradingEnabled(!paperAccount.autoTradingEnabled)
    } finally {
      setIsWorking(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm(copy.paperResetConfirm)) {
      return
    }
    setIsWorking(true)
    try {
      await resetPaperAccount()
    } finally {
      setIsWorking(false)
    }
  }

  const handleCapitalSave = async () => {
    const nextCapital = Number(capitalDraft)
    if (!Number.isFinite(nextCapital) || nextCapital <= 0) {
      return
    }
    setIsWorking(true)
    try {
      await updatePaperCapital(nextCapital)
      setCapitalDraft('')
    } finally {
      setIsWorking(false)
    }
  }

  const handlePlaceOrder = async () => {
    const quantity = quantityInShares
    const price = effectivePrice
    const stopLoss = derivedStopLoss > 0 ? Number(derivedStopLoss.toFixed(2)) : undefined
    const targetPrice = derivedTargetPrice > 0 ? Number(derivedTargetPrice.toFixed(2)) : undefined
    if (!orderDraft.symbol.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price <= 0) {
      return
    }
    setIsWorking(true)
    try {
      await placeManualPaperOrder({
        symbol: orderDraft.symbol.trim(),
        side: orderDraft.side,
        quantity,
        price,
        stopLoss,
        targetPrice,
      })
    } finally {
      setIsWorking(false)
    }
  }

  const adjustPercent = (field: 'stopLossPct' | 'targetPct', delta: number) => {
    setOrderDraft((current) => {
      const next = Math.max(0.1, Number(current[field] || 0) + delta)
      return { ...current, [field]: next.toFixed(1) }
    })
  }

  const strategyLabel = strategyType === 'fortress'
    ? (marketType === 'A' ? '堡垒策略' : 'Fortress')
    : strategyType === 'vwap_pullback'
      ? 'VWAP Pullback'
      : 'ORB'

  return (
    <div className="flex h-full flex-col rounded-lg border border-dark-border bg-dark-card">
      <div className="flex items-center justify-between border-b border-dark-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-dark-text">{copy.paperPanel}</h2>
          <div className="mt-1 text-xs text-dark-muted">{copy.paperPanelDesc}</div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] ${
          paperAccount?.autoTradingEnabled
            ? 'border-profit/30 bg-profit/10 text-profit'
            : 'border-dark-border bg-dark-hover text-dark-muted'
        }`}>
          {paperAccount?.autoTradingEnabled ? copy.paperAutoOn : copy.paperAutoOff}
        </span>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric label={copy.executionMode} value={copy.paperTrading} accent="text-info" />
          <Metric label={copy.strategyLabel} value={strategyLabel} accent="text-brand-primary" />
          <Metric label={copy.totalValue} value={formatCurrency(paperAccount?.equity ?? 0, true, marketType)} />
          <Metric label={copy.paperBuyingPower} value={formatCurrency(paperAccount?.buyingPower ?? 0, true, marketType)} />
          <Metric label={copy.paperPendingSignals} value={String(paperAccount?.pendingSignals ?? 0)} />
          <Metric label={copy.paperExecutedTrades} value={String(paperAccount?.executedTrades ?? 0)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            label={copy.dayPnl}
            value={formatCurrency(paperAccount?.dayPnl ?? 0, false, marketType)}
            accent={getSignedTextClass(paperAccount?.dayPnl ?? 0, marketType)}
          />
          <Metric
            label={copy.paperRealizedPnl}
            value={formatCurrency(paperAccount?.realizedPnl ?? 0, false, marketType)}
            accent={getSignedTextClass(paperAccount?.realizedPnl ?? 0, marketType)}
          />
          <Metric
            label={copy.paperUnrealizedPnl}
            value={formatCurrency(paperAccount?.unrealizedPnl ?? 0, false, marketType)}
            accent={getSignedTextClass(paperAccount?.unrealizedPnl ?? 0, marketType)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-dark-border bg-dark-hover/40 px-3 py-3 text-sm text-dark-muted">
            <div>{copy.lastRefresh}: {paperAccount?.lastAutoRunAt ? formatRelativeTime(paperAccount.lastAutoRunAt, marketType) : '--'}</div>
            <div className="mt-1">{copy.paperLastReset}: {paperAccount?.lastResetAt ? formatRelativeTime(paperAccount.lastResetAt, marketType) : '--'}</div>
          </div>
          <div className="rounded-lg border border-dark-border bg-dark-hover/40 px-3 py-3 text-sm text-dark-muted">
            <div>{copy.positions}: {paperAccount?.openPositions ?? 0}</div>
            <div className="mt-1">{copy.tradingPaused}: {paperAccount?.tradingPaused ? copy.active : copy.inactive}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={isWorking || isLoading}
            className="rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
          >
            {isWorking ? copy.working : paperAccount?.autoTradingEnabled ? copy.paperDisableAuto : copy.paperEnableAuto}
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={isWorking || isLoading}
            className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-2 text-sm font-medium text-loss transition-colors hover:bg-loss/20 disabled:opacity-50"
          >
            {isWorking ? copy.working : copy.paperReset}
          </button>
        </div>

        <div className="rounded-lg border border-dark-border bg-dark-hover/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark-text">{copy.paperCapital}</h3>
            <span className="text-xs text-dark-muted">{formatCurrency(paperAccount?.capital ?? 0, true, marketType)}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              step="1000"
              value={capitalDraft}
              onChange={(event) => setCapitalDraft(event.target.value)}
              placeholder={copy.paperCapitalHint}
              className="min-w-0 flex-1 rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors placeholder:text-dark-muted focus:border-brand-primary"
            />
            <button
              type="button"
              onClick={() => void handleCapitalSave()}
              disabled={isWorking || !capitalDraft}
              className="rounded-lg border border-info/30 bg-info/10 px-4 py-2 text-sm font-medium text-info transition-colors hover:bg-info/20 disabled:opacity-50"
            >
              {copy.saveCapital}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-dark-border bg-dark-hover/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-dark-text">{copy.manualOrderTicket}</h3>
            <span className="text-xs text-dark-muted">{copy.currentSymbol}: {orderDraft.symbol || '--'}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <div className="text-xs text-dark-muted">{copy.symbol}</div>
              <input
                type="text"
                value={orderDraft.symbol}
                onChange={(event) => setOrderDraft((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                placeholder={copy.symbol}
                className="w-full rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-primary"
              />
            </label>
            <div className="flex rounded-lg border border-dark-border bg-dark-card/70 p-1">
              {(['BUY', 'SELL'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => setOrderDraft((current) => ({ ...current, side }))}
                  className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                    orderDraft.side === side
                      ? 'bg-brand-primary/20 text-brand-primary'
                      : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {marketType === 'A' ? (side === 'BUY' ? '买入' : '卖出') : side}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-dark-muted">
                <span>{marketType === 'A' ? copy.orderLots : copy.orderShares}</span>
                {marketType === 'A' ? (
                  <div className="flex rounded-md border border-dark-border bg-dark-card/70 p-0.5">
                    {([
                      { key: 'LOT', label: copy.lotUnit },
                      { key: 'SHARE', label: copy.shareUnit },
                    ] as const).map((unit) => (
                      <button
                        key={unit.key}
                        type="button"
                        onClick={() => setQuantityUnit(unit.key)}
                        className={`rounded px-2 py-1 text-[11px] transition-colors ${
                          quantityUnit === unit.key ? 'bg-brand-primary/20 text-brand-primary' : 'text-dark-muted'
                        }`}
                      >
                        {unit.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                type="number"
                min="0"
                step={quantityUnit === 'LOT' ? '1' : '1'}
                value={orderDraft.quantity}
                onChange={(event) => setOrderDraft((current) => ({ ...current, quantity: event.target.value }))}
                placeholder={copy.quantity}
                className="w-full rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-primary"
              />
              <div className="text-[11px] text-dark-muted">
                {marketType === 'A'
                  ? `${copy.orderQuantityHint}: ${formatNumber(quantityInShares, false, marketType)}${copy.shareUnit}`
                  : `${copy.orderQuantityHint}: ${formatNumber(quantityInShares, false, marketType)} ${copy.shareUnit}`}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-dark-muted">
                <span>{copy.orderPrice}</span>
                <button
                  type="button"
                  onClick={() => setOrderDraft((current) => ({ ...current, price: livePrice > 0 ? livePrice.toFixed(2) : current.price }))}
                  className="rounded border border-info/30 bg-info/10 px-2 py-0.5 text-[11px] text-info"
                >
                  {copy.useLivePrice}
                </button>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={orderDraft.price}
                onChange={(event) => setOrderDraft((current) => ({ ...current, price: event.target.value }))}
                placeholder={copy.price}
                className="w-full rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-primary"
              />
              <div className="text-[11px] text-dark-muted">
                {copy.currentPriceLabel}: {livePrice > 0 ? formatCurrency(livePrice, false, marketType) : '--'}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-dark-border bg-dark-card/40 p-3">
              <div className="flex items-center justify-between text-xs text-dark-muted">
                <span>{copy.stopPercent}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => adjustPercent('stopLossPct', -0.5)} className="rounded border border-dark-border px-2 py-0.5 text-dark-muted">-</button>
                  <button type="button" onClick={() => adjustPercent('stopLossPct', 0.5)} className="rounded border border-dark-border px-2 py-0.5 text-dark-muted">+</button>
                </div>
              </div>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={orderDraft.stopLossPct}
                onChange={(event) => setOrderDraft((current) => ({ ...current, stopLossPct: event.target.value }))}
                className="w-full rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-primary"
              />
              <div className="text-sm font-medium text-dark-text">
                {copy.stop}: {derivedStopLoss > 0 ? formatCurrency(derivedStopLoss, false, marketType) : '--'}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border border-dark-border bg-dark-card/40 p-3">
              <div className="flex items-center justify-between text-xs text-dark-muted">
                <span>{copy.targetPercent}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => adjustPercent('targetPct', -0.5)} className="rounded border border-dark-border px-2 py-0.5 text-dark-muted">-</button>
                  <button type="button" onClick={() => adjustPercent('targetPct', 0.5)} className="rounded border border-dark-border px-2 py-0.5 text-dark-muted">+</button>
                </div>
              </div>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={orderDraft.targetPct}
                onChange={(event) => setOrderDraft((current) => ({ ...current, targetPct: event.target.value }))}
                className="w-full rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors focus:border-brand-primary"
              />
              <div className="text-sm font-medium text-dark-text">
                {copy.target}: {derivedTargetPrice > 0 ? formatCurrency(derivedTargetPrice, false, marketType) : '--'}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => void handlePlaceOrder()}
              disabled={isWorking}
              className="rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-4 py-2 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
            >
              {isWorking ? copy.working : copy.placePaperOrder}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
