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
  WatchlistItem,
  StrategyType,
  PaperAccount,
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
  watchlist: WatchlistItem[]
  paperAccount: PaperAccount | null

  // State
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
  marketType: MarketType
  setMarketType: (type: MarketType) => void
  strategyType: StrategyType
  setStrategyType: (type: StrategyType) => void
  selectedSymbol: string | null
  setSelectedSymbol: (symbol: string) => void

  // Actions
  refresh: () => Promise<void>
  acknowledgeAlert: (alertId: string) => void
  reviewSignal: (signalId: string, action: 'approve' | 'reject') => Promise<void>
  toggleWatchlistSymbol: (symbol: string) => Promise<void>
  isWatchlistSymbol: (symbol: string) => boolean
  addWatchlistSymbol: (symbol: string) => Promise<void>
  setAutoTradingEnabled: (enabled: boolean) => Promise<void>
  resetPaperAccount: () => Promise<void>
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

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`)
    return response.json()
  }

  connectWebSocket(
    market: MarketType,
    strategy: StrategyType,
    onMessage: (data: unknown) => void,
    onError?: () => void,
  ): WebSocket | null {
    try {
      const ws = new WebSocket(
        `ws://localhost:8000/ws?market=${encodeURIComponent(market)}&strategy=${encodeURIComponent(strategy)}`,
      )
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([])
  const [paperAccount, setPaperAccount] = useState<PaperAccount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [marketType, setMarketTypeState] = useState<MarketType>(initialMarketType)
  const [strategyType, setStrategyTypeState] = useState<StrategyType>('fortress')
  const [selectedSymbol, setSelectedSymbolState] = useState<string | null>(null)
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
        watchlistData,
        paperAccountData,
      ] = await Promise.all([
        client.get<PortfolioMetrics>(`/api/portfolio?market=${marketType}&strategy=${strategyType}`),
        client.get<Market[]>(`/api/markets?market=${marketType}&strategy=${strategyType}`),
        client.get<Signal[]>(`/api/signals?market=${marketType}&strategy=${strategyType}`),
        client.get<Agent[]>(`/api/agents?market=${marketType}&strategy=${strategyType}`),
        client.get<Trade[]>(`/api/trades?market=${marketType}&strategy=${strategyType}`),
        client.get<RiskMetrics>(`/api/risk?market=${marketType}&strategy=${strategyType}`),
        client.get<RiskAlert[]>(`/api/alerts?market=${marketType}&strategy=${strategyType}`),
        client.get<AgentLog[]>(`/api/logs?market=${marketType}&strategy=${strategyType}`),
        client.get<HistoricalDataPoint[]>(`/api/historical?market=${marketType}&strategy=${strategyType}`),
        client.get<DailyHistoryPoint[]>(`/api/daily-history?market=${marketType}&strategy=${strategyType}`),
        client.get<WatchlistItem[]>(`/api/watchlist?market=${marketType}&strategy=${strategyType}`),
        client.get<PaperAccount>(`/api/paper-account?market=${marketType}&strategy=${strategyType}`),
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
      setWatchlist(watchlistData)
      setPaperAccount(paperAccountData)
      setSelectedSymbolState((currentSymbol) => {
        if (currentSymbol && marketsData.some((market) => market.symbol === currentSymbol)) {
          return currentSymbol
        }
        return marketsData[0]?.symbol ?? null
      })
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
  }, [api, marketType, strategyType])

  // Refresh data
  const refresh = useCallback(async () => {
    try {
      const client = api()
      await client.post(`/api/refresh?market=${marketType}&strategy=${strategyType}`, {})
    } catch (err) {
      console.warn('Refresh trigger failed, falling back to direct reload', err)
    }
    await loadData()
  }, [api, loadData, marketType, strategyType])

  // Toggle market type
  const setMarketType = useCallback((type: MarketType) => {
    setMarketTypeState(type)
  }, [])

  const setStrategyType = useCallback((type: StrategyType) => {
    setStrategyTypeState(type)
  }, [])

  const setSelectedSymbol = useCallback((symbol: string) => {
    setSelectedSymbolState(symbol)
  }, [])

  useEffect(() => {
    setSelectedSymbolState(null)
  }, [marketType])

  const reviewSignal = useCallback(async (signalId: string, action: 'approve' | 'reject') => {
    try {
      const client = api()
      const updatedSignal = await client.post<Signal>(
        `/api/signals/${signalId}/${action}?market=${marketType}&strategy=${strategyType}`,
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
  }, [api, marketType, strategyType])

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a))
  }, [])

  const isWatchlistSymbol = useCallback((symbol: string) => {
    return watchlist.some((item) => item.symbol === symbol)
  }, [watchlist])

  const toggleWatchlistSymbol = useCallback(async (symbol: string) => {
    try {
      const client = api()
      const nextWatchlist = isWatchlistSymbol(symbol)
        ? await client.delete<WatchlistItem[]>(`/api/watchlist/${encodeURIComponent(symbol)}?market=${marketType}&strategy=${strategyType}`)
        : await client.post<WatchlistItem[]>(`/api/watchlist/${encodeURIComponent(symbol)}?market=${marketType}&strategy=${strategyType}`, {})
      setWatchlist(nextWatchlist)
    } catch (err) {
      console.error('Failed to update watchlist:', err)
      setError(err instanceof Error ? err.message : 'Failed to update watchlist')
    }
  }, [api, isWatchlistSymbol, marketType, strategyType])

  const addWatchlistSymbol = useCallback(async (symbol: string) => {
    try {
      const client = api()
      const nextWatchlist = await client.post<WatchlistItem[]>(
        `/api/watchlist/${encodeURIComponent(symbol)}?market=${marketType}&strategy=${strategyType}`,
        {},
      )
      setWatchlist(nextWatchlist)
      const added = nextWatchlist[0]
      if (added?.symbol) {
        setSelectedSymbolState(added.symbol)
      }
    } catch (err) {
      console.error('Failed to add watchlist symbol:', err)
      setError(err instanceof Error ? err.message : 'Failed to add watchlist symbol')
    }
  }, [api, marketType, strategyType])

  const setAutoTradingEnabled = useCallback(async (enabled: boolean) => {
    try {
      const client = api()
      const nextPaperAccount = await client.post<PaperAccount>(
        `/api/paper-account/settings?market=${marketType}&strategy=${strategyType}`,
        { autoTradingEnabled: enabled },
      )
      setPaperAccount(nextPaperAccount)
      setLastUpdate(new Date())
      await loadData()
    } catch (err) {
      console.error('Failed to update paper account settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to update paper account settings')
    }
  }, [api, loadData, marketType, strategyType])

  const resetPaperAccount = useCallback(async () => {
    try {
      const client = api()
      const nextPaperAccount = await client.post<PaperAccount>(
        `/api/paper-account/reset?market=${marketType}&strategy=${strategyType}`,
        {},
      )
      setPaperAccount(nextPaperAccount)
      setLastUpdate(new Date())
      await loadData()
    } catch (err) {
      console.error('Failed to reset paper account:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset paper account')
    }
  }, [api, loadData, marketType, strategyType])

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
        strategyType,
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
            case 'paperAccount':
              setPaperAccount(typedData.payload as PaperAccount)
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
  }, [api, marketType, strategyType])

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
    watchlist,
    paperAccount,
    isLoading,
    error,
    lastUpdate,
    marketType,
    setMarketType,
    strategyType,
    setStrategyType,
    selectedSymbol,
    setSelectedSymbol,
    refresh,
    acknowledgeAlert,
    reviewSignal,
    toggleWatchlistSymbol,
    isWatchlistSymbol,
    addWatchlistSymbol,
    setAutoTradingEnabled,
    resetPaperAccount,
  }

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

// Re-export types for convenience
export type { Market, Position, Signal, Agent, PortfolioMetrics } from '../types'
