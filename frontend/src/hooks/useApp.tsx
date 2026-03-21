import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react'
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

  connectWebSocket(
    market: MarketType,
    onMessage: (data: unknown) => void,
    onError?: () => void,
  ): WebSocket | null {
    try {
      const ws = new WebSocket(`ws://localhost:8000/ws?market=${encodeURIComponent(market)}`)
      ws.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data))
        } catch {
          console.error('Failed to parse WebSocket message')
        }
      }
      ws.onerror = () => onError?.()
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
  initialMarketType?: MarketType
}

export function AppProvider({ children, initialMarketType = 'US' }: AppProviderProps) {
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
  const [marketType, setMarketTypeState] = useState<MarketType>(initialMarketType)
  const requestIdRef = useRef(0)

  const api = useCallback(() => new ApiClient(), [])

  // Load real data from API
  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)
    try {
      const client = api()
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
        client.get<PortfolioMetrics>(`/api/portfolio?market=${marketType}`),
        client.get<Market[]>(`/api/markets?market=${marketType}`),
        client.get<Signal[]>(`/api/signals?market=${marketType}`),
        client.get<Agent[]>(`/api/agents?market=${marketType}`),
        client.get<Trade[]>(`/api/trades?market=${marketType}`),
        client.get<RiskMetrics>(`/api/risk?market=${marketType}`),
        client.get<RiskAlert[]>(`/api/alerts?market=${marketType}`),
        client.get<AgentLog[]>(`/api/logs?market=${marketType}`),
        client.get<HistoricalDataPoint[]>(`/api/historical?market=${marketType}`),
        client.get<DailyHistoryPoint[]>(`/api/daily-history?market=${marketType}`),
      ])
      if (requestId !== requestIdRef.current) {
        return
      }
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
      if (requestId !== requestIdRef.current) {
        return
      }
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch data'
      setError(errorMsg)
      console.error('API unavailable:', errorMsg)
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [api, marketType])

  // Refresh data
  const refresh = useCallback(async () => {
    try {
      const client = api()
      await client.post(`/api/refresh?market=${marketType}`, {})
    } catch (err) {
      console.warn('Refresh trigger failed, falling back to direct reload', err)
    }
    await loadData()
  }, [api, loadData, marketType])

  // Toggle market type
  const setMarketType = useCallback((type: MarketType) => {
    setMarketTypeState(type)
  }, [])

  const reviewSignal = useCallback(async (signalId: string, action: 'approve' | 'reject') => {
    try {
      const client = api()
      const updatedSignal = await client.post<Signal>(
        `/api/signals/${signalId}/${action}?market=${marketType}`,
        {},
      )
      setSignals(prev => prev.map(signal => (
        signal.id === signalId ? updatedSignal : signal
      )))
      setLastUpdate(new Date())
    } catch (err) {
      console.error('Failed to review signal:', err)
      setError(err instanceof Error ? err.message : 'Failed to review signal')
    }
  }, [api, marketType])

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a))
  }, [])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // WebSocket connection for real-time updates
  useEffect(() => {
    let isActive = true
    let ws: WebSocket | null = null
    const connectTimer = window.setTimeout(() => {
      if (!isActive) {
        return
      }

      ws = api().connectWebSocket(
        marketType,
        (data: unknown) => {
          if (!isActive) {
            return
          }
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
        },
        () => {
          if (isActive) {
            console.warn('WebSocket connection error')
          }
        },
      )
    }, 0)

    return () => {
      isActive = false
      window.clearTimeout(connectTimer)
      ws?.close()
    }
  }, [api, marketType])

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
