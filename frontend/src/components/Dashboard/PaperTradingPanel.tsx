import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatRelativeTime } from '../../utils/formatters'
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
    <div className="rounded-lg border border-dark-border bg-dark-hover/60 px-3 py-3">
      <div className="text-[11px] uppercase tracking-[0.14em] text-dark-muted">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${accent}`}>{value}</div>
    </div>
  )
}

export function PaperTradingPanel() {
  const {
    paperAccount,
    marketType,
    strategyType,
    setAutoTradingEnabled,
    resetPaperAccount,
    isLoading,
  } = useApp()
  const copy = getDashboardCopy(marketType)
  const [isWorking, setIsWorking] = useState(false)

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

  const strategyLabel = strategyType === 'fortress'
    ? (marketType === 'A' ? '堡垒策略' : 'Fortress')
    : strategyType === 'vwap_pullback'
      ? 'VWAP Pullback'
      : 'ORB'

  return (
    <div className="rounded-lg border border-dark-border bg-dark-card">
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

      <div className="space-y-4 p-4">
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
      </div>
    </div>
  )
}
