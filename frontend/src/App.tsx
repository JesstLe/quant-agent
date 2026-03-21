import { AppProvider, useApp } from './hooks/useApp'
import { PortfolioSummary, PositionsTable, SignalsPanel, AgentsPanel, MarketsTable } from './components/Dashboard'
import { PortfolioChart, AllocationPieChart, DailyPnlChart } from './components/Dashboard/Charts'

function Header() {
  const { refresh, isLoading, useMockData, setUseMockData, lastUpdate } = useApp()

  return (
    <header className="bg-dark-card border-b border-dark-border">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-7 h-7 text-info" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <h1 className="text-lg font-bold text-dark-text">QuantAgent</h1>
            </div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${useMockData ? 'bg-warning/20 text-warning' : 'bg-profit/20 text-profit'}`}>
              {useMockData ? 'Demo Mode' : 'Live'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Demo/Live Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-dark-muted">Demo</span>
              <button
                onClick={() => setUseMockData(!useMockData)}
                className={`relative w-10 h-5 rounded-full transition-colors ${useMockData ? 'bg-warning/30' : 'bg-profit/30'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${useMockData ? 'translate-x-0 bg-warning' : 'translate-x-5 bg-profit'}`}
                />
              </button>
              <span className="text-xs text-dark-muted">Live</span>
            </label>

            {/* Refresh Button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-dark-hover border border-dark-border rounded text-xs font-medium text-dark-text hover:bg-dark-border transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.58M20 20v-5h-.58M4.58 9A8 8 0 0119.42 9M19.42 15A8 8 0 014.58 15" />
              </svg>
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>

            {/* Last Update */}
            {lastUpdate && (
              <div className="text-xs text-dark-muted">
                Updated: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MainContent() {
  const { error, alerts } = useApp()

  if (error) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-loss/10 border border-loss/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-loss" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-loss font-medium">Error: {error}</span>
          </div>
        </div>
      </div>
    )
  }

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged)

  return (
    <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="space-y-6">
        {/* Risk Alerts Banner */}
        {unacknowledgedAlerts.length > 0 && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-warning font-medium text-sm">
                {unacknowledgedAlerts.length} active alert{unacknowledgedAlerts.length > 1 ? 's' : ''}: {unacknowledgedAlerts[0].message}
              </span>
            </div>
          </div>
        )}

        {/* Top row - Summary and Agents */}
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
        <PositionsTable />

        {/* Fourth row - Daily P&L and Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyPnlChart />
          <SignalsPanel />
        </div>

        {/* Fifth row - Markets */}
        <MarketsTable />
      </div>
    </main>
  )
}

export default function App() {
  return (
    <AppProvider initialMockMode={true}>
      <div className="min-h-screen bg-dark-bg">
        <Header />
        <MainContent />
      </div>
    </AppProvider>
  )
}
