export type DisplayMarket = 'A' | 'US'

const A_SHARE_LOG_MESSAGE_PATTERNS: Array<[RegExp, string | ((...matches: string[]) => string)]> = [
  [/^Completed market analysis for (\d+) symbols$/, (_full, count) => `已完成 ${count} 只标的分析`],
  [/^No tradeable signals met the current filters$/, '当前筛选条件下暂无可交易信号'],
  [/^Generated BUY signal for (.+)$/, (_full, name) => `已为 ${name} 生成买入信号`],
  [/^Generated SELL signal for (.+)$/, (_full, name) => `已为 ${name} 生成卖出信号`],
  [/^Generated HOLD signal for (.+)$/, (_full, name) => `已为 ${name} 生成观望信号`],
  [/^Approved signal for (.+)$/, (_full, name) => `已通过 ${name} 信号`],
  [/^Rejected signal for (.+)$/, (_full, name) => `已拒绝 ${name} 信号`],
  [/^Auto-routed strategy signal for (.+)$/, (_full, name) => `已自动执行 ${name} 策略信号`],
  [/^Paper auto-trading enabled for (.+)$/, (_full, name) => `已开启 ${name} 策略自动跟随`],
  [/^Paper auto-trading disabled for (.+)$/, (_full, name) => `已关闭 ${name} 策略自动跟随`],
  [/^Paper account reset completed$/, '模拟盘已重置'],
]

export const isAMarket = (marketType: DisplayMarket): boolean => marketType === 'A'

export const getSignedTextClass = (value: number, marketType: DisplayMarket): string => {
  if (isAMarket(marketType)) {
    return value >= 0 ? 'text-loss' : 'text-profit'
  }
  return value >= 0 ? 'text-profit' : 'text-loss'
}

export const getSignedFillColor = (value: number, marketType: DisplayMarket): string => {
  if (isAMarket(marketType)) {
    return value >= 0 ? '#F85149' : '#3FB950'
  }
  return value >= 0 ? '#3FB950' : '#F85149'
}

export const getRangeTextClasses = (marketType: DisplayMarket): { low: string; high: string } => {
  if (isAMarket(marketType)) {
    return { low: 'text-profit', high: 'text-loss' }
  }
  return { low: 'text-loss', high: 'text-profit' }
}

