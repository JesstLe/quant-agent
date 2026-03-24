import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatPercent, formatRelativeTime } from '../../utils/formatters'
import { getDashboardCopy, getSignedTextClass, localizeAgentName, localizeSignalStatus, localizeSignalType } from '../../utils/market'
import type { SignalType, SignalStatus } from '../../types'

const typeStyles: Record<SignalType, string> = {
  BUY: 'bg-profit/20 text-profit border-profit/30',
  SELL: 'bg-loss/20 text-loss border-loss/30',
  HOLD: 'bg-dark-muted/20 text-dark-muted border-dark-muted/30',
}

const statusStyles: Record<SignalStatus, string> = {
  PENDING: 'bg-warning/20 text-warning',
  APPROVED: 'bg-profit/20 text-profit',
  EXECUTING: 'bg-info/20 text-info animate-pulse',
  EXECUTED: 'bg-profit/30 text-profit',
  REJECTED: 'bg-loss/20 text-loss',
  CANCELLED: 'bg-dark-muted/20 text-dark-muted',
}

const confidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return 'bg-profit'
  if (confidence >= 0.6) return 'bg-warning'
  return 'bg-loss'
}

export function SignalsPanel() {
  const { signals, isLoading, reviewSignal, marketType } = useApp()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const copy = getDashboardCopy(marketType)
  const priceDeltaClass = (signal: { entryPrice: number; targetPrice: number; stopLoss: number; type: SignalType }, kind: 'target' | 'stop') => {
    const reference = signal.entryPrice || 0
    const price = kind === 'target' ? signal.targetPrice : signal.stopLoss
    return getSignedTextClass(price - reference, marketType)
  }

  const handleReview = async (signalId: string, action: 'approve' | 'reject') => {
    setPendingActionId(signalId)
    setActionError(null)

    try {
      await reviewSignal(signalId, action)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : (marketType === 'A' ? '更新信号失败' : 'Failed to update signal'))
    } finally {
      setPendingActionId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 animate-pulse">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-dark-hover rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-dark-muted">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        {copy.noSignals}
      </div>
    )
  }

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.recentSignals}</h2>
        <span className="text-xs text-dark-muted">
          {signals.filter(s => s.status === 'PENDING').length} {copy.pending}
        </span>
      </div>
      {actionError && (
        <div className="px-4 py-2 border-b border-dark-border bg-loss/10 text-xs text-loss">
          {actionError}
        </div>
      )}
      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {signals.map((signal) => {
          const isExpanded = expandedId === signal.id
          return (
            <div
              key={signal.id}
              className="bg-dark-hover border border-dark-border rounded-lg overflow-hidden"
            >
              {/* Header */}
              <div
                className="p-3 cursor-pointer hover:bg-dark-border/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : signal.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${typeStyles[signal.type]}`}>
                      {localizeSignalType(signal.type, marketType)}
                    </span>
                    <span className="font-medium text-dark-text">{signal.symbol}</span>
                    <span className="text-xs text-dark-muted">{copy.by} {localizeAgentName(signal.agentSource, marketType)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${statusStyles[signal.status]}`}>
                      {localizeSignalStatus(signal.status, marketType)}
                    </span>
                    <svg
                      className={`w-4 h-4 text-dark-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-dark-muted">
                      {copy.entry}: <span className="text-dark-text">{formatCurrency(signal.entryPrice, false, marketType)}</span>
                    </span>
                    <span className="text-dark-muted">
                      {copy.target}: <span className={priceDeltaClass(signal, 'target')}>{formatCurrency(signal.targetPrice, false, marketType)}</span>
                    </span>
                    <span className="text-dark-muted">
                      {copy.stop}: <span className={priceDeltaClass(signal, 'stop')}>{formatCurrency(signal.stopLoss, false, marketType)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${confidenceColor(signal.confidence)}`}
                        style={{ width: `${signal.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-dark-muted">
                      {(signal.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-dark-border animate-fade-in">
                  <div className="pt-3 space-y-3">
                    {/* Rationale */}
                    <div>
                      <div className="text-xs text-dark-muted mb-1">{copy.rationale}</div>
                      <p className="text-sm text-dark-text">{signal.rationale}</p>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      {signal.strategy && (
                        <div>
                          <span className="text-dark-muted">{copy.strategy}</span>
                          <div className="font-medium text-dark-text">{signal.strategy}</div>
                        </div>
                      )}
                      {signal.expectedReturn && (
                        <div>
                          <span className="text-dark-muted">{copy.expectedReturn}</span>
                          <div className={`font-medium ${getSignedTextClass(signal.expectedReturn, marketType)}`}>
                            {formatPercent(signal.expectedReturn)}
                          </div>
                        </div>
                      )}
                      {signal.riskScore && (
                        <div>
                          <span className="text-dark-muted">{copy.riskScore}</span>
                          <div className="font-medium text-dark-text">
                            {signal.riskScore.toFixed(1)}/10
                          </div>
                        </div>
                      )}
                      {signal.quantity && (
                        <div>
                          <span className="text-dark-muted">{copy.suggestedQty}</span>
                          <div className="font-medium text-dark-text">{signal.quantity}</div>
                        </div>
                      )}
                      {typeof signal.kellyFraction === 'number' && signal.kellyFraction > 0 && (
                        <div>
                          <span className="text-dark-muted">{copy.kelly}</span>
                          <div className="font-medium text-dark-text">
                            {(signal.kellyFraction * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                      {typeof signal.portfolioHeat === 'number' && (
                        <div>
                          <span className="text-dark-muted">{copy.heat}</span>
                          <div className="font-medium text-dark-text">
                            {(signal.portfolioHeat * 100).toFixed(1)}%
                          </div>
                        </div>
                      )}
                      {typeof signal.maxPositionSize === 'number' && signal.maxPositionSize > 0 && (
                        <div>
                          <span className="text-dark-muted">{copy.maxPositionSize}</span>
                          <div className="font-medium text-dark-text">
                            {formatCurrency(signal.maxPositionSize, true, marketType)}
                          </div>
                        </div>
                      )}
                    </div>

                    {(signal.cooldownUntil || signal.tradingPaused || (signal.warnings && signal.warnings.length > 0)) && (
                      <div className="space-y-2 rounded-lg border border-dark-border bg-dark-hover/40 p-3 text-xs">
                        <div className="grid gap-3 sm:grid-cols-3">
                          {signal.cooldownUntil && (
                            <div>
                              <span className="text-dark-muted">{copy.cooldown}</span>
                              <div className="mt-1 font-medium text-warning">
                                {formatRelativeTime(signal.cooldownUntil, marketType)}
                              </div>
                            </div>
                          )}
                          {signal.tradingPaused && (
                            <div>
                              <span className="text-dark-muted">{copy.tradingPaused}</span>
                              <div className="mt-1 font-medium text-loss">
                                {marketType === 'A' ? '是' : 'Yes'}
                              </div>
                            </div>
                          )}
                        </div>
                        {signal.warnings && signal.warnings.length > 0 && (
                          <div>
                            <div className="mb-2 text-dark-muted">{copy.warnings}</div>
                            <div className="flex flex-wrap gap-2">
                              {signal.warnings.map((warning, index) => (
                                <span
                                  key={`${signal.id}-warning-${index}`}
                                  className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-warning"
                                >
                                  {warning}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-dark-border">
                      <span className="text-xs text-dark-muted">
                        {formatRelativeTime(signal.timestamp, marketType)}
                      </span>
                      {signal.status === 'PENDING' && (
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1 text-xs bg-loss/20 text-loss rounded hover:bg-loss/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={pendingActionId === signal.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleReview(signal.id, 'reject')
                            }}
                          >
                            {copy.reject}
                          </button>
                          <button
                            className="px-3 py-1 text-xs bg-profit/20 text-profit rounded hover:bg-profit/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={pendingActionId === signal.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleReview(signal.id, 'approve')
                            }}
                          >
                            {pendingActionId === signal.id ? copy.working : copy.approve}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
