import { AppProvider, useApp } from './hooks/useApp'
import { PortfolioSummary, PaperTradingPanel, WatchlistManagerPanel, PositionsTable, SignalsPanel, AgentsPanel, MarketsTable, MarketWorkbench } from './components/Dashboard'
import { PortfolioChart, AllocationPieChart, DailyPnlChart } from './components/Dashboard/Charts'
import { QuantAgentLogo } from './components/Brand/QuantAgentLogo'
import { localizeAlertMessage } from './utils/market'
import type { StrategyType } from './types'

export type MarketType = 'A' | 'US'

function Header() {
  const { refresh, isLoading, marketType, setMarketType, strategyType, setStrategyType, lastUpdate } = useApp()
  const strategyOptions: Array<{ value: StrategyType; label: string }> = [
    { value: 'fortress', label: marketType === 'A' ? '堡垒' : 'Fortress' },
    { value: 'vwap_pullback', label: 'VWAP' },
    { value: 'orb', label: 'ORB' },
  ]

  return (
    <header className="bg-dark-card border-b border-dark-border">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <QuantAgentLogo />
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${marketType === 'A' ? 'bg-info/20 text-info' : 'bg-purple-500/20 text-purple-400'}`}>
              {marketType === 'A' ? 'A股' : '美股'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Market Type Toggle */}
            <div className="flex items-center gap-1 bg-dark-hover rounded-lg p-1">
              <button
                onClick={() => setMarketType('A')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  marketType === 'A'
                    ? 'bg-info/20 text-info'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                A股
              </button>
              <button
                onClick={() => setMarketType('US')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  marketType === 'US'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-dark-muted hover:text-dark-text'
                }`}
              >
                美股
              </button>
            </div>

            <div className="flex items-center gap-1 bg-dark-hover rounded-lg p-1">
              {strategyOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setStrategyType(option.value)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    strategyType === option.value
                      ? 'bg-brand-primary/20 text-brand-primary'
                      : 'text-dark-muted hover:text-dark-text'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-dark-hover border border-dark-border rounded text-xs font-medium text-dark-text hover:bg-dark-border transition-colors disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.58M20 20v-5h-.58M4.58 9A8 8 0 0119.42 9M19.42 15A8 8 0 014.58 15" />
              </svg>
              {isLoading ? '刷新中...' : '刷新'}
            </button>

            {/* Last Update */}
            {lastUpdate && (
              <div className="text-xs text-dark-muted">
                更新时间: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MainContent() {
  const { error, alerts, marketType } = useApp()

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
                {marketType === 'A'
                  ? `${unacknowledgedAlerts.length} 条风险提示: ${localizeAlertMessage(unacknowledgedAlerts[0].message, marketType)}`
                  : `${unacknowledgedAlerts.length} active alert${unacknowledgedAlerts.length > 1 ? 's' : ''}: ${unacknowledgedAlerts[0].message}`}
              </span>
            </div>
          </div>
        )}

        {/* Top row - Summary, Paper, and Agents */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-2">
            <PortfolioSummary />
          </div>
          <div>
            <PaperTradingPanel />
          </div>
          <div>
            <AgentsPanel />
          </div>
        </div>

        {/* Second row - Watchlist and Market Workbench */}
        <div className="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-6">
          <div>
            <WatchlistManagerPanel />
          </div>
          <div>
            <MarketWorkbench />
          </div>
        </div>

        {/* Third row - Portfolio Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PortfolioChart />
          <AllocationPieChart />
        </div>

        {/* Fourth row - Positions */}
        <PositionsTable />

        {/* Fifth row - Daily P&L and Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DailyPnlChart />
          <SignalsPanel />
        </div>

        {/* Sixth row - Markets */}
        <MarketsTable />
      </div>
    </main>
  )
}

export default function App() {
  return (
    <AppProvider initialMarketType="US">
      <div className="min-h-screen bg-dark-bg">
        <Header />
        <MainContent />
      </div>
    </AppProvider>
  )
}