export const getDashboardCopy = (marketType: DisplayMarket) => {
  if (marketType === 'A') {
    return {
      noPortfolio: '暂无组合数据',
      portfolioOverview: '组合概览',
      terminalStatus: '终端状态',
      currentMarket: '当前市场',
      dataSource: '数据源',
      executionMode: '执行模式',
      strategyLabel: '策略',
      paperTrading: '模拟运行',
      liveConnection: '实时连接',
      currentSymbol: '当前标的',
      lastRefresh: '最近刷新',
      accountStatus: '账户状态',
      updated: '更新于',
      totalValue: '总资产',
      dayPnl: '当日盈亏',
      dayReturn: '当日收益',
      week: '本周',
      sharpeRatio: '夏普比率',
      winRate: '胜率',
      maxDrawdown: '最大回撤',
      riskScore: '风险评分',
      invested: '持仓市值',
      cash: '可用资金',
      positions: '持仓',
      live: '实时',
      noMarketData: '暂无市场数据',
      marketOverview: '市场概览',
      symbol: '代码',
      price: '最新价',
      change: '涨跌',
      volume: '成交量',
      intradayRange: '日内区间',
      noPositions: '暂无持仓',
      quantity: '数量',
      avgPrice: '成本价',
      current: '现价',
      pnl: '浮动盈亏',
      day: '涨跌幅',
      value: '市值',
      weight: '仓位',
      actions: '操作',
      holdingTime: '持仓时长',
      protectiveStop: '保护止损',
      trailing: '移动止损',
      partialExit: '部分止盈',
      shortSide: '空头',
      longSide: '多头',
      timeDecay: '时间衰减',
      total: '合计',
      noSignals: '暂无交易信号',
      recentSignals: '最近信号',
      pending: '待处理',
      by: '来源',
      entry: '入场',
      target: '目标',
      stop: '止损',
      rationale: '逻辑说明',
      expectedReturn: '预期收益',
      suggestedQty: '建议数量',
      strategy: '策略',
      warnings: '风控提示',
      cooldown: '冷却至',
      kelly: 'Kelly',
      heat: '热度',
      maxPositionSize: '最大仓位',
      tradingPaused: '暂停开仓',
      reject: '拒绝',
      approve: '通过',
      working: '处理中...',
      agentMonitor: '智能体监控',
      systemActive: '系统运行中',
      tasks: '任务',
      success: '成功率',
      activityLog: '运行日志',
      portfolioPerformance: '组合表现',
      noHistorical: '暂无历史数据',
      return30d: '30日收益',
      currentEquity: '当前净值',
      benchmarkOverlay: '对比基准',
      assetAllocation: '资产分布',
      noAllocation: '暂无持仓分布',
      dailyPnlChart: '日内盈亏',
      noDailyPnl: '暂无日内盈亏数据',
      intradayMovement: '日内已实现与未实现盈亏',
      points: '个数据点',
      marketWorkbench: '专业行情工作区',
      marketWorkbenchDesc: 'K线、分时与技术指标联动分析',
      chartView: 'K线',
      intradayView: '分时',
      chartLoading: '正在加载图表数据...',
      chartUnavailable: '暂无图表数据',
      interval: '周期',
      indicators: '指标',
      selectedSymbol: '当前标的',
      openPrice: '开盘',
      highPrice: '最高',
      lowPrice: '最低',
      amplitude: '振幅',
      chartPowered: '专业图表引擎',
      latestPrice: '最新成交',
      intradayAvg: '均价线',
      volumePanel: '成交量',
      oscillatorPanel: '摆动指标',
      noOscillator: '当前未选择摆动指标',
      priceAction: '价格走势',
      selectSymbolHint: '点击下方标的可快速切换',
      quoteOverview: '行情速览',
      estimatedDepth: '估算盘口',
      realDepth: '实时盘口',
      bidBook: '买盘',
      askBook: '卖盘',
      tickTape: '成交',
      watchlist: '自选观察',
      watchlistManager: '自选股',
      watchlistManagerDesc: '搜索代码并维护当前市场的自选列表',
      noWatchlist: '暂无自选股，点击下方市场表中的星标即可加入',
      addToWatchlist: '加入自选',
      removeFromWatchlist: '移出自选',
      watchlistInput: '输入代码或名称',
      watchlistInputHint: '例如 600519 / 贵州茅台',
      watchlistAdd: '添加',
      newsFlow: '资讯流',
      noNews: '暂无相关新闻',
      moreNews: '更多资讯',
      newsCenter: '资讯中心',
      closePanel: '关闭',
      dateAxis: '日期轴',
      marketPulse: '市场脉搏',
      turnover: '换手',
      peRatio: '市盈率',
      pbRatio: '市净率',
      buyOne: '买一',
      sellOne: '卖一',
      priceLadder: '五档',
      lastTrades: '明细',
      intradayTabs: '分时 / K线',
      workspacePreset: 'A股交易工作区',
      headlinesSentiment: '情绪',
      sentimentPositive: '偏多',
      sentimentNegative: '偏空',
      sentimentNeutral: '中性',
      openNews: '打开原文',
      tradeActivity: '交易活动',
      noTradeActivity: '当前标的暂无交易活动',
      protectiveLevels: '保护线',
      entryLine: '入场线',
      positionManagement: '仓位管理',
      noManagement: '当前标的暂无仓位管理状态',
      status: '状态',
      protection: '保护',
      armed: '已启用',
      inactive: '未启用',
      active: '进行中',
      standby: '待触发',
      paperPanel: '模拟盘',
      paperPanelDesc: '让模拟盘手动执行或自动跟随当前策略',
      paperAutoOn: '自动跟随已开启',
      paperAutoOff: '手动确认',
      paperEnableAuto: '开启自动跟随',
      paperDisableAuto: '关闭自动跟随',
      paperReset: '重置模拟盘',
      paperResetConfirm: '确认重置当前市场与策略下的模拟盘吗？这会清空模拟订单、仓位和风控状态。',
      paperBuyingPower: '可用购买力',
      paperPendingSignals: '待执行信号',
      paperExecutedTrades: '已成交笔数',
      paperRealizedPnl: '已实现盈亏',
      paperUnrealizedPnl: '未实现盈亏',
      paperLastReset: '最近重置',
      paperCapital: '模拟资金',
      paperCapitalHint: '输入新的模拟资金，例如 200000',
      saveCapital: '保存资金',
      manualOrderTicket: '手动下单',
      placePaperOrder: '提交模拟订单',
      orderPrice: '委托价',
      useLivePrice: '跟随现价',
      currentPriceLabel: '现价',
      orderLots: '下单数量（手）',
      orderShares: '下单数量（股）',
      lotUnit: '手',
      shareUnit: '股',
      orderQuantityHint: '折算数量',
      stopPercent: '止损幅度 (%)',
      targetPercent: '目标幅度 (%)',
      closePosition: '平仓',
    }
  }

  return {
    noPortfolio: 'No portfolio data available',
    portfolioOverview: 'Portfolio Overview',
    terminalStatus: 'Terminal Status',
    currentMarket: 'Current Market',
    dataSource: 'Data Source',
    executionMode: 'Execution Mode',
    strategyLabel: 'Strategy',
    paperTrading: 'Paper Runtime',
    liveConnection: 'Live Connection',
    currentSymbol: 'Focus Symbol',
    lastRefresh: 'Last Refresh',
    accountStatus: 'Account Status',
    updated: 'Updated',
    totalValue: 'Total Value',
    dayPnl: 'Day P&L',
    dayReturn: 'Day Return',
    week: 'Week',
    sharpeRatio: 'Sharpe Ratio',
    winRate: 'Win Rate',
    maxDrawdown: 'Max Drawdown',
    riskScore: 'Risk Score',
    invested: 'Invested',
    cash: 'Cash',
    positions: 'Positions',
    live: 'Live',
    noMarketData: 'No market data available',
    marketOverview: 'Market Overview',
    symbol: 'Symbol',
    price: 'Price',
    change: 'Change',
    volume: 'Volume',
    intradayRange: '24h Range',
    noPositions: 'No positions found',
    quantity: 'Qty',
    avgPrice: 'Avg Price',
    current: 'Current',
    pnl: 'P&L',
    day: 'Day',
    value: 'Value',
    weight: 'Weight',
    actions: 'Actions',
    holdingTime: 'Hold Time',
    protectiveStop: 'Protective Stop',
    trailing: 'Trailing',
    partialExit: 'Partial Exit',
    shortSide: 'Short',
    longSide: 'Long',
    timeDecay: 'Time Decay',
    total: 'Total',
    noSignals: 'No signals generated yet',
    recentSignals: 'Recent Signals',
    pending: 'pending',
    by: 'by',
    entry: 'Entry',
    target: 'Target',
    stop: 'Stop',
    rationale: 'Rationale',
    expectedReturn: 'Expected Return',
    suggestedQty: 'Suggested Qty',
    strategy: 'Strategy',
    warnings: 'Warnings',
    cooldown: 'Cooldown',
    kelly: 'Kelly',
    heat: 'Heat',
    maxPositionSize: 'Max Size',
    tradingPaused: 'Trading Paused',
    reject: 'Reject',
    approve: 'Approve',
    working: 'Working...',
    agentMonitor: 'Agent Monitor',
    systemActive: 'System Active',
    tasks: 'Tasks',
    success: 'Success',
    activityLog: 'Activity Log',
    portfolioPerformance: 'Portfolio Performance',
    noHistorical: 'No historical data available',
    return30d: '30D Return',
    currentEquity: 'Current Equity',
    benchmarkOverlay: 'vs benchmark overlay',
    assetAllocation: 'Asset Allocation',
    noAllocation: 'No positions to display',
    dailyPnlChart: 'Daily P&L',
    noDailyPnl: 'No P&L data available',
    intradayMovement: 'Intraday realized and unrealized movement',
    points: 'points',
    marketWorkbench: 'Market Workbench',
    marketWorkbenchDesc: 'Candles, intraday tape, and technical overlays',
    chartView: 'Candles',
    intradayView: 'Intraday',
    chartLoading: 'Loading chart data...',
    chartUnavailable: 'No chart data available',
    interval: 'Interval',
    indicators: 'Indicators',
    selectedSymbol: 'Focus Symbol',
    openPrice: 'Open',
    highPrice: 'High',
    lowPrice: 'Low',
    amplitude: 'Amplitude',
    chartPowered: 'Professional chart engine',
    latestPrice: 'Last',
    intradayAvg: 'VWAP',
    volumePanel: 'Volume',
    oscillatorPanel: 'Oscillator',
    noOscillator: 'No oscillator selected',
    priceAction: 'Price Action',
    selectSymbolHint: 'Click a symbol below to refocus the workspace',
    quoteOverview: 'Quote Overview',
    estimatedDepth: 'Estimated Book',
    realDepth: 'Live Book',
    bidBook: 'Bids',
    askBook: 'Asks',
    tickTape: 'Trades',
    watchlist: 'Watchlist',
    watchlistManager: 'Watchlist Manager',
    watchlistManagerDesc: 'Search symbols and maintain favorites for the active market',
    noWatchlist: 'No favorites yet. Use the star in the market table to add one.',
    addToWatchlist: 'Add to watchlist',
    removeFromWatchlist: 'Remove from watchlist',
    watchlistInput: 'Enter symbol or name',
    watchlistInputHint: 'For example AAPL or Apple',
    watchlistAdd: 'Add',
    newsFlow: 'News Flow',
    noNews: 'No related news available',
    moreNews: 'More',
    newsCenter: 'News Center',
    closePanel: 'Close',
    dateAxis: 'Date Axis',
    marketPulse: 'Market Pulse',
    turnover: 'Turnover',
    peRatio: 'P/E',
    pbRatio: 'P/B',
    buyOne: 'Bid 1',
    sellOne: 'Ask 1',
    priceLadder: 'Book',
    lastTrades: 'Tape',
    intradayTabs: 'Intraday / Candles',
    workspacePreset: 'US Trading Workspace',
    headlinesSentiment: 'Sentiment',
    sentimentPositive: 'Positive',
    sentimentNegative: 'Negative',
    sentimentNeutral: 'Neutral',
    openNews: 'Open',
    tradeActivity: 'Trade Activity',
    noTradeActivity: 'No trade activity for the selected symbol',
    protectiveLevels: 'Protective Levels',
    entryLine: 'Entry',
    positionManagement: 'Position Management',
    noManagement: 'No position management state for the selected symbol',
    status: 'Status',
    protection: 'Protection',
    armed: 'Armed',
    inactive: 'Inactive',
    active: 'Active',
    standby: 'Standby',
    paperPanel: 'Paper Trading',
    paperPanelDesc: 'Run the paper account manually or let it follow the active strategy',
    paperAutoOn: 'Auto Strategy On',
    paperAutoOff: 'Manual Review',
    paperEnableAuto: 'Enable Auto Strategy',
    paperDisableAuto: 'Disable Auto Strategy',
    paperReset: 'Reset Paper Account',
    paperResetConfirm: 'Reset the paper account for the current market and strategy? This clears paper orders, positions, and risk state.',
    paperBuyingPower: 'Buying Power',
    paperPendingSignals: 'Pending Signals',
    paperExecutedTrades: 'Executed Trades',
    paperRealizedPnl: 'Realized P&L',
    paperUnrealizedPnl: 'Unrealized P&L',
    paperLastReset: 'Last Reset',
    paperCapital: 'Paper Capital',
    paperCapitalHint: 'Enter a new paper capital, for example 200000',
    saveCapital: 'Save Capital',
    manualOrderTicket: 'Manual Order Ticket',
    placePaperOrder: 'Place Paper Order',
    orderPrice: 'Order Price',
    useLivePrice: 'Use live price',
    currentPriceLabel: 'Live Price',
    orderLots: 'Order Size (lots)',
    orderShares: 'Order Size (shares)',
    lotUnit: 'lot',
    shareUnit: 'share',
    orderQuantityHint: 'Converted size',
    stopPercent: 'Stop (%)',
    targetPercent: 'Target (%)',
    closePosition: 'Close',
  }
}

