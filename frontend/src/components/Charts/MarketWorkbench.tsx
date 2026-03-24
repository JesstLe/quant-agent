import { useEffect, useRef, useState } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineStyle,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineWidth,
  type MouseEventParams,
  type PriceLineOptions,
  type UTCTimestamp,
} from 'lightweight-charts'

import { useApp } from '../../hooks/useApp'
import type {
  ChartInterval,
  ChartSnapshot,
  IndicatorType,
  IntradayPoint,
  KDJData,
  MACDData,
  NewsItem,
  OHLCV,
} from '../../types'
import { formatCurrency, formatNumber, formatPercent, formatRelativeTime, formatTime } from '../../utils/formatters'
import { getDashboardCopy, getSignedFillColor, getSignedTextClass } from '../../utils/market'

const PANEL_BACKGROUND = '#161B22'
const BORDER = '#21262D'
const TEXT = '#E6EDF3'
const INFO = '#58A6FF'
const ACCENT = '#F59E0B'
const PURPLE = '#A855F7'
const TEAL = '#14B8A6'

const INTERVALS: ChartInterval[] = ['1m', '5m', '15m', '30m', '60m', '1d', '1w', '1M']
const OVERLAY_OPTIONS: Array<{ type: IndicatorType; label: string }> = [
  { type: 'MA', label: 'MA' },
  { type: 'EMA', label: 'EMA' },
  { type: 'BOLL', label: 'BOLL' },
  { type: 'VOL', label: 'VOL' },
]
const OSCILLATOR_OPTIONS: Array<{ type: 'RSI' | 'MACD' | 'KDJ'; label: string }> = [
  { type: 'RSI', label: 'RSI' },
  { type: 'MACD', label: 'MACD' },
  { type: 'KDJ', label: 'KDJ' },
]

type ChartView = 'candles' | 'intraday'
type ViewportPreset = '5D' | '1M' | '3M' | '6M' | '1Y' | '3Y' | '5Y' | '10Y' | 'ALL'

interface HoverSnapshot {
  label: string
  price: number
  open?: number
  high?: number
  low?: number
  close?: number
  avgPrice?: number
  volume?: number
}

interface ActivityItem {
  id: string
  title: string
  subtitle?: string
  timestamp: string | Date
  badge?: string
  tone: 'neutral' | 'success' | 'warning' | 'info'
}

function toChartTime(time: string | number): UTCTimestamp {
  return Number(time) as UTCTimestamp
}

function fromChartTime(time: string | number, marketType: 'A' | 'US', interval: ChartInterval, view: ChartView): string {
  const date = new Date(Number(time) * 1000)
  const locale = marketType === 'A' ? 'zh-CN' : 'en-US'
  const isIntraday = view === 'intraday' || ['1m', '5m', '15m', '30m', '60m'].includes(interval)
  return new Intl.DateTimeFormat(locale, isIntraday ? {
    year: 'numeric',
    month: marketType === 'A' ? 'numeric' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: marketType !== 'A',
  } : {
    year: 'numeric',
    month: marketType === 'A' ? 'numeric' : 'short',
    day: 'numeric',
  }).format(date)
}

function formatAxisTick(time: string | number, marketType: 'A' | 'US', interval: ChartInterval, view: ChartView): string {
  const date = new Date(Number(time) * 1000)
  const locale = marketType === 'A' ? 'zh-CN' : 'en-US'
  const isIntraday = view === 'intraday' || ['1m', '5m', '15m', '30m', '60m'].includes(interval)
  return new Intl.DateTimeFormat(locale, isIntraday ? {
    hour: '2-digit',
    minute: '2-digit',
    hour12: marketType !== 'A',
  } : {
    year: marketType === 'A' ? '2-digit' : 'numeric',
    month: marketType === 'A' ? 'numeric' : 'short',
    day: 'numeric',
  }).format(date)
}

function getViewportOptions(
  marketType: 'A' | 'US',
  interval: ChartInterval,
  view: ChartView,
): Array<{ key: ViewportPreset; label: string; bars?: number }> {
  if (view !== 'candles') {
    return []
  }

  if (interval === '1d') {
    return [
      { key: '5D', label: marketType === 'A' ? '5日' : '5D', bars: 5 },
      { key: '1M', label: marketType === 'A' ? '1月' : '1M', bars: 22 },
      { key: '3M', label: marketType === 'A' ? '3月' : '3M', bars: 66 },
      { key: '6M', label: marketType === 'A' ? '6月' : '6M', bars: 132 },
      { key: '1Y', label: marketType === 'A' ? '1年' : '1Y', bars: 252 },
      { key: 'ALL', label: marketType === 'A' ? '全部' : 'ALL' },
    ]
  }

  if (interval === '1w') {
    return [
      { key: '3M', label: marketType === 'A' ? '3月' : '3M', bars: 13 },
      { key: '6M', label: marketType === 'A' ? '6月' : '6M', bars: 26 },
      { key: '1Y', label: marketType === 'A' ? '1年' : '1Y', bars: 52 },
      { key: '3Y', label: marketType === 'A' ? '3年' : '3Y', bars: 156 },
      { key: '5Y', label: marketType === 'A' ? '5年' : '5Y', bars: 260 },
      { key: 'ALL', label: marketType === 'A' ? '全部' : 'ALL' },
    ]
  }

  if (interval === '1M') {
    return [
      { key: '1Y', label: marketType === 'A' ? '1年' : '1Y', bars: 12 },
      { key: '3Y', label: marketType === 'A' ? '3年' : '3Y', bars: 36 },
      { key: '5Y', label: marketType === 'A' ? '5年' : '5Y', bars: 60 },
      { key: '10Y', label: marketType === 'A' ? '10年' : '10Y', bars: 120 },
      { key: 'ALL', label: marketType === 'A' ? '全部' : 'ALL' },
    ]
  }

  return []
}

function defaultViewportPreset(interval: ChartInterval, view: ChartView): ViewportPreset {
  if (view !== 'candles') {
    return 'ALL'
  }
  if (interval === '1d') {
    return '6M'
  }
  if (interval === '1w') {
    return '1Y'
  }
  if (interval === '1M') {
    return '3Y'
  }
  return 'ALL'
}

function applyViewportPreset(
  chart: IChartApi,
  dataLength: number,
  preset: ViewportPreset,
  options: Array<{ key: ViewportPreset; label: string; bars?: number }>,
) {
  if (dataLength <= 0) {
    return
  }

  const target = options.find((option) => option.key === preset)
  if (!target || target.bars === undefined) {
    chart.timeScale().fitContent()
    return
  }

  const bars = Math.min(target.bars, dataLength)
  const from = Math.max(0, dataLength - bars) - 0.5
  const to = dataLength - 0.5
  chart.timeScale().setVisibleLogicalRange({ from, to })
}

