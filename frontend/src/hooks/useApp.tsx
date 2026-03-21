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
  mockMarkets,
  mockPortfolio,
  mockSignals,
  mockAgents,
  mockTrades,
  mockRiskMetrics,
  mockRiskAlerts,
  mockAgentLogs,
  mockHistoricalData,
  mockDailyHistory,
} from '../data/mockData'

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
  useMockData: boolean

  // Actions
  refresh: () => Promise<void>
  setUseMockData: (value: boolean) => void
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
// API Client
// ============================================================

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`)
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
    return response.json()
  }

  async post<T>(endpoint: string, data: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
    return response.json()
  }

  connectWebSocket(onMessage: (data: unknown) => void): WebSocket | null {
    try {
      const ws = new WebSocket(`ws://localhost:8000/ws`)
      ws.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data))
        } catch {
          console.error('Failed to parse WebSocket message')
        }
      }
      ws.onerror = () => console.warn('WebSocket connection error')
      return ws
    } catch {
      console.warn('Failed to create WebSocket connection')
      return null
    }
  }
}

// ============================================================
// Provider
// ============================================================

interface AppProviderProps {
  children: ReactNode
  initialMockMode?: boolean
}

export function AppProvider({ children, initialMockMode = true }: AppProviderProps) {
  // State
  const [portfolio, setPortfolio] = useState<PortfolioMetrics | null>(null)
  const [markets, setMarkets] = useState<Market[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([])
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [useMockData, setUseMockDataState] = useState(initialMockMode)

  const api = new ApiClient()

  // Load mock data
  const loadMockData = useCallback(() => {
    setPortfolio(mockPortfolio)
    setMarkets(mockMarkets)
    setSignals(mockSignals)
    setAgents(mockAgents)
    setTrades(mockTrades)
    setRiskMetrics(mockRiskMetrics)
    setAlerts(mockRiskAlerts)
    setLogs(mockAgentLogs)
    setHistoricalData(mockHistoricalData)
    setDailyHistory(mockDailyHistory)
    setLastUpdate(new Date())
    setError(null)
    setIsLoading(false)
  }, [])

  // Load real data from API
  const loadRealData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [
        portfolioData,
        marketsData,
        signalsData,
        agentsData,
        tradesData,
        riskData,
        alertsData,
        logsData,
        historicalDataResponse,
        dailyHistoryResponse,
      ] = await Promise.all([
        api.get<PortfolioMetrics>('/api/portfolio'),
        api.get<Market[]>('/api/markets'),
        api.get<Signal[]>('/api/signals'),
        api.get<Agent[]>('/api/agents'),
        api.get<Trade[]>('/api/trades'),
        api.get<RiskMetrics>('/api/risk'),
        api.get<RiskAlert[]>('/api/alerts'),
        api.get<AgentLog[]>('/api/logs'),
        api.get<HistoricalDataPoint[]>('/api/historical'),
        api.get<DailyHistoryPoint[]>('/api/daily-history'),
      ])
      setPortfolio(portfolioData)
      setMarkets(marketsData)
      setSignals(signalsData)
      setAgents(agentsData)
      setTrades(tradesData)
      setRiskMetrics(riskData)
      setAlerts(alertsData)
      setLogs(logsData)
      setHistoricalData(historicalDataResponse)
      setDailyHistory(dailyHistoryResponse)
      setLastUpdate(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
      // Fallback to mock data on error
      console.warn('API unavailable, falling back to mock data')
      loadMockData()
    } finally {
      setIsLoading(false)
    }
  }, [loadMockData])

  // Refresh data
  const refresh = useCallback(async () => {
    if (useMockData) {
      // Simulate some dynamic changes in mock data
      loadMockData()
    } else {
      try {
        await api.post('/api/refresh', {})
      } catch {
        // Ignore refresh trigger failures and fall back to a normal fetch.
      }
      await loadRealData()
    }
  }, [useMockData, loadMockData, loadRealData])

  // Toggle mock mode
  const setUseMockData = useCallback((value: boolean) => {
    setUseMockDataState(value)
  }, [])

  const reviewSignal = useCallback(async (signalId: string, action: 'approve' | 'reject') => {
    if (useMockData) {
      const nextStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
      setSignals(prev => prev.map(signal => (
        signal.id === signalId ? { ...signal, status: nextStatus } : signal
      )))
      setLastUpdate(new Date())
      return
    }

    const endpoint = `/api/signals/${signalId}/${action}`
    const updatedSignal = await api.post<Signal>(endpoint, {})

    setSignals(prev => prev.map(signal => (
      signal.id === signalId ? updatedSignal : signal
    )))
    await loadRealData()
  }, [useMockData, loadRealData])

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a))
  }, [])

  // Initial load
  useEffect(() => {
    if (useMockData) {
      loadMockData()
    } else {
      loadRealData()
    }
  }, [useMockData, loadMockData, loadRealData])

  // WebSocket connection for real data
  useEffect(() => {
    if (useMockData) return

    const ws = api.connectWebSocket((data: unknown) => {
      const typedData = data as { type: string; payload: unknown }
      switch (typedData.type) {
        case 'portfolio':
          setPortfolio(typedData.payload as PortfolioMetrics)
          break
        case 'markets':
          setMarkets(typedData.payload as Market[])
          break
        case 'signals':
          setSignals(Array.isArray(typedData.payload)
            ? typedData.payload as Signal[]
            : prev => [typedData.payload as Signal, ...prev])
          break
        case 'agents':
          setAgents(typedData.payload as Agent[])
          break
        case 'trades':
          setTrades(Array.isArray(typedData.payload)
            ? typedData.payload as Trade[]
            : prev => [typedData.payload as Trade, ...prev])
          break
        case 'risk':
          setRiskMetrics(typedData.payload as RiskMetrics)
          break
        case 'alerts':
          setAlerts(Array.isArray(typedData.payload)
            ? typedData.payload as RiskAlert[]
            : prev => [typedData.payload as RiskAlert, ...prev])
          break
        case 'logs':
          setLogs(Array.isArray(typedData.payload)
            ? typedData.payload as AgentLog[]
            : prev => [typedData.payload as AgentLog, ...prev.slice(0, 99)])
          break
      }
      setLastUpdate(new Date())
    })

    return () => ws?.close()
  }, [useMockData])

  // Simulate real-time updates in mock mode
  useEffect(() => {
    if (!useMockData) return

    const interval = setInterval(() => {
      // Update portfolio value slightly
      setPortfolio(prev => {
        if (!prev) return prev
        const change = (Math.random() - 0.5) * 100
        return {
          ...prev,
          dayPnl: prev.dayPnl + change,
          dayPnlPercent: ((prev.dayPnl + change) / prev.totalValue) * 100,
          totalValue: prev.totalValue + change,
        }
      })
      setLastUpdate(new Date())
    }, 5000)

    return () => clearInterval(interval)
  }, [useMockData])

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
    useMockData,
    refresh,
    setUseMockData,
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