export const localizeSignalType = (value: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return value
  }

  return {
    BUY: '买入',
    SELL: '卖出',
    HOLD: '观望',
  }[value] || value
}

export const localizeSignalStatus = (value: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return value
  }

  return {
    PENDING: '待处理',
    APPROVED: '已通过',
    EXECUTING: '执行中',
    EXECUTED: '已执行',
    REJECTED: '已拒绝',
    CANCELLED: '已取消',
  }[value] || value
}

export const localizeAgentRole = (value: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return value.replace('_', ' ')
  }

  return {
    researcher: '研究员',
    strategist: '策略师',
    risk_manager: '风控',
    executor: '执行器',
    coordinator: '协调器',
  }[value] || value.replace('_', ' ')
}

export const localizeAgentName = (value: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return value
  }

  return {
    Researcher: '研究员',
    Strategist: '策略师',
    'Risk Manager': '风控',
    Executor: '执行器',
    Coordinator: '协调器',
    System: '系统',
  }[value] || value
}

export const localizeAgentStatus = (value: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return value
  }

  return {
    running: '运行中',
    idle: '空闲',
    error: '异常',
    paused: '暂停',
  }[value] || value
}

export const localizeAgentTask = (value: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return value
  }

  return {
    'Refreshing market overview': '刷新市场概览',
    'Ranking trade opportunities': '评估交易机会',
    'Assessing portfolio risk': '评估组合风险',
    'Monitoring paper orders': '监控模拟订单',
  }[value] || value
}

export const localizeLogMessage = (message: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return message
  }

  for (const [pattern, replacement] of A_SHARE_LOG_MESSAGE_PATTERNS) {
    const match = message.match(pattern)
    if (!match) {
      continue
    }

    if (typeof replacement === 'string') {
      return replacement
    }

    return replacement(...match)
  }

  return message
}

export const localizeAlertMessage = (message: string, marketType: DisplayMarket): string => {
  if (!isAMarket(marketType)) {
    return message
  }

  return message
    .replace(/Technology sector exposure remains above the preferred threshold\./g, '科技板块敞口仍高于建议阈值。')
    .replace(/Overall portfolio risk score is elevated at ([\d.]+)\/10/g, '组合整体风险评分升至 $1/10')
    .replace(/ concentration is ([\d.]+)% of invested capital/g, ' 持仓占已投资资金的 $1%')
}