function createPanelChart(
  container: HTMLDivElement,
  {
    height,
    showTimeScale,
    marketType,
    interval,
    view,
  }: {
    height: number
    showTimeScale: boolean
    marketType: 'A' | 'US'
    interval: ChartInterval
    view: ChartView
  },
): IChartApi {
  return createChart(container, {
    width: container.clientWidth || 400,
    height,
    layout: {
      background: { type: ColorType.Solid, color: PANEL_BACKGROUND },
      textColor: TEXT,
      attributionLogo: false,
    },
    localization: {
      locale: marketType === 'A' ? 'zh-CN' : 'en-US',
      dateFormat: marketType === 'A' ? 'yyyy-MM-dd' : "dd MMM 'yy",
      timeFormatter: (time: string | number) => fromChartTime(time, marketType, interval, view),
    },
    grid: {
      vertLines: { color: BORDER },
      horzLines: { color: BORDER },
    },
    rightPriceScale: {
      borderColor: BORDER,
      scaleMargins: { top: 0.08, bottom: 0.1 },
    },
    timeScale: {
      borderColor: BORDER,
      timeVisible: true,
      secondsVisible: false,
      visible: showTimeScale,
      tickMarkFormatter: (time: string | number) => formatAxisTick(time, marketType, interval, view),
    },
    crosshair: {
      vertLine: { color: '#475569', style: LineStyle.Dotted },
      horzLine: { color: '#475569', style: LineStyle.Dotted },
    },
    handleScale: {
      mouseWheel: false,
      pinch: false,
      axisPressedMouseMove: false,
      axisDoubleClickReset: false,
    },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: false,
      horzTouchDrag: false,
      vertTouchDrag: false,
    },
  })
}

function syncVisibleRange(sourceChart: IChartApi, targetCharts: IChartApi[]) {
  const sync = (range: { from: number; to: number } | null) => {
    if (!range) {
      return
    }
    for (const chart of targetCharts) {
      chart.timeScale().setVisibleLogicalRange(range)
    }
  }
  sourceChart.timeScale().subscribeVisibleLogicalRangeChange(sync)
  return () => sourceChart.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
}

function buildHistogramColors(data: OHLCV[], marketType: 'A' | 'US') {
  return data.map((point) => ({
    time: toChartTime(point.time),
    value: point.volume,
    color: getSignedFillColor(point.close - point.open, marketType),
  }))
}

function buildIntradayVolume(points: IntradayPoint[], marketType: 'A' | 'US') {
  return points.map((point, index) => {
    const previousPrice = index > 0 ? points[index - 1]?.price ?? point.price : point.price
    return {
      time: toChartTime(point.time),
      value: point.volume,
      color: getSignedFillColor(point.price - previousPrice, marketType),
    }
  })
}

function buildMacdHistogram(data: MACDData[], marketType: 'A' | 'US') {
  return data.map((point) => ({
    time: toChartTime(point.time),
    value: point.histogram,
    color: getSignedFillColor(point.histogram, marketType),
  }))
}

function applyOverlaySeries(
  chart: IChartApi,
  payload: ChartSnapshot,
  activeOverlays: IndicatorType[],
) {
  const addLine = (
    data: Array<{ time: string | number; value: number }>,
    color: string,
    lineWidth: LineWidth = 2,
  ) => {
    const series = chart.addSeries(LineSeries, {
      color,
      lineWidth,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    })
    series.setData(data.map((point) => ({ time: toChartTime(point.time), value: point.value })))
  }

  if (activeOverlays.includes('MA')) {
    addLine(payload.indicators.overlays.MA.ma5, '#F59E0B')
    addLine(payload.indicators.overlays.MA.ma10, '#8B5CF6')
    addLine(payload.indicators.overlays.MA.ma20, '#3B82F6')
  }

  if (activeOverlays.includes('EMA')) {
    addLine(payload.indicators.overlays.EMA.ema12, '#10B981')
    addLine(payload.indicators.overlays.EMA.ema26, '#F97316')
  }

  if (activeOverlays.includes('BOLL')) {
    addLine(payload.indicators.overlays.BOLL.upper, '#94A3B8', 1)
    addLine(payload.indicators.overlays.BOLL.middle, '#EAB308', 1)
    addLine(payload.indicators.overlays.BOLL.lower, '#94A3B8', 1)
  }
}

function addManagementPriceLine(
  series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'>,
  options: {
    price: number
    title: string
    color: string
    lineStyle?: PriceLineOptions['lineStyle']
  },
) {
  if (!Number.isFinite(options.price) || options.price <= 0) {
    return
  }
  series.createPriceLine({
    price: options.price,
    color: options.color,
    lineWidth: 1,
    lineStyle: options.lineStyle ?? LineStyle.Solid,
    axisLabelVisible: true,
    title: options.title,
  })
}

function renderOscillator(
  chart: IChartApi,
  payload: ChartSnapshot,
  oscillator: 'RSI' | 'MACD' | 'KDJ' | null,
  marketType: 'A' | 'US',
) {
  if (!oscillator) {
    return
  }

  if (oscillator === 'RSI') {
    const rsiSeries = chart.addSeries(LineSeries, {
      color: INFO,
      lineWidth: 2,
      priceLineVisible: false,
    })
    rsiSeries.setData(payload.indicators.oscillators.RSI.map((point) => ({
      time: toChartTime(point.time),
      value: point.value,
    })))
    return
  }

  if (oscillator === 'MACD') {
    const histogram = chart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    })
    histogram.setData(buildMacdHistogram(payload.indicators.oscillators.MACD, marketType))

    const macdLine = chart.addSeries(LineSeries, {
      color: INFO,
      lineWidth: 2,
      priceLineVisible: false,
    })
    macdLine.setData(payload.indicators.oscillators.MACD.map((point) => ({
      time: toChartTime(point.time),
      value: point.macd,
    })))

    const signalLine = chart.addSeries(LineSeries, {
      color: ACCENT,
      lineWidth: 2,
      priceLineVisible: false,
    })
    signalLine.setData(payload.indicators.oscillators.MACD.map((point) => ({
      time: toChartTime(point.time),
      value: point.signal,
    })))
    return
  }

  const kSeries = chart.addSeries(LineSeries, {
    color: INFO,
    lineWidth: 2,
    priceLineVisible: false,
  })
  const dSeries = chart.addSeries(LineSeries, {
    color: ACCENT,
    lineWidth: 2,
    priceLineVisible: false,
  })
  const jSeries = chart.addSeries(LineSeries, {
    color: PURPLE,
    lineWidth: 1,
    priceLineVisible: false,
  })
  const kdj = payload.indicators.oscillators.KDJ as KDJData[]
  kSeries.setData(kdj.map((point) => ({ time: toChartTime(point.time), value: point.k })))
  dSeries.setData(kdj.map((point) => ({ time: toChartTime(point.time), value: point.d })))
  jSeries.setData(kdj.map((point) => ({ time: toChartTime(point.time), value: point.j })))
}

function EmptyWorkbench({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-dark-border bg-dark-card">
      <div className="border-b border-dark-border px-4 py-3">
        <h2 className="text-sm font-semibold text-dark-text">{title}</h2>
      </div>
      <div className="flex h-[540px] items-center justify-center px-4 text-sm text-dark-muted">
        {message}
      </div>
    </div>
  )
}

