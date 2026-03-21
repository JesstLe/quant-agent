import React from 'react'
import { AppProvider, useApp } from './hooks/useApp'
import { PortfolioSummary, PositionsTable, SignalsPanel, AgentsPanel, MarketsTable } from './components/Dashboard'
import { PortfolioChart, AllocationPieChart, DailyPnlChart } from './components/Dashboard/Charts'

function Header() {
  const { refresh, isLoading } = useApp()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-blue-600" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0-8-8-8-8 0 0 8 8 8 8 0 0 8-8 8z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l-2.5-2.5a2 2 0 0 3 0 3 0 0 0-2.5-2.5a2 2 0 0 3 0 3 0 0 0 2 2-2h3.5l1.5 1.5 0 2 2 0 0 3 0 3 0 0 0-2-2z" />
              </svg>
              <h1 className="text-2xl font-bold text-gray-900">QuantAgent</h1>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Paper Trading
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.58M15.36 4.58l.42 0 0 0 0 0-.58L15.36 4.58l.42 0 0 0 0 0 .58M15.36 4.58l.42 0 0 0 0 0-.58z" />
              </svg>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
            <div className="text-sm text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function MainContent() {
  const { isLoading, error } = useApp()

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBoxBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h8m0-1.998.045A4.002 4.002A4.002 4.002H8m0 0H6.996l.045A4.002 4.002 4.002 4.002z" />
            </svg>
            <span className="text-red-800 font-medium">Error: {error}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* Top row - Summary and Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <PortfolioSummary />
          </div>
          <div>
            <AgentsPanel />
          </div>
        </div>

        {/* Second row - Portfolio Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PortfolioChart />
          <AllocationPieChart />
        </div>

        {/* Third row - Positions */}
        <div>
          <PositionsTable />
        </div>

        {/* Fourth row - Daily P&L and Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyPnlChart />
          <SignalsPanel />
        </div>

        {/* Fifth row - Markets */}
        <div>
          <MarketsTable />
        </div>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-gray-100">
        <Header />
        <MainContent />
      </div>
    </AppProvider>
  )
}
