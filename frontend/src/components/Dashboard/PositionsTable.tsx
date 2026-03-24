import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters'
import { getDashboardCopy, getSignedTextClass } from '../../utils/market'
import type { Position } from '../../types'

export function PositionsTable() {
  const { portfolio, isLoading, marketType } = useApp()
  const [sortBy, setSortBy] = useState<keyof Position>('marketValue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const copy = getDashboardCopy(marketType)

  if (isLoading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 animate-pulse">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-dark-hover rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-lg p-6 text-center text-dark-muted">
        {copy.noPositions}
      </div>
    )
  }

  const sortedPositions = [...portfolio.positions].sort((a, b) => {
    const aVal = a[sortBy]
    const bVal = b[sortBy]
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    }
    return 0
  })

  const handleSort = (key: keyof Position) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const SortIndicator = ({ column }: { column: keyof Position }) => (
    <span className={`ml-1 ${sortBy === column ? 'opacity-100' : 'opacity-30'}`}>
      {sortBy === column ? (sortDir === 'desc' ? '↓' : '↑') : '↓'}
    </span>
  )

  return (
    <div className="bg-dark-card border border-dark-border rounded-lg">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-dark-text">{copy.positions}</h2>
        <span className="text-xs text-dark-muted">
          {portfolio.positions.length} {marketType === 'A'
            ? '只持仓'
            : (portfolio.positions.length === 1 ? 'position' : 'positions')}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-dark-muted uppercase tracking-wider border-b border-dark-border">
              <th
                className="px-4 py-3 text-left cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('symbol')}
              >
                {copy.symbol} <SortIndicator column="symbol" />
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('quantity')}
              >
                {copy.quantity} <SortIndicator column="quantity" />
              </th>
              <th className="px-4 py-3 text-right">{copy.avgPrice}</th>
              <th className="px-4 py-3 text-right">{copy.current}</th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('pnlPercent')}
              >
                {copy.pnl} <SortIndicator column="pnlPercent" />
              </th>
              <th className="px-4 py-3 text-right">{copy.day}</th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('marketValue')}
              >
                {copy.value} <SortIndicator column="marketValue" />
              </th>
              <th className="px-4 py-3 text-right">{copy.weight}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((position) => (
              <tr
                key={position.symbol}
                className="border-b border-dark-border hover:bg-dark-hover transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-dark-text">{position.symbol}</div>
                      <div className="text-xs text-dark-muted">{position.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {position.side && (
                          <span className="rounded-full border border-dark-border px-2 py-0.5 text-[10px] text-dark-muted">
                            {position.side === 'SHORT' ? copy.shortSide : copy.longSide}
                          </span>
                        )}
                        {position.strategy && (
                          <span className="rounded-full border border-dark-border px-2 py-0.5 text-[10px] text-dark-muted">
                            {position.strategy}
                          </span>
                        )}
                        {position.trailingActive && (
                          <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] text-info">
                            {copy.trailing}
                          </span>
                        )}
                        {position.partialExitDone && (
                          <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] text-warning">
                            {copy.partialExit}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-dark-muted">
                  {formatNumber(position.quantity, false, marketType)}
                </td>
                <td className="px-4 py-3 text-right text-dark-muted">
                  {formatCurrency(position.avgPrice, false, marketType)}
                </td>
                <td className="px-4 py-3 text-right text-dark-text font-medium">
                  {formatCurrency(position.currentPrice, false, marketType)}
                  {(position.protectiveStop || position.targetPrice) && (
                    <div className="mt-1 space-y-0.5 text-[10px] font-normal text-dark-muted">
                      {position.protectiveStop ? (
                        <div>
                          {copy.protectiveStop}: {formatCurrency(position.protectiveStop, false, marketType)}
                        </div>
                      ) : null}
                      {position.targetPrice ? (
                        <div>
                          {copy.target}: {formatCurrency(position.targetPrice, false, marketType)}
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={getSignedTextClass(position.pnl, marketType)}>
                    <div className="font-medium">
                      {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl, false, marketType)}
                    </div>
                    <div className="text-xs">
                      ({formatPercent(position.pnlPercent)})
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={getSignedTextClass(position.dayChange, marketType)}>
                    {formatPercent(position.dayChangePercent)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-dark-text font-medium">
                  {formatCurrency(position.marketValue, true, marketType)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-1.5 bg-dark-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-info rounded-full"
                        style={{ width: `${Math.min(position.weight, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-dark-muted w-10 text-right">
                      {position.weight.toFixed(1)}%
                    </span>
                  </div>
                  {(typeof position.holdingMinutes === 'number' || typeof position.kellyFraction === 'number') && (
                    <div className="mt-1 space-y-0.5 text-[10px] text-dark-muted">
                      {typeof position.holdingMinutes === 'number' ? (
                        <div>
                          {copy.holdingTime}: {position.holdingMinutes}m
                        </div>
                      ) : null}
                      {typeof position.timeDecayMinutes === 'number' && position.timeDecayMinutes > 0 ? (
                        <div>
                          {copy.timeDecay}: {position.timeDecayMinutes}m
                        </div>
                      ) : null}
                      {typeof position.kellyFraction === 'number' && position.kellyFraction > 0 ? (
                        <div>
                          {copy.kelly}: {(position.kellyFraction * 100).toFixed(1)}%
                        </div>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-dark-hover text-sm font-medium">
              <td className="px-4 py-3 text-dark-text">{copy.total}</td>
              <td className="px-4 py-3 text-right text-dark-muted">
                {formatNumber(portfolio.positions.reduce((sum, p) => sum + p.quantity, 0), false, marketType)}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right">
                <span className={getSignedTextClass(portfolio.totalPnl, marketType)}>
                  {portfolio.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.totalPnl, false, marketType)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={getSignedTextClass(portfolio.dayPnl, marketType)}>
                  {formatPercent(portfolio.dayPnlPercent)}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-dark-text">
                {formatCurrency(portfolio.investedValue, true, marketType)}
              </td>
              <td className="px-4 py-3 text-right text-dark-muted">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