function HoverBar({
  hover,
  marketType,
}: {
  hover: HoverSnapshot | null
  marketType: 'A' | 'US'
}) {
  if (!hover) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-dark-border bg-dark-hover/40 px-3 py-2 text-xs">
      <span className="text-dark-muted">{hover.label}</span>
      {hover.open !== undefined && <span className="text-dark-text">O {formatCurrency(hover.open, false, marketType)}</span>}
      {hover.high !== undefined && <span className="text-dark-text">H {formatCurrency(hover.high, false, marketType)}</span>}
      {hover.low !== undefined && <span className="text-dark-text">L {formatCurrency(hover.low, false, marketType)}</span>}
      {hover.close !== undefined && <span className="text-dark-text">C {formatCurrency(hover.close, false, marketType)}</span>}
      {hover.avgPrice !== undefined && <span className="text-warning">AVG {formatCurrency(hover.avgPrice, false, marketType)}</span>}
      {hover.volume !== undefined && <span className="text-dark-muted">VOL {formatNumber(hover.volume, true, marketType)}</span>}
    </div>
  )
}

function SymbolStrip({
  selectedSymbol,
  setSelectedSymbol,
  markets,
}: {
  selectedSymbol: string
  setSelectedSymbol: (symbol: string) => void
  markets: Array<{ symbol: string; name: string }>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {markets.map((market) => (
        <button
          key={market.symbol}
          onClick={() => setSelectedSymbol(market.symbol)}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            selectedSymbol === market.symbol
              ? 'border-info/50 bg-info/10 text-dark-text'
              : 'border-dark-border bg-dark-hover text-dark-muted hover:text-dark-text'
          }`}
        >
          <div className="text-xs font-medium">{market.symbol}</div>
          <div className="mt-0.5 text-[11px]">{market.name}</div>
        </button>
      ))}
    </div>
  )
}

function ChartControls({
  copy,
  marketType,
  interval,
  setInterval,
  view,
  setView,
  viewportPreset,
  setViewportPreset,
  activeOverlays,
  toggleOverlay,
  activeOscillator,
  setActiveOscillator,
}: {
  copy: ReturnType<typeof getDashboardCopy>
  marketType: 'A' | 'US'
  interval: ChartInterval
  setInterval: (interval: ChartInterval) => void
  view: ChartView
  setView: (view: ChartView) => void
  viewportPreset: ViewportPreset
  setViewportPreset: (preset: ViewportPreset) => void
  activeOverlays: IndicatorType[]
  toggleOverlay: (indicator: IndicatorType) => void
  activeOscillator: 'RSI' | 'MACD' | 'KDJ' | null
  setActiveOscillator: (value: 'RSI' | 'MACD' | 'KDJ' | null) => void
}) {
  const viewportOptions = getViewportOptions(marketType, interval, view)

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dark-border bg-dark-hover/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-dark-card p-1">
          <button
            onClick={() => setView('intraday')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'intraday' ? 'bg-info/20 text-info' : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            {copy.intradayView}
          </button>
          <button
            onClick={() => setView('candles')}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'candles' ? 'bg-info/20 text-info' : 'text-dark-muted hover:text-dark-text'
            }`}
          >
            {copy.chartView}
          </button>
        </div>
        <span className="ml-2 text-xs uppercase tracking-[0.16em] text-dark-muted">{copy.interval}</span>
        <div className="flex flex-wrap gap-2">
          {INTERVALS.map((item) => (
            <button
              key={item}
              onClick={() => setInterval(item)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                interval === item ? 'bg-info/20 text-info' : 'bg-dark-card text-dark-muted hover:text-dark-text'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {viewportOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs uppercase tracking-[0.16em] text-dark-muted">
            {marketType === 'A' ? '视窗' : 'Range'}
          </span>
          <div className="flex flex-wrap gap-2">
            {viewportOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setViewportPreset(option.key)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  viewportPreset === option.key
                    ? 'bg-warning/20 text-warning'
                    : 'bg-dark-card text-dark-muted hover:text-dark-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs uppercase tracking-[0.16em] text-dark-muted">{copy.indicators}</span>
        <div className="flex flex-wrap gap-2">
          {OVERLAY_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => toggleOverlay(option.type)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeOverlays.includes(option.type)
                  ? 'bg-info/20 text-info'
                  : 'bg-dark-card text-dark-muted hover:text-dark-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-dark-border" />
        <div className="flex flex-wrap gap-2">
          {OSCILLATOR_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => setActiveOscillator(activeOscillator === option.type ? null : option.type)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                activeOscillator === option.type
                  ? 'bg-warning/20 text-warning'
                  : 'bg-dark-card text-dark-muted hover:text-dark-text'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function NewsPanel({
  title,
  newsItems,
  marketType,
  noNews,
  sentimentLabel,
  openLabel,
  moreLabel,
  onMore,
}: {
  title: string
  newsItems: NewsItem[]
  marketType: 'A' | 'US'
  noNews: string
  sentimentLabel: string
  openLabel: string
  moreLabel: string
  onMore: () => void
}) {
  const previewItems = newsItems.slice(0, 3)
  const sentimentClass = (sentiment: NewsItem['sentiment']) => {
    if (sentiment === 'positive') return 'text-profit'
    if (sentiment === 'negative') return 'text-loss'
    return 'text-warning'
  }

  const sentimentText = (sentiment: NewsItem['sentiment']) => {
    const copy = getDashboardCopy(marketType)
    if (sentiment === 'positive') return copy.sentimentPositive
    if (sentiment === 'negative') return copy.sentimentNegative
    return copy.sentimentNeutral
  }

  return (
    <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
        <span className="text-xs uppercase tracking-[0.14em] text-dark-muted">{sentimentLabel}</span>
      </div>
      {newsItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-dark-muted">{noNews}</div>
      ) : (
        <div className="space-y-3 overflow-hidden">
          {previewItems.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-dark-border bg-dark-card/60 px-3 py-2 transition-colors hover:bg-dark-card"
            >
              <div className="line-clamp-2 text-sm font-medium text-dark-text">{item.title}</div>
              {item.summary ? (
                <div className="mt-2 line-clamp-3 text-xs leading-5 text-dark-muted">{item.summary}</div>
              ) : null}
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-dark-muted">{item.source}</span>
                <span className="text-dark-muted">{formatRelativeTime(item.timestamp, marketType)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className={`text-xs font-medium ${sentimentClass(item.sentiment)}`}>
                  {sentimentText(item.sentiment)} ({item.sentimentScore >= 0 ? '+' : ''}{item.sentimentScore.toFixed(2)})
                </div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-info">
                  {openLabel}
                </div>
              </div>
            </a>
          ))}
          {newsItems.length > previewItems.length ? (
            <button
              type="button"
              onClick={onMore}
              className="flex w-full items-center justify-center rounded-lg border border-dark-border bg-dark-card/50 px-3 py-2 text-sm font-medium text-info transition-colors hover:bg-dark-card"
            >
              {moreLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function NewsCenterOverlay({
  title,
  marketType,
  newsItems,
  openLabel,
  closeLabel,
  noNews,
  onClose,
}: {
  title: string
  marketType: 'A' | 'US'
  newsItems: NewsItem[]
  openLabel: string
  closeLabel: string
  noNews: string
  onClose: () => void
}) {
  const copy = getDashboardCopy(marketType)

  const sentimentClass = (sentiment: NewsItem['sentiment']) => {
    if (sentiment === 'positive') return 'text-profit'
    if (sentiment === 'negative') return 'text-loss'
    return 'text-warning'
  }

  const sentimentText = (sentiment: NewsItem['sentiment']) => {
    if (sentiment === 'positive') return copy.sentimentPositive
    if (sentiment === 'negative') return copy.sentimentNegative
    return copy.sentimentNeutral
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-dark-border bg-dark-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-dark-border px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-dark-text">{title}</h2>
            <div className="mt-1 text-xs uppercase tracking-[0.14em] text-dark-muted">{newsItems.length}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-dark-border bg-dark-hover px-3 py-2 text-sm font-medium text-dark-text transition-colors hover:bg-dark-card"
          >
            {closeLabel}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {newsItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-dark-muted">{noNews}</div>
          ) : (
            <div className="space-y-4">
              {newsItems.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-dark-border bg-dark-hover/40 px-4 py-4 transition-colors hover:bg-dark-hover"
                >
                  <div className="text-base font-semibold text-dark-text">{item.title}</div>
                  {item.summary ? (
                    <div className="mt-2 text-sm leading-6 text-dark-muted">{item.summary}</div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-dark-muted">{item.source}</span>
                    <span className="text-dark-muted">{formatRelativeTime(item.timestamp, marketType)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className={`text-xs font-medium ${sentimentClass(item.sentiment)}`}>
                      {sentimentText(item.sentiment)} ({item.sentimentScore >= 0 ? '+' : ''}{item.sentimentScore.toFixed(2)})
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.14em] text-info">
                      {openLabel}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TradeActivityPanel({
  title,
  items,
  marketType,
  emptyText,
}: {
  title: string
  items: ActivityItem[]
  marketType: 'A' | 'US'
  emptyText: string
}) {
  const toneStyles: Record<ActivityItem['tone'], string> = {
    neutral: 'border-dark-border bg-dark-card/60 text-dark-text',
    success: 'border-profit/30 bg-profit/10 text-profit',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    info: 'border-info/30 bg-info/10 text-info',
  }

  return (
    <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
        <span className="text-xs uppercase tracking-[0.14em] text-dark-muted">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="py-6 text-center text-sm text-dark-muted">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 8).map((item) => (
            <div key={item.id} className={`rounded-lg border px-3 py-2 ${toneStyles[item.tone]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.title}</div>
                  {item.subtitle ? (
                    <div className="mt-1 text-xs text-dark-muted">{item.subtitle}</div>
                  ) : null}
                </div>
                {item.badge ? (
                  <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-xs text-dark-muted">{formatRelativeTime(item.timestamp, marketType)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PositionManagementPanel({
  title,
  copy,
  marketType,
  signal,
  emptyText,
}: {
  title: string
  copy: ReturnType<typeof getDashboardCopy>
  marketType: 'A' | 'US'
  signal: {
    strategy?: string
    stopLoss?: number
    targetPrice?: number
    kellyFraction?: number
    cooldownUntil?: string | Date | null
    warnings?: string[]
    trailingActive?: boolean
    partialExitDone?: boolean
    holdingMinutes?: number
    timeDecayMinutes?: number
    side?: string
  } | null
  emptyText: string
}) {
  if (!signal) {
    return (
      <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
        </div>
        <div className="py-6 text-center text-sm text-dark-muted">{emptyText}</div>
      </div>
    )
  }

  const rows = [
    { label: copy.strategy, value: signal.strategy ?? '--' },
    { label: copy.protectiveStop, value: signal.stopLoss ? formatCurrency(signal.stopLoss, false, marketType) : '--' },
    { label: copy.target, value: signal.targetPrice ? formatCurrency(signal.targetPrice, false, marketType) : '--' },
    { label: copy.kelly, value: typeof signal.kellyFraction === 'number' ? `${(signal.kellyFraction * 100).toFixed(1)}%` : '--' },
    { label: copy.holdingTime, value: typeof signal.holdingMinutes === 'number' ? `${signal.holdingMinutes}m` : '--' },
    { label: copy.timeDecay, value: typeof signal.timeDecayMinutes === 'number' && signal.timeDecayMinutes > 0 ? `${signal.timeDecayMinutes}m` : '--' },
  ]

  return (
    <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
        <div className="flex flex-wrap gap-2">
          {signal.side ? (
            <span className="rounded-full border border-dark-border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-dark-muted">
              {signal.side}
            </span>
          ) : null}
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
            signal.trailingActive ? 'border-info/30 bg-info/10 text-info' : 'border-dark-border text-dark-muted'
          }`}>
            {copy.trailing}: {signal.trailingActive ? copy.armed : copy.inactive}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] ${
            signal.partialExitDone ? 'border-warning/30 bg-warning/10 text-warning' : 'border-dark-border text-dark-muted'
          }`}>
            {copy.partialExit}: {signal.partialExitDone ? copy.active : copy.standby}
          </span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border border-dark-border bg-dark-card/60 px-3 py-2">
            <div className="text-[11px] uppercase tracking-[0.14em] text-dark-muted">{row.label}</div>
            <div className="mt-1 text-sm font-medium text-dark-text">{row.value}</div>
          </div>
        ))}
      </div>
      {signal.cooldownUntil ? (
        <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          {copy.cooldown}: {formatRelativeTime(signal.cooldownUntil, marketType)}
        </div>
      ) : null}
      {signal.warnings && signal.warnings.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {signal.warnings.map((warning, index) => (
            <span
              key={`${warning}-${index}`}
              className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning"
            >
              {warning}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function WatchlistPanel({
  title,
  items,
  selectedSymbol,
  setSelectedSymbol,
  marketType,
  emptyText,
  toggleWatchlistSymbol,
  removeLabel,
  addLabel,
  inputLabel,
  inputHint,
  addWatchlistSymbol,
  suggestions,
}: {
  title: string
  items: Array<{ symbol: string; name: string; price: number; changePercent: number }>
  selectedSymbol: string | null
  setSelectedSymbol: (symbol: string) => void
  marketType: 'A' | 'US'
  emptyText: string
  toggleWatchlistSymbol: (symbol: string) => Promise<void>
  removeLabel: string
  addLabel: string
  inputLabel: string
  inputHint: string
  addWatchlistSymbol: (symbol: string) => Promise<void>
  suggestions: Array<{ symbol: string; name: string }>
}) {
  const [draft, setDraft] = useState('')

  const handleAdd = async () => {
    const next = draft.trim()
    if (!next) {
      return
    }
    await addWatchlistSymbol(next)
    setDraft('')
  }

  return (
    <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark-text">{title}</h3>
        <span className="text-xs uppercase tracking-[0.14em] text-dark-muted">{items.length}</span>
      </div>
      <div className="mb-3 space-y-2">
        <div className="text-xs uppercase tracking-[0.14em] text-dark-muted">{inputLabel}</div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleAdd()
              }
            }}
            list={`watchlist-suggestions-${marketType}`}
            placeholder={inputHint}
            className="flex-1 rounded-lg border border-dark-border bg-dark-card/70 px-3 py-2 text-sm text-dark-text outline-none transition-colors placeholder:text-dark-muted focus:border-info/60"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-sm font-medium text-info transition-colors hover:bg-info/20"
          >
            {addLabel}
          </button>
        </div>
        <datalist id={`watchlist-suggestions-${marketType}`}>
          {suggestions.map((item) => (
            <option key={item.symbol} value={item.symbol}>
              {item.name}
            </option>
          ))}
        </datalist>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-dark-border px-3 py-6 text-center text-sm text-dark-muted">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((market) => (
            <div
              key={market.symbol}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                selectedSymbol === market.symbol
                  ? 'border-info/50 bg-info/10'
                  : 'border-dark-border bg-dark-card/60 hover:bg-dark-card'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedSymbol(market.symbol)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="text-sm font-medium text-dark-text">{market.symbol}</div>
                <div className="text-xs text-dark-muted">{market.name}</div>
              </button>
              <div className="ml-3 flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm text-dark-text">{formatCurrency(market.price, false, marketType)}</div>
                  <div className={`text-xs ${getSignedTextClass(market.changePercent, marketType)}`}>
                    {formatPercent(market.changePercent)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label={removeLabel}
                  onClick={() => void toggleWatchlistSymbol(market.symbol)}
                  className="text-lg text-warning transition-colors hover:text-dark-text"
                >
                  ★
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AShareBookPanel({
  chartData,
  marketType,
  copy,
}: {
  chartData: ChartSnapshot
  marketType: 'A' | 'US'
  copy: ReturnType<typeof getDashboardCopy>
}) {
  const quote = chartData.quote

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dark-text">{copy.priceLadder}</h3>
          <span className="rounded-full border border-dark-border px-2 py-0.5 text-[11px] text-dark-muted">
            {chartData.depthMode === 'real' ? copy.realDepth : copy.estimatedDepth}
          </span>
        </div>
        <div className="space-y-2">
          {chartData.depth.asks.slice().reverse().map((level, index) => (
            <div key={`ask-${level.price}-${index}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 text-sm">
              <span className="text-dark-muted">{`卖${5 - index}`}</span>
              <span className="text-loss">{formatCurrency(level.price, false, marketType)}</span>
              <span className="text-dark-text">{formatNumber(level.quantity, false, marketType)}</span>
            </div>
          ))}
          <div className="my-2 h-px bg-dark-border" />
          <div className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-lg bg-dark-card/80 px-2 py-2 text-sm">
            <span className="text-dark-muted">{copy.buyOne}</span>
            <span className={getSignedTextClass(quote.changePercent, marketType)}>{formatCurrency(quote.price, false, marketType)}</span>
            <span className="text-dark-text">{formatNumber(chartData.depth.bids[0]?.quantity ?? 0, false, marketType)}</span>
          </div>
          <div className="my-2 h-px bg-dark-border" />
          {chartData.depth.bids.slice(1).map((level, index) => (
            <div key={`bid-${level.price}-${index}`} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 text-sm">
              <span className="text-dark-muted">{`买${index + 2}`}</span>
              <span className="text-profit">{formatCurrency(level.price, false, marketType)}</span>
              <span className="text-dark-text">{formatNumber(level.quantity, false, marketType)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dark-text">{copy.lastTrades}</h3>
          <span className="text-xs uppercase tracking-[0.14em] text-dark-muted">{copy.tickTape}</span>
        </div>
        <div className="space-y-2">
          {chartData.ticks.slice(0, 12).map((tick) => (
            <div key={tick.id} className="grid grid-cols-[58px_1fr_auto] items-center gap-3 text-sm">
              <span className="text-dark-muted">{formatTime(tick.timestamp, marketType)}</span>
              <span className={tick.side === 'BUY' ? 'text-profit' : 'text-loss'}>
                {formatCurrency(tick.price, false, marketType)}
              </span>
              <span className="text-dark-text">{formatNumber(tick.quantity, false, marketType)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuoteOverview({
  chartData,
  marketType,
  copy,
}: {
  chartData: ChartSnapshot
  marketType: 'A' | 'US'
  copy: ReturnType<typeof getDashboardCopy>
}) {
  const quote = chartData.quote
  const items = [
    { label: copy.latestPrice, value: formatCurrency(quote.price, false, marketType), highlight: true },
    { label: copy.openPrice, value: formatCurrency(quote.open, false, marketType) },
    { label: copy.highPrice, value: formatCurrency(quote.high, false, marketType) },
    { label: copy.lowPrice, value: formatCurrency(quote.low, false, marketType) },
    { label: copy.amplitude, value: formatPercent(quote.amplitude ?? 0, false) },
    { label: copy.volume, value: formatNumber(quote.volume, true, marketType) },
    { label: copy.peRatio, value: quote.pe ? quote.pe.toFixed(2) : '--' },
    { label: copy.pbRatio, value: quote.pb ? quote.pb.toFixed(2) : '--' },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-dark-border bg-dark-hover/30 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.14em] text-dark-muted">{item.label}</div>
          <div className={`mt-1 text-lg font-semibold ${item.highlight ? 'text-dark-text' : 'text-dark-text/90'}`}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function AShareQuoteRail({
  chartData,
  marketType,
  copy,
  hover,
}: {
  chartData: ChartSnapshot
  marketType: 'A' | 'US'
  copy: ReturnType<typeof getDashboardCopy>
  hover: HoverSnapshot | null
}) {
  const quote = chartData.quote
  const rows = [
    { label: copy.latestPrice, value: formatCurrency(quote.price, false, marketType), emphasize: true },
    { label: copy.openPrice, value: formatCurrency(quote.open, false, marketType) },
    { label: copy.highPrice, value: formatCurrency(quote.high, false, marketType), accent: 'text-loss' },
    { label: copy.lowPrice, value: formatCurrency(quote.low, false, marketType), accent: 'text-profit' },
    { label: copy.amplitude, value: formatPercent(quote.amplitude ?? 0, false) },
    { label: copy.volume, value: formatNumber(quote.volume, true, marketType) },
    { label: copy.peRatio, value: quote.pe ? quote.pe.toFixed(2) : '--' },
    { label: copy.pbRatio, value: quote.pb ? quote.pb.toFixed(2) : '--' },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-dark-text">{copy.quoteOverview}</h3>
          <span className={`text-xs font-medium ${getSignedTextClass(quote.changePercent, marketType)}`}>
            {formatPercent(quote.changePercent)}
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-lg border border-dark-border bg-dark-card/60 px-3 py-2"
            >
              <span className="text-xs uppercase tracking-[0.12em] text-dark-muted">{row.label}</span>
              <span
                className={[
                  row.emphasize ? `text-lg font-semibold ${getSignedTextClass(quote.changePercent, marketType)}` : 'text-sm font-medium text-dark-text',
                  row.accent ?? '',
                ].join(' ')}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
        <div className="mb-2 text-xs uppercase tracking-[0.14em] text-dark-muted">{copy.dateAxis}</div>
        <HoverBar hover={hover} marketType={marketType} />
      </div>
    </div>
  )
}

export function MarketWorkbench() {
  const {
    marketType,
    strategyType,
    markets,
    portfolio,
    signals,
    logs,
    selectedSymbol,
    setSelectedSymbol,
    watchlist,
    toggleWatchlistSymbol,
    addWatchlistSymbol,
  } = useApp()
  const copy = getDashboardCopy(marketType)
  const [interval, setInterval] = useState<ChartInterval>('1d')
  const [view, setView] = useState<ChartView>('candles')
  const [chartData, setChartData] = useState<ChartSnapshot | null>(null)
  const [newsItems, setNewsItems] = useState<NewsItem[]>([])
  const [hover, setHover] = useState<HoverSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeOverlays, setActiveOverlays] = useState<IndicatorType[]>(['MA', 'VOL'])
  const [activeOscillator, setActiveOscillator] = useState<'RSI' | 'MACD' | 'KDJ' | null>('RSI')
  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>(defaultViewportPreset('1d', 'candles'))
  const [isNewsCenterOpen, setIsNewsCenterOpen] = useState(false)

  const priceContainerRef = useRef<HTMLDivElement | null>(null)
  const volumeContainerRef = useRef<HTMLDivElement | null>(null)
  const oscillatorContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!selectedSymbol && markets[0]?.symbol) {
      setSelectedSymbol(markets[0].symbol)
    }
  }, [markets, selectedSymbol, setSelectedSymbol])

  const watchlistMarkets = watchlist
    .map((item) => {
      const market = markets.find((candidate) => candidate.symbol === item.symbol)
      if (market) {
        return market
      }
      return {
        symbol: item.symbol,
        name: item.name ?? item.symbol,
        price: 0,
        changePercent: 0,
      }
    })

  const watchlistSuggestions = markets.map((market) => ({
    symbol: market.symbol,
    name: market.name,
  }))
  const selectedPosition = portfolio?.positions.find((position) => position.symbol === selectedSymbol) ?? null
  const selectedSignal = signals.find((signal) => signal.symbol === selectedSymbol && signal.status !== 'REJECTED') ?? null
  const symbolActivityItems: ActivityItem[] = logs
    .filter((log) => String(log.message).includes(selectedSymbol ?? ''))
    .map((log) => {
      const details = (log.details ?? {}) as Record<string, unknown>
      const reason = typeof details.reason === 'string' ? details.reason : ''
      let badge = ''
      let tone: ActivityItem['tone'] = log.level === 'error' ? 'warning' : log.level === 'success' ? 'success' : 'neutral'

      if (reason === 'partial_exit') {
        badge = 'PARTIAL'
        tone = 'warning'
      } else if (reason === 'trailing_stop') {
        badge = 'TRAIL'
        tone = 'info'
      } else if (reason === 'time_decay_exit') {
        badge = 'DECAY'
        tone = 'warning'
      } else if (String(log.message).includes('Executed')) {
        badge = 'EXECUTE'
        tone = 'success'
      } else if (String(log.message).includes('Approved')) {
        badge = 'APPROVE'
        tone = 'info'
      } else if (String(log.message).includes('Generated')) {
        badge = 'SIGNAL'
        tone = 'neutral'
      }

      return {
        id: log.id,
        title: log.message,
        subtitle: reason ? `reason: ${reason}` : undefined,
        timestamp: log.timestamp,
        badge: badge || undefined,
        tone,
      }
    })
    .slice(0, 8)
  const managementState = selectedPosition
    ? {
        strategy: selectedPosition.strategy,
        stopLoss: selectedPosition.protectiveStop,
        targetPrice: selectedPosition.targetPrice,
        kellyFraction: selectedPosition.kellyFraction,
        trailingActive: selectedPosition.trailingActive,
        partialExitDone: selectedPosition.partialExitDone,
        holdingMinutes: selectedPosition.holdingMinutes,
        timeDecayMinutes: selectedPosition.timeDecayMinutes,
        side: selectedPosition.side,
      }
    : selectedSignal
      ? {
          strategy: selectedSignal.strategy,
          stopLoss: selectedSignal.stopLoss,
          targetPrice: selectedSignal.targetPrice,
          kellyFraction: selectedSignal.kellyFraction,
          cooldownUntil: selectedSignal.cooldownUntil,
          warnings: selectedSignal.warnings,
          side: selectedSignal.type,
        }
      : null

  useEffect(() => {
    if (!selectedSymbol) {
      setChartData(null)
      setNewsItems([])
      return
    }

    const controller = new AbortController()
    const load = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const chartResponse = await fetch(
          `http://localhost:8000/api/chart?market=${marketType}&strategy=${strategyType}&symbol=${encodeURIComponent(selectedSymbol)}&interval=${interval}`,
          { signal: controller.signal },
        )
        if (!chartResponse.ok) {
          throw new Error(`Chart API Error: ${chartResponse.statusText}`)
        }
        const chartPayload = await chartResponse.json() as ChartSnapshot
        setChartData(chartPayload)

        const newsResponse = await fetch(
          `http://localhost:8000/api/news?market=${marketType}&strategy=${strategyType}&symbol=${encodeURIComponent(selectedSymbol)}`,
          { signal: controller.signal },
        )
        if (newsResponse.ok) {
          const newsPayload = await newsResponse.json() as NewsItem[]
          setNewsItems(newsPayload)
        } else {
          setNewsItems([])
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load chart')
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [interval, marketType, selectedSymbol, strategyType])

  useEffect(() => {
    setViewportPreset(defaultViewportPreset(interval, view))
  }, [interval, view])

  useEffect(() => {
    if (!chartData || !priceContainerRef.current || !volumeContainerRef.current || !oscillatorContainerRef.current) {
      return undefined
    }

    priceContainerRef.current.innerHTML = ''
    volumeContainerRef.current.innerHTML = ''
    oscillatorContainerRef.current.innerHTML = ''

    const priceChart = createPanelChart(priceContainerRef.current, {
      height: marketType === 'A' ? 360 : 400,
      showTimeScale: false,
      marketType,
      interval,
      view,
    })
    const volumeChart = createPanelChart(volumeContainerRef.current, {
      height: 120,
      showTimeScale: true,
      marketType,
      interval,
      view,
    })
    const oscillatorChart = createPanelChart(oscillatorContainerRef.current, {
      height: 130,
      showTimeScale: false,
      marketType,
      interval,
      view,
    })

    const priceSeries = view === 'candles'
      ? priceChart.addSeries(CandlestickSeries, {
          upColor: marketType === 'A' ? '#F85149' : '#3FB950',
          downColor: marketType === 'A' ? '#3FB950' : '#F85149',
          borderDownColor: marketType === 'A' ? '#3FB950' : '#F85149',
          borderUpColor: marketType === 'A' ? '#F85149' : '#3FB950',
          wickDownColor: marketType === 'A' ? '#3FB950' : '#F85149',
          wickUpColor: marketType === 'A' ? '#F85149' : '#3FB950',
          priceLineVisible: false,
        })
      : priceChart.addSeries(LineSeries, {
          color: INFO,
          lineWidth: 2,
          priceLineVisible: false,
        })

    if (view === 'candles') {
      ;(priceSeries as ISeriesApi<'Candlestick'>).setData(chartData.ohlcv.map((point) => ({
        time: toChartTime(point.time),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
      })))
      applyOverlaySeries(priceChart, chartData, activeOverlays)
    } else {
      ;(priceSeries as ISeriesApi<'Line'>).setData(chartData.intraday.map((point) => ({
        time: toChartTime(point.time),
        value: point.price,
      })))
      const avgSeries = priceChart.addSeries(LineSeries, {
        color: ACCENT,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
      })
      avgSeries.setData(chartData.intraday.map((point) => ({
        time: toChartTime(point.time),
        value: point.avgPrice,
      })))
    }

    if (selectedPosition) {
      addManagementPriceLine(priceSeries, {
        price: selectedPosition.avgPrice,
        title: copy.entryLine,
        color: '#58A6FF',
        lineStyle: LineStyle.Dashed,
      })
      if (selectedPosition.protectiveStop) {
        addManagementPriceLine(priceSeries, {
          price: selectedPosition.protectiveStop,
          title: selectedPosition.trailingActive ? copy.trailing : copy.protectiveStop,
          color: '#F85149',
        })
      }
      if (selectedPosition.targetPrice) {
        addManagementPriceLine(priceSeries, {
          price: selectedPosition.targetPrice,
          title: copy.target,
          color: '#3FB950',
        })
      }
    } else if (selectedSignal && selectedSignal.entryPrice > 0) {
      addManagementPriceLine(priceSeries, {
        price: selectedSignal.entryPrice,
        title: copy.entryLine,
        color: '#58A6FF',
        lineStyle: LineStyle.Dashed,
      })
      if (selectedSignal.stopLoss > 0) {
        addManagementPriceLine(priceSeries, {
          price: selectedSignal.stopLoss,
          title: copy.stop,
          color: '#F85149',
        })
      }
      if (selectedSignal.targetPrice > 0) {
        addManagementPriceLine(priceSeries, {
          price: selectedSignal.targetPrice,
          title: copy.target,
          color: '#3FB950',
        })
      }
    }

    const volumeSeries = volumeChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    })
    volumeSeries.setData(
      view === 'candles'
        ? buildHistogramColors(chartData.ohlcv, marketType)
        : buildIntradayVolume(chartData.intraday, marketType),
    )
    if (activeOverlays.includes('VOL') && view === 'candles') {
      const volumeMa5 = volumeChart.addSeries(LineSeries, {
        color: TEAL,
        lineWidth: 1,
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      })
      volumeMa5.setData(chartData.indicators.overlays.VOL.volumeMa5.map((point) => ({
        time: toChartTime(point.time),
        value: point.value,
      })))

      const volumeMa10 = volumeChart.addSeries(LineSeries, {
        color: PURPLE,
        lineWidth: 1,
        priceFormat: { type: 'volume' },
        priceLineVisible: false,
        lastValueVisible: false,
      })
      volumeMa10.setData(chartData.indicators.overlays.VOL.volumeMa10.map((point) => ({
        time: toChartTime(point.time),
        value: point.value,
      })))
    }

    renderOscillator(oscillatorChart, chartData, activeOscillator, marketType)

    const defaultPoint = view === 'candles'
      ? chartData.ohlcv[chartData.ohlcv.length - 1]
      : chartData.intraday[chartData.intraday.length - 1]
    if (defaultPoint) {
      if (view === 'candles') {
        const candlePoint = defaultPoint as OHLCV
        setHover({
          label: fromChartTime(candlePoint.time, marketType, interval, view),
          price: candlePoint.close,
          open: candlePoint.open,
          high: candlePoint.high,
          low: candlePoint.low,
          close: candlePoint.close,
          volume: candlePoint.volume,
        })
      } else {
        const intradayPoint = defaultPoint as IntradayPoint
        setHover({
          label: fromChartTime(intradayPoint.time, marketType, interval, view),
          price: intradayPoint.price,
          avgPrice: intradayPoint.avgPrice,
          volume: intradayPoint.volume,
        })
      }
    }

    const handleCrosshairMove = (param: MouseEventParams) => {
      if (!param.time) {
        return
      }
      const timeValue = Number(param.time)
      if (view === 'candles') {
        const current = chartData.ohlcv.find((point) => Number(point.time) === timeValue)
        if (!current) {
          return
        }
        setHover({
          label: fromChartTime(current.time, marketType, interval, view),
          price: current.close,
          open: current.open,
          high: current.high,
          low: current.low,
          close: current.close,
          volume: current.volume,
        })
        return
      }

      const current = chartData.intraday.find((point) => Number(point.time) === timeValue)
      if (!current) {
        return
      }
      setHover({
        label: fromChartTime(current.time, marketType, interval, view),
        price: current.price,
        avgPrice: current.avgPrice,
        volume: current.volume,
      })
    }

    priceChart.subscribeCrosshairMove(handleCrosshairMove)
    const viewportOptions = getViewportOptions(marketType, interval, view)
    applyViewportPreset(
      priceChart,
      view === 'candles' ? chartData.ohlcv.length : chartData.intraday.length,
      viewportPreset,
      viewportOptions,
    )
    volumeChart.timeScale().fitContent()
    oscillatorChart.timeScale().fitContent()

    const unsubscribe = syncVisibleRange(priceChart, [volumeChart, oscillatorChart])
    const resizeObserver = new ResizeObserver(() => {
      for (const chart of [priceChart, volumeChart, oscillatorChart]) {
        const container = chart.chartElement()
        chart.resize(container.clientWidth || 400, container.clientHeight || 120)
      }
    })
    resizeObserver.observe(priceContainerRef.current)
    resizeObserver.observe(volumeContainerRef.current)
    resizeObserver.observe(oscillatorContainerRef.current)

    return () => {
      priceChart.unsubscribeCrosshairMove(handleCrosshairMove)
      unsubscribe()
      resizeObserver.disconnect()
      priceChart.remove()
      volumeChart.remove()
      oscillatorChart.remove()
    }
  }, [activeOscillator, activeOverlays, chartData, copy.entryLine, copy.protectiveStop, copy.stop, copy.target, copy.trailing, interval, marketType, selectedPosition, selectedSignal, view, viewportPreset])

  const toggleOverlay = (indicator: IndicatorType) => {
    setActiveOverlays((current) => (
      current.includes(indicator)
        ? current.filter((item) => item !== indicator)
        : [...current, indicator]
    ))
  }

  if (!selectedSymbol) {
    return (
      <EmptyWorkbench title={copy.marketWorkbench} message={copy.noMarketData} />
    )
  }

  if (isLoading && !chartData) {
    return (
      <EmptyWorkbench title={copy.marketWorkbench} message={copy.chartLoading} />
    )
  }

  if (error && !chartData) {
    return (
      <EmptyWorkbench title={copy.marketWorkbench} message={error} />
    )
  }

  if (!chartData) {
    return (
      <EmptyWorkbench title={copy.marketWorkbench} message={copy.chartUnavailable} />
    )
  }

  const quote = chartData.quote
  const quoteBadge = marketType === 'A' ? copy.workspacePreset : copy.workspacePreset

  return (
    <>
      <section className="rounded-lg border border-dark-border bg-dark-card">
      <div className="border-b border-dark-border px-4 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-dark-text">{copy.marketWorkbench}</h2>
              <span className="rounded-full border border-dark-border bg-dark-hover px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-dark-muted">
                {quoteBadge}
              </span>
            </div>
            <p className="mt-1 text-sm text-dark-muted">{copy.marketWorkbenchDesc}</p>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <div>
                <div className="text-xs text-dark-muted">{copy.selectedSymbol}</div>
                <div className="text-xl font-semibold text-dark-text">
                  {chartData.symbol}
                  <span className="ml-2 text-sm font-normal text-dark-muted">{chartData.name}</span>
                </div>
              </div>
              <div className={getSignedTextClass(quote.changePercent, marketType)}>
                <div className="text-3xl font-bold">{formatCurrency(quote.price, false, marketType)}</div>
                <div className="text-sm">
                  {quote.change >= 0 ? '+' : ''}{formatCurrency(quote.change, false, marketType)} {formatPercent(quote.changePercent)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-dark-border px-4 py-3">
        <div className="mb-2 text-xs uppercase tracking-[0.14em] text-dark-muted">{copy.selectSymbolHint}</div>
        <SymbolStrip selectedSymbol={selectedSymbol} setSelectedSymbol={setSelectedSymbol} markets={markets} />
      </div>

      <div className="space-y-4 px-4 py-4">
        <ChartControls
          copy={copy}
          marketType={marketType}
          interval={interval}
          setInterval={setInterval}
          view={view}
          setView={setView}
          viewportPreset={viewportPreset}
          setViewportPreset={setViewportPreset}
          activeOverlays={activeOverlays}
          toggleOverlay={toggleOverlay}
          activeOscillator={activeOscillator}
          setActiveOscillator={setActiveOscillator}
        />

        {marketType === 'A' ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <div className="lg:w-[220px] lg:flex-none">
              <AShareQuoteRail chartData={chartData} marketType={marketType} copy={copy} hover={hover} />
            </div>
            <div className="space-y-4 lg:min-w-0 lg:flex-1">
              <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-text">{copy.priceAction}</span>
                  <span className="text-xs text-dark-muted">{copy.dateAxis}: {hover?.label ?? '--'}</span>
                </div>
                <div ref={priceContainerRef} className="min-h-[360px] w-full" />
              </div>
              <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-text">{copy.volumePanel}</span>
                  <span className="text-xs text-dark-muted">{copy.marketPulse}</span>
                </div>
                <div ref={volumeContainerRef} className="min-h-[120px] w-full" />
              </div>
              <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-text">{copy.oscillatorPanel}</span>
                  <span className="text-xs text-dark-muted">{activeOscillator ?? copy.noOscillator}</span>
                </div>
                <div ref={oscillatorContainerRef} className="min-h-[130px] w-full" />
              </div>
            </div>
            <div className="lg:w-[340px] lg:flex-none">
              <div className="space-y-4">
                <AShareBookPanel chartData={chartData} marketType={marketType} copy={copy} />
                <PositionManagementPanel
                  title={copy.positionManagement}
                  copy={copy}
                  marketType={marketType}
                  signal={managementState}
                  emptyText={copy.noManagement}
                />
                <TradeActivityPanel
                  title={copy.tradeActivity}
                  items={symbolActivityItems}
                  marketType={marketType}
                  emptyText={copy.noTradeActivity}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_360px] lg:items-start">
            <div className="space-y-4">
              <QuoteOverview chartData={chartData} marketType={marketType} copy={copy} />
              <HoverBar hover={hover} marketType={marketType} />
              <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-dark-text">{copy.priceAction}</span>
                  <span className="text-xs text-dark-muted">{copy.dateAxis}: {hover?.label ?? '--'}</span>
                </div>
                <div ref={priceContainerRef} className="min-h-[400px] w-full" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-text">{copy.volumePanel}</span>
                    <span className="text-xs text-dark-muted">{copy.marketPulse}</span>
                  </div>
                  <div ref={volumeContainerRef} className="min-h-[120px] w-full" />
                </div>
                <div className="rounded-lg border border-dark-border bg-dark-hover/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-dark-text">{copy.oscillatorPanel}</span>
                    <span className="text-xs text-dark-muted">{activeOscillator ?? copy.noOscillator}</span>
                  </div>
                  <div ref={oscillatorContainerRef} className="min-h-[130px] w-full" />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <WatchlistPanel
                title={copy.watchlist}
                items={watchlistMarkets.map((market) => ({
                  symbol: market.symbol,
                  name: market.name,
                  price: market.price,
                  changePercent: market.changePercent,
                }))}
                selectedSymbol={selectedSymbol}
                setSelectedSymbol={setSelectedSymbol}
                marketType={marketType}
                emptyText={copy.noWatchlist}
                toggleWatchlistSymbol={toggleWatchlistSymbol}
                removeLabel={copy.removeFromWatchlist}
                addLabel={copy.watchlistAdd}
                inputLabel={copy.watchlistInput}
                inputHint={copy.watchlistInputHint}
                addWatchlistSymbol={addWatchlistSymbol}
                suggestions={watchlistSuggestions}
              />
              <NewsPanel
                title={copy.newsFlow}
                newsItems={newsItems}
                marketType={marketType}
                noNews={copy.noNews}
                sentimentLabel={copy.headlinesSentiment}
                openLabel={copy.openNews}
                moreLabel={copy.moreNews}
                onMore={() => setIsNewsCenterOpen(true)}
              />
              <PositionManagementPanel
                title={copy.positionManagement}
                copy={copy}
                marketType={marketType}
                signal={managementState}
                emptyText={copy.noManagement}
              />
              <TradeActivityPanel
                title={copy.tradeActivity}
                items={symbolActivityItems}
                marketType={marketType}
                emptyText={copy.noTradeActivity}
              />
            </div>
          </div>
        )}
      </div>
      </section>
      {isNewsCenterOpen ? (
        <NewsCenterOverlay
          title={copy.newsCenter}
          marketType={marketType}
          newsItems={newsItems}
          openLabel={copy.openNews}
          closeLabel={copy.closePanel}
          noNews={copy.noNews}
          onClose={() => setIsNewsCenterOpen(false)}
        />
      ) : null}
    </>
  )
}
