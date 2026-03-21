import React from 'react'
import { useApp } from '../hooks/useApp'
import { Signal } from '../hooks/useApp'

export function SignalsPanel() {
  const { signals, isLoading } = useApp()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
        No signals generated yet
      </div>
    )
  }

  const getStatusColor = (status: Signal['status']) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'EXECUTED':
        return 'bg-blue-100 text-blue-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getTypeColor = (type: Signal['type']) => {
    switch (type) {
      case 'BUY':
        return 'text-green-600 bg-green-50'
      case 'SELL':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Signals</h3>
      <div className="space-y-3">
        {signals.slice(0, 5).map((signal) => (
          <div key={signal.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(signal.type)}`}>
                  {signal.type}
                </span>
                <span className="font-medium text-gray-900">{signal.symbol}</span>
              </div>
              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(signal.status)}`}>
                {signal.status}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mb-2">
              <div>
                <span className="block text-gray-500">Entry</span>
                <span className="font-medium">${signal.entryPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-gray-500">Target</span>
                <span className="font-medium">{signal.targetPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-gray-500">Stop Loss</span>
                <span className="font-medium">{signal.stopLoss.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Confidence</span>
                <span>Rationale</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${signal.confidence * 100}%`,
                        backgroundColor: signal.confidence >= 0.7 ? '#10B9818' : '#EF4444'
                      }}
                    />
                  </div>
                  <span className="text-sm font-medium">{(signal.confidence * 100).toFixed(0)}%</span>
                </div>
                <span className="text-xs text-gray-500 truncate max-w-xs">
                  {signal.rationale}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
