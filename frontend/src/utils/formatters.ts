import type { DisplayMarket } from './market'

const getLocale = (marketType: DisplayMarket): string => marketType === 'A' ? 'zh-CN' : 'en-US'
const getCurrency = (marketType: DisplayMarket): string => marketType === 'A' ? 'CNY' : 'USD'

export const formatCurrency = (value: number, compact = false, marketType: DisplayMarket = 'US'): string => {
  if (marketType === 'A' && compact && Math.abs(value) >= 100000000) {
    return `¥${(value / 100000000).toFixed(2)}亿`
  }
  if (marketType === 'A' && compact && Math.abs(value) >= 10000) {
    return `¥${(value / 10000).toFixed(1)}万`
  }
  if (marketType === 'A') {
    return new Intl.NumberFormat(getLocale(marketType), {
      style: 'currency',
      currency: getCurrency(marketType),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }
  if (compact && Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  }
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat(getLocale(marketType), {
    style: 'currency',
    currency: getCurrency(marketType),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export const formatPercent = (value: number, showSign = true): string => {
  const prefix = showSign && value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(2)}%`
}

export const formatNumber = (value: number, compact = false, marketType: DisplayMarket = 'US'): string => {
  if (marketType === 'A' && compact && Math.abs(value) >= 100000000) {
    return `${(value / 100000000).toFixed(1)}亿`
  }
  if (marketType === 'A' && compact && Math.abs(value) >= 10000) {
    return `${(value / 10000).toFixed(1)}万`
  }
  if (marketType === 'A') {
    return new Intl.NumberFormat(getLocale(marketType)).format(value)
  }
  if (compact && Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (compact && Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat(getLocale(marketType)).format(value)
}

export const formatDate = (date: Date | string, marketType: DisplayMarket = 'US'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  if (marketType === 'A') {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    }).format(d)
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(d)
}

export const formatTime = (date: Date | string, marketType: DisplayMarket = 'US'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(getLocale(marketType), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: marketType !== 'A',
  }).format(d)
}

export const formatDateTime = (date: Date | string, marketType: DisplayMarket = 'US'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat(getLocale(marketType), {
    month: marketType === 'A' ? 'numeric' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: marketType !== 'A',
  }).format(d)
}

export const formatRelativeTime = (date: Date | string, marketType: DisplayMarket = 'US'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (marketType === 'A') {
    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    return formatDate(d, marketType)
  }

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(d, marketType)
}

export const formatPriceChange = (value: number, price: number): string => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${formatCurrency(value)} (${formatPercent((value / price) * 100)})`
}
