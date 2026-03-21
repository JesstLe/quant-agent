import { useState } from 'react'
import { useApp } from '../../hooks/useApp'
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatters'
import type { Position } from '../../types'

export function PositionsTable() {
  const { portfolio, isLoading } = useApp()
  const [sortBy, setSortBy] = useState<keyof Position>('marketValue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

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
        No positions found
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
        <h2 className="text-sm font-semibold text-dark-text">Positions</h2>
        <span className="text-xs text-dark-muted">
          {portfolio.positions.length} {portfolio.positions.length === 1 ? 'position' : 'positions'}
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
                Symbol <SortIndicator column="symbol" />
              </th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('quantity')}
              >
                Qty <SortIndicator column="quantity" />
              </th>
              <th className="px-4 py-3 text-right">Avg Price</th>
              <th className="px-4 py-3 text-right">Current</th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('pnlPercent')}
              >
                P&L <SortIndicator column="pnlPercent" />
              </th>
              <th className="px-4 py-3 text-right">Day</th>
              <th
                className="px-4 py-3 text-right cursor-pointer hover:text-dark-text"
                onClick={() => handleSort('marketValue')}
              >
                Value <SortIndicator column="marketValue" />
              </th>
              <th className="px-4 py-3 text-right">Weight</th>
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
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-dark-muted">
                  {formatNumber(position.quantity)}
                </td>
                <td className="px-4 py-3 text-right text-dark-muted">
                  {formatCurrency(position.avgPrice)}
                </td>
                <td className="px-4 py-3 text-right text-dark-text font-medium">
                  {formatCurrency(position.currentPrice)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className={position.pnl >= 0 ? 'text-profit' : 'text-loss'}>
                    <div className="font-medium">
                      {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                    </div>
                    <div className="text-xs">
                      ({position.pnlPercent >= 0 ? '+' : ''}{formatPercent(position.pnlPercent)})
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`${position.dayChange >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {position.dayChange >= 0 ? '+' : ''}{formatPercent(position.dayChangePercent)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-dark-text font-medium">
                  {formatCurrency(position.marketValue, true)}
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
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-dark-hover text-sm font-medium">
              <td className="px-4 py-3 text-dark-text">Total</td>
              <td className="px-4 py-3 text-right text-dark-muted">
                {formatNumber(portfolio.positions.reduce((sum, p) => sum + p.quantity, 0))}
              </td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-right">
                <span className={portfolio.totalPnl >= 0 ? 'text-profit' : 'text-loss'}>
                  {portfolio.totalPnl >= 0 ? '+' : ''}{formatCurrency(portfolio.totalPnl)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={portfolio.dayPnl >= 0 ? 'text-profit' : 'text-loss'}>
                  {formatPercent(portfolio.dayPnlPercent)}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-dark-text">
                {formatCurrency(portfolio.investedValue, true)}
              </td>
              <td className="px-4 py-3 text-right text-dark-muted">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
