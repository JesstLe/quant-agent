import React from 'react'
import { useApp } from '../hooks/useApp'
import { Market } from '../hooks/useApp'
import { formatCurrency, formatPercent } from '../utils/formatters'

export function MarketsTable() {
  const { markets, isLoading } = useApp()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
        No market data available
      </div>
    )
  }

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 0) return 'text-green-600'
    if (changePercent < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Symbol
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Price
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Change
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Volume
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              24h Range
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {markets.map((market) => (
            <tr key={market.symbol} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <span className="font-medium text-gray-900">{market.symbol}</span>
                <span className="block text-xs text-gray-500">{market.name}</span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-sm">
                {formatCurrency(market.price)}
              </td>
              <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${getChangeColor(market.changePercent)}`}>
                <div>
                  {market.change >= 0 ? '+' : ''}{formatCurrency(market.change)}
                </div>
                <div className="text-xs">
                  {market.changePercent >= 0 ? '+' : ''}{formatPercent(market.changePercent)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                {(market.volume / 1000000).toFixed(2)}M
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                <div className="flex flex-col items-end">
                  <span className="text-green-600">{formatCurrency(market.high24h)}</span>
                  <span className="text-red-600">{formatCurrency(market.low24h)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
