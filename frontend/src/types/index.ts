// ============================================================
// Market Data Types
// ============================================================

export interface Market {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  volume: number
  high24h: number
  low24h: number
  open: number
  previousClose: number
  pe?: number
  pb?: number
  turnoverRate?: number
  amplitude?: number
  high52w?: number
  low52w?: number
  marketCap?: number
}

// ============================================================
// OHLCV & Chart Types
// ============================================================

export type ChartInterval = '1m' | '5m' | '15m' | '30m' | '60m' | '1d' | '1w' | '1M'

export interface OHLCV {
  time: string | number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IntradayPoint {
  time: string
  price: number
  volume: number
  avgPrice: number
}

export interface DepthLevel {
  price: number
  quantity: number
  total?: number
}

export interface MarketDepth {
  symbol: string
  bids: DepthLevel[]
  asks: DepthLevel[]
  timestamp: Date | string
}

export interface Tick {
  id: string
  symbol: string
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  timestamp: Date | string
}

// ============================================================
// Technical Indicator Types
// ============================================================

export type IndicatorType = 'MA' | 'EMA' | 'BOLL' | 'RSI' | 'MACD' | 'KDJ' | 'VOL'

export interface IndicatorConfig {
  type: IndicatorType
  params: number[]
  visible: boolean
}

export interface MACDData {
  time: string | number
  macd: number
  signal: number
  histogram: number
}

export interface RSIData {
  time: string | number
  value: number
}

// ============================================================
// News & Alert Types
// ============================================================

export interface NewsItem {
  id: string
  title: string
  summary?: string
  source: string
  url?: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number
  relatedSymbols: string[]
  timestamp: Date | string
}

export interface PriceAlert {
  id: string
  symbol: string
  condition: 'above' | 'below'
  targetPrice: number
  currentPrice: number
  triggered: boolean
  createdAt: Date | string
  triggeredAt?: Date | string
}

// ============================================================
// Watchlist Types
// ============================================================

export interface WatchlistItem {
  symbol: string
  addedAt: Date | string
  notes?: string
  tags?: string[]
}

export interface Watchlist {
  id: string
  name: string
  items: WatchlistItem[]
  createdAt: Date | string
}

// ============================================================
// Portfolio Types
// ============================================================

export interface Position {
  symbol: string
  name: string
  quantity: number
  avgPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  marketValue: number
  weight: number
  dayChange: number
  dayChangePercent: number
  sector?: string
}

export interface PortfolioMetrics {
  totalValue: number
  cashBalance: number
  investedValue: number
  dayPnl: number
  dayPnlPercent: number
  weekPnl: number
  weekPnlPercent: number
  monthPnl: number
  monthPnlPercent: number
  totalPnl: number
  totalPnlPercent: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  positions: Position[]
}

export interface HistoricalDataPoint {
  date: string
  value: number
  benchmark?: number
  pnl?: number
}

export interface DailyHistoryPoint {
  time: string
  pnl: number
  trades?: number
}

// ============================================================
// Signal Types
// ============================================================

export type SignalType = 'BUY' | 'SELL' | 'HOLD'
export type SignalStatus = 'PENDING' | 'APPROVED' | 'EXECUTING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED'

export interface Signal {
  id: string
  symbol: string
  type: SignalType
  confidence: number
  entryPrice: number
  targetPrice: number
  stopLoss: number
  rationale: string
  timestamp: Date | string
  status: SignalStatus
  agentSource: string
  riskScore?: number
  expectedReturn?: number
  quantity?: number
}

// ============================================================
// Agent Types
// ============================================================

export type AgentStatus = 'idle' | 'running' | 'error' | 'paused'
export type AgentRole = 'researcher' | 'strategist' | 'risk_manager' | 'executor' | 'coordinator'

export interface Agent {
  id: string
  name: string
  role: AgentRole
  status: AgentStatus
  lastActivity: Date | string
  taskCount: number
  successRate: number
  currentTask?: string
  description: string
}

export interface AgentLog {
  id: string
  agentId: string
  agentName: string
  timestamp: Date | string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  details?: Record<string, unknown>
}

// ============================================================
// Trade Types
// ============================================================

export type TradeSide = 'BUY' | 'SELL'
export type TradeStatus = 'PENDING' | 'FILLED' | 'PARTIAL' | 'CANCELLED' | 'REJECTED'

export interface Trade {
  id: string
  symbol: string
  side: TradeSide
  quantity: number
  price: number
  totalValue: number
  status: TradeStatus
  timestamp: Date | string
  commission: number
  slippage: number
  signalId?: string
}

// ============================================================
// Risk Types
// ============================================================

export interface RiskMetrics {
  var95: number // Value at Risk (95%)
  var99: number // Value at Risk (99%)
  maxDrawdown: number
  volatility: number
  beta: number
  concentrationRisk: number
  liquidityRisk: number
  overallRiskScore: number // 1-10
}

export interface RiskAlert {
  id: string
  type: 'concentration' | 'drawdown' | 'volatility' | 'liquidity' | 'custom'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  timestamp: Date | string
  acknowledged: boolean
  details?: Record<string, unknown>
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

export interface WebSocketMessage {
  type: 'portfolio' | 'markets' | 'signals' | 'agents' | 'trades' | 'risk' | 'logs'
  payload: unknown
  timestamp: string
}

// ============================================================
// Dashboard State Types
// ============================================================

export interface DashboardState {
  portfolio: PortfolioMetrics | null
  markets: Market[]
  signals: Signal[]
  agents: Agent[]
  trades: Trade[]
  riskMetrics: RiskMetrics | null
  alerts: RiskAlert[]
  logs: AgentLog[]
  isLoading: boolean
  error: string | null
  lastUpdate: Date | null
}
