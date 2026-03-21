import React from 'react'
import { useApp } from '../hooks/useApp'
import { Position } from '../hooks/useApp'
import { formatCurrency, formatPercent } from '../utils/formatters'

export function PositionsTable() {
  const { portfolio, isLoading } = useApp()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
        No positions found
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Symbol
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Qty
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              P&L
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Value
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {portfolio.positions.map((position) => (
            <tr key={position.symbol} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-medium text-gray-900">{position.symbol}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {position.quantity.toLocaleString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatCurrency(position.avgPrice)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatCurrency(position.currentPrice)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`text-sm font-medium ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {position.pnl >= 0 ? '+' : ''}{formatCurrency(position.pnl)}
                </span>
                <span className={`ml-2 text-xs ${position.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  ({position.pnlPercent >= 0 ? '+' : ''}{formatPercent(position.pnlPercent)})
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {formatCurrency(position.marketValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
