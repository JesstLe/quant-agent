import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type {
  Market,
  PortfolioMetrics,
  Signal,
  Agent,
  Trade,
  RiskMetrics,
  RiskAlert,
  AgentLog,
  HistoricalDataPoint,
  DailyHistoryPoint,
} from '../types'
import {
  mockMarketsUS,
  mockMarketsA,
  mockPortfolioUS,
  mockPortfolioA,
  mockSignalsUS,
  mockSignalsA,
  mockAgents,
  mockTradesUS,
  mockTradesA,
  mockRiskMetrics,
  mockRiskAlertsUS,
  mockRiskAlertsA,
  mockAgentLogsUS,
  mockAgentLogsA,
  mockHistoricalDataUS,
  mockHistoricalDataA,
  mockDailyHistoryUS,
  mockDailyHistoryA,
} from '../data/mockData'

export type MarketType = 'A' | 'US'

// ============================================================
// Context Types
// ============================================================

interface AppContextType {
  // Data
  portfolio: PortfolioMetrics | null
  markets: Market[]
  signals: Signal[]
  agents: Agent[]
  trades: Trade[]
  riskMetrics: RiskMetrics | null
  alerts: RiskAlert[]
  logs: AgentLog[]
  historicalData: HistoricalDataPoint[]
  dailyHistory: DailyHistoryPoint[]

  // State
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  marketType: MarketType
  setMarketType: (type: MarketType) => void

  // Actions
  refresh: () => Promise<void>
  acknowledgeAlert: (alertId: string) => void
  reviewSignal: (signalId: string, action: 'approve' | 'reject') => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

// ============================================================
// Provider
// ============================================================

interface AppProviderProps {
  children: ReactNode
  initialMarketType?: MarketType
}

const getMarketData = (marketType: MarketType) => {
  switch (marketType) {
    case 'A':
      return {
        markets: mockMarketsA,
        portfolio: mockPortfolioA,
        signals: mockSignalsA,
        trades: mockTradesA,
        alerts: mockRiskAlertsA,
        logs: mockAgentLogsA,
        historicalData: mockHistoricalDataA,
        dailyHistory: mockDailyHistoryA,
      }
    case 'US':
    default:
      return {
        markets: mockMarketsUS,
        portfolio: mockPortfolioUS,
        signals: mockSignalsUS,
        trades: mockTradesUS,
        alerts: mockRiskAlertsUS,
        logs: mockAgentLogsUS,
        historicalData: mockHistoricalDataUS,
        dailyHistory: mockDailyHistoryUS,
      }
  }
}

export function AppProvider({ children, initialMarketType = 'US' }: AppProviderProps) {
  // State
  const [portfolio, setPortfolio] = useState<PortfolioMetrics | null>(null)
  const [markets, setMarkets] = useState<Market[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [agents] = useState<Agent[]>(mockAgents)
  const [trades, setTrades] = useState<Trade[]>([])
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [marketType, setMarketTypeState] = useState<MarketType>(initialMarketType)

  // Load data based on market type
  const loadData = useCallback((type: MarketType) => {
    const data = getMarketData(type)
    setPortfolio(data.portfolio)
    setMarkets(data.markets)
    setSignals(data.signals)
    setTrades(data.trades)
    setRiskMetrics(mockRiskMetrics)
    setAlerts(data.alerts)
    setLogs(data.logs)
    setHistoricalData(data.historicalData)
    setDailyHistory(data.dailyHistory)
    setLastUpdate(new Date())
    setError(null)
    setIsLoading(false)
  }, [])

  // Refresh data
  const refresh = useCallback(async () => {
    // 使用mock数据，模拟动态变化
    loadData(marketType)
  }, [marketType, loadData])

  // Toggle market type
  const setMarketType = useCallback((type: MarketType) => {
    setMarketTypeState(type)
    loadData(type)
  }, [loadData])

  const reviewSignal = useCallback(async (signalId: string, action: 'approve' | 'reject') => {
    const nextStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    setSignals(prev => prev.map(signal => (
      signal.id === signalId ? { ...signal, status: nextStatus } : signal
    )))
    setLastUpdate(new Date())
  }, [])

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a))
  }, [])

  // Initial load
  useEffect(() => {
    loadData(marketType)
  }, [marketType, loadData])

  const contextValue: AppContextType = {
    portfolio,
    markets,
    signals,
    agents,
    trades,
    riskMetrics,
    alerts,
    logs,
    historicalData,
    dailyHistory,
    isLoading,
    error,
    lastUpdate,
    marketType,
    setMarketType,
    refresh,
    acknowledgeAlert,
    reviewSignal,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// Re-export types for convenience
export type { Market, Position, Signal, Agent, PortfolioMetrics } from '../types'
