import React from 'react'
import { createContext, useContext, useEffect, useState } from 'react'
import { Settings, getSettings } from '../lib/settings'

// Types
export interface Market {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high24h: number
  low24h: number
}

export interface Position {
  symbol: string
  quantity: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  marketValue: number
}

export interface Signal {
  id: string
  symbol: string
  type: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  entryPrice: number
  targetPrice: number
  stopLoss: number
  rationale: string
  timestamp: Date
  status: 'PENDING' | 'APPROVED' | 'EXECUTED' | 'REJECTED'
}

export interface Agent {
  name: string
  role: string
  status: 'idle' | 'running' | 'error'
  lastActivity: Date
  taskCount: number
}

export interface PortfolioMetrics {
  totalValue: number
  cashBalance: number
  dayPnl: number
  dayPnlPercent: number
  totalPnl: number
  totalPnlPercent: number
  positions: Position[]
  recentSignals: Signal[]
  agents: Agent[]
}

// API Client
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

  // WebSocket connection for real-time updates
  connectWebSocket(onMessage: (data: unknown) => void): WebSocket {
    const ws = new WebSocket(`ws://localhost:8000/ws`)
    ws.onmessage = (event) => onMessage(JSON.parse(event.data))
    return ws
  }
}

// Context
interface AppContextType {
  portfolio: PortfolioMetrics | null
  markets: Market[]
  signals: Signal[]
  agents: Agent[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const AppContext = createContext<AppContextType | null>(null)

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}

// Provider
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setPortfolio] = useState<PortfolioMetrics | null>(null)
  const [markets, setMarkets] = useState<Market[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const api = new ApiClient()

  const refresh = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [portfolioData, marketsData, signalsData, agentsData] = await Promise.all([
        api.get<PortfolioMetrics>('/api/portfolio'),
        api.get<Market[]>('/api/markets'),
        api.get<Signal[]>('/api/signals'),
        api.get<Agent[]>('/api/agents'),
      ])
      setPortfolio(portfolioData)
      setMarkets(marketsData)
      setSignals(signalsData)
      setAgents(agentsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()

    // WebSocket for real-time updates
    const ws = api.connectWebSocket((data: unknown) => {
      if (data.type === 'portfolio') setPortfolio(data.payload)
      else if (data.type === 'markets') setMarkets(data.payload)
      else if (data.type === 'signals') setSignals(prev => [data.payload, ...prev])
      else if (data.type === 'agents') setAgents(data.payload)
    })

    return () => ws.close()
  }, [])

  return (
    <AppContext.Provider value={{ portfolio, markets, signals, agents, isLoading, error, refresh }}>
      {children}
    </AppContext.Provider>
  )
}
