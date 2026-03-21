import type { OHLCV, MACDData } from '../types'

/**
 * 计算简单移动平均线 (SMA)
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    }
  }
  return result
}

/**
 * 计算指数移动平均线 (EMA)
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  const multiplier = 2 / (period + 1)
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else if (i === period - 1) {
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0)
      result.push(sum / period)
    } else {
      const prevEma = result[i - 1] as number
      result.push((data[i] - prevEma) * multiplier + prevEma)
    }
  }
  return result
}

/**
 * 计算布林带 (BOLL)
 */
export function calculateBOLL(
  data: number[],
  period: number = 20,
  stdDev: number = 2
): { upper: (number | null)[]; middle: (number | null)[]; lower: (number | null)[] } {
  const middle = calculateSMA(data, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      upper.push(null)
      lower.push(null)
    } else {
      const slice = data.slice(i - period + 1, i + 1)
      const mean = middle[i] as number
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period
      const std = Math.sqrt(variance)
      upper.push(mean + stdDev * std)
      lower.push(mean - stdDev * std)
    }
  }

  return { upper, middle, lower }
}

/**
 * 计算RSI
 */
export function calculateRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = []
  const gains: number[] = []
  const losses: number[] = []

  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }

  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      result.push(null)
    } else if (i === period) {
      const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
      const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
      result.push(100 - 100 / (1 + rs))
    } else {
      const prevRsi = result[i - 1] as number
      const prevAvgGain = (prevRsi * (period - 1) + gains[i - 1]) / period
      const prevAvgLoss = (prevRsi * (period - 1) + losses[i - 1]) / period
      const rs = prevAvgLoss === 0 ? 100 : prevAvgGain / prevAvgLoss
      result.push(100 - 100 / (1 + rs))
    }
  }

  return result
}

/**
 * 计算MACD
 */
export function calculateMACD(
  data: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDData[] {
  const fastEMA = calculateEMA(data, fastPeriod)
  const slowEMA = calculateEMA(data, slowPeriod)
  
  const macdLine: number[] = []
  for (let i = 0; i < data.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macdLine.push(0)
    } else {
      macdLine.push(fastEMA[i] as number - (slowEMA[i] as number))
    }
  }

  const signalLine = calculateEMA(macdLine, signalPeriod)
  
  const result: MACDData[] = []
  for (let i = 0; i < data.length; i++) {
    const macd = macdLine[i]
    const signal = signalLine[i]
    result.push({
      time: i,
      macd,
      signal: signal || 0,
      histogram: macd - (signal || 0),
    })
  }

  return result
}

/**
 * 计算KDJ
 */
export function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 9,
  kPeriod: number = 3,
  dPeriod: number = 3
): { k: number[]; d: number[]; j: number[] } {
  const rsv: number[] = []
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      rsv.push(50)
    } else {
      const highSlice = highs.slice(i - period + 1, i + 1)
      const lowSlice = lows.slice(i - period + 1, i + 1)
      const highestHigh = Math.max(...highSlice)
      const lowestLow = Math.min(...lowSlice)
      const rsvValue = highestHigh === lowestLow 
        ? 50 
        : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100
      rsv.push(rsvValue)
    }
  }

  const k: number[] = []
  const d: number[] = []
  const j: number[] = []

  for (let i = 0; i < rsv.length; i++) {
    if (i === 0) {
      k.push(50)
      d.push(50)
    } else {
      const kValue = (k[i - 1] * (kPeriod - 1) + rsv[i]) / kPeriod
      k.push(kValue)
      const dValue = (d[i - 1] * (dPeriod - 1) + kValue) / dPeriod
      d.push(dValue)
    }
    j.push(3 * k[i] - 2 * d[i])
  }

  return { k, d, j }
}

/**
 * 从OHLCV数据提取收盘价数组
 */
export function extractCloses(data: OHLCV[]): number[] {
  return data.map(d => d.close)
}

/**
 * 从OHLCV数据提取最高价数组
 */
export function extractHighs(data: OHLCV[]): number[] {
  return data.map(d => d.high)
}

/**
 * 从OHLCV数据提取最低价数组
 */
export function extractLows(data: OHLCV[]): number[] {
  return data.map(d => d.low)
}

/**
 * 从OHLCV数据提取成交量数组
 */
export function extractVolumes(data: OHLCV[]): number[] {
  return data.map(d => d.volume)
}
