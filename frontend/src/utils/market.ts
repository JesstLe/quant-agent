export type DisplayMarket = 'A' | 'US'

const A_SHARE_LOG_MESSAGE_PATTERNS: Array<[RegExp, string | ((...matches: string[]) => string)]> = [
  [/^Completed market analysis for (\d+) symbols$/, (_full, count) => `已完成 ${count} 只标的分析`],
  [/^No tradeable signals met the current filters$/, '当前筛选条件下暂无可交易信号'],
  [/^Generated BUY signal for (.+)$/, (_full, name) => `已为 ${name} 生成买入信号`],
  [/^Generated SELL signal for (.+)$/, (_full, name) => `已为 ${name} 生成卖出信号`],
  [/^Generated HOLD signal for (.+)$/, (_full, name) => `已为 ${name} 生成观望信号`],
  [/^Approved signal for (.+)$/, (_full, name) => `已通过 ${name} 信号`],
  [/^Rejected signal for (.+)$/, (_full, name) => `已拒绝 ${name} 信号`],
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
    }
  }

  return {
    noPortfolio: 'No portfolio data available',
    portfolioOverview: 'Portfolio Overview',
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
