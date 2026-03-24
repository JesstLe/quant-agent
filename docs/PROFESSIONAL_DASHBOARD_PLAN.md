# QuantAgent 专业级金融看板升级计划

## 1. 目标

把当前的基础版 Portfolio Dashboard 升级为可持续演进的专业级金融工作台，支持：

- A 股与美股分市场展示
- 专业 K 线 / 分时 / 技术指标工作区
- 深度盘口、逐笔成交、新闻、风险分析
- 自选股、告警、导出、多面板布局
- 面向未来的真实数据源与可替换 Provider 架构

这份文档用于回答两个问题：

1. 最终形态应该长什么样
2. 为达到最终形态，哪些地方需要升级

---

## 2. 当前状态

### 已具备

- A 股 / 美股切换
- 基础组合概览、持仓、信号、市场表
- 基础实时推送
- 基础图表
  - 组合净值
  - 资产分布
  - 日内盈亏
- 第一阶段已完成的行情工作区
  - K 线 / 分时切换
  - 周期切换
  - MA / EMA / BOLL / RSI / MACD / KDJ / VOL
  - A 股中文化与红涨绿跌

### 当前不足

- 行情数据仍主要依赖 `yfinance`
- 无 Level 2、五档/十档盘口、逐笔成交
- 无专业新闻流、财报日历
- 无自选股、告警、导出、多图布局
- 市场表字段不够专业
- 风险分析还不够可视化
- 数据源未抽象为可替换的多市场 Provider

---

## 3. 最终形态

## 3.1 总体产品形态

最终系统应演进为“一个内核，两套市场化工作区”：

- 共用一套底层能力
  - 图表引擎
  - 数据模型
  - API 协议
  - WebSocket 协议
  - 自选股 / 告警 / 导出 / 风险分析
- 市场展示层做两套预设
  - A 股工作区
  - 美股工作区

原因：

- 完全拆成两个系统，维护成本太高
- 完全强行共用一套界面，会损失市场习惯差异
- 最优解是统一内核 + 市场化展示预设

## 3.2 A 股工作区目标

借鉴方向：同花顺 / 东方财富 / Wind 手机版

应具备：

- 顶部单标的行情卡
  - 最新价、涨跌额、涨跌幅、开高低、成交额、量比、换手率、市值
- 中间主图
  - 分时 / 日 K / 周 K / 月 K / 五日
  - 均价线
  - 红涨绿跌
- 右侧专业面板
  - 五档盘口
  - 逐笔成交
- 下方辅助模块
  - 资金流向
  - 板块联动
  - 相关 ETF
  - 新闻 / 公告 / 财报日期

## 3.3 美股工作区目标

借鉴方向：IBKR / Bloomberg / TradingView Pro

应具备：

- 中央主图优先
  - 1m / 5m / 15m / 30m / 1H / 4H / 1D / 1W / 1M
  - 更强的 K 线分析体验
- 左侧信息卡
  - Quote / Fundamentals / Position / Order context
- 右侧辅助面板
  - Watchlist
  - News
  - Recent trades
  - Movers / peers
- 支持盘前 / 盘后展示

---

## 4. 设计策略

## 4.1 是否需要两套设计

建议：

- 不做两套完全独立产品
- 做一套统一设计系统
- 在工作区层面提供两种市场预设

### 统一部分

- 颜色 token 体系
- 卡片、面板、表格、标签、按钮风格
- 图表容器与交互模式
- 数据结构与 API 命名

### 市场差异化部分

- 颜色规则
  - A 股：红涨绿跌
  - 美股：绿涨红跌
- 默认文案语言
  - A 股：中文
  - 美股：英文
- 默认布局
  - A 股：盘口驱动
  - 美股：主图驱动
- 默认周期
  - A 股偏分时 / 日 K / 五日
  - 美股偏 1D / 1H / 4H

---

## 5. 数据源升级方向

## 5.1 当前数据源

当前主要来源：

- 行情 / K 线 / 分时：`yfinance`
- 基本信息：`yfinance`
- 研究和策略：项目内 Agent
- 订单和组合：本地 paper runtime

这适合原型验证，但不适合专业终端形态。

## 5.2 最终数据源原则

必须从“单一临时源”升级成“多市场 Provider 架构”。

### 抽象层目标

引入统一接口，例如：

- `MarketDataProvider`
- `NewsProvider`
- `DepthProvider`
- `FundamentalsProvider`
- `CalendarProvider`

每个市场走自己的实现。

## 5.3 A 股推荐数据源路线

### 原型期

- `AkShare`
- 东方财富公开接口
- `Tushare`

### 生产期

- Wind
- 同花顺 iFinD
- 券商行情接口
- xtquant / QMT / PTrade 类接口

### A 股必须补齐的数据

- 分时
- 五档 / 十档盘口
- Tick 逐笔
- 成交额
- 换手率
- 量比
- 主力资金流
- 公告 / 财报日历

## 5.4 美股推荐数据源路线

### 原型期

- `yfinance`
- `Tiingo`

### 专业期

- IBKR
- Polygon
- IEX Cloud
- Alpaca

### 美股必须补齐的数据

- 更稳定的分钟线
- 盘前 / 盘后
- 实时报价与延迟标识
- 基本面字段
- 新闻流
- Earnings calendar

## 5.5 Provider 架构建议

建议目标结构：

```text
quant_agent/data/providers/
  base.py
  market_data.py
  depth.py
  news.py
  fundamentals.py
  calendar.py
  a_share/
    akshare_provider.py
    eastmoney_provider.py
  us/
    yfinance_provider.py
    ibkr_provider.py
    polygon_provider.py
```

核心要求：

- 前端永远不感知具体供应商
- API 只暴露统一结构
- Provider 可以按环境切换
- 支持 fallback
- 支持缓存与限流

---

## 6. 需要升级的模块

## 6.1 前端

### 当前需要升级

- `frontend/src/App.tsx`
- `frontend/src/hooks/useApp.tsx`
- `frontend/src/types/index.ts`
- `frontend/src/components/Charts/`
- `frontend/src/components/Dashboard/MarketsTable.tsx`

### 最终需要新增

- `MarketWorkbench` 多面板化
- `DepthPanel`
- `TickTape`
- `WatchlistPanel`
- `NewsPanel`
- `EarningsCalendar`
- `CorrelationHeatmap`
- `SectorHeatmap`
- `ExposureBreakdown`
- `AlertManager`
- `ExportActions`
- `LayoutManager`

### 前端架构目标

- 工作区状态独立
- 图表状态独立
- Watchlist / Alert / Layout 持久化
- REST + WebSocket 混合更新

## 6.2 后端 API

### 当前需要升级

- `quant_agent/api/main.py`
- `quant_agent/api/runtime_service.py`

### 最终应新增接口

- `/api/chart`
- `/api/intraday`
- `/api/depth`
- `/api/ticks`
- `/api/news`
- `/api/calendar/earnings`
- `/api/watchlists`
- `/api/alerts/price`
- `/api/heatmap`
- `/api/risk/correlation`
- `/api/risk/exposure`
- `/api/export/*`

### WebSocket 需要增强

当前只推：

- portfolio
- markets
- signals
- agents
- trades
- risk
- alerts
- logs

最终还应支持：

- chart
- intraday
- depth
- ticks
- news
- watchlists
- price alerts

## 6.3 数据获取层

### 当前需要升级

- `quant_agent/core/tools.py`
- `quant_agent/data/`
- `quant_agent/backtest/engine.py`

### 核心改造

- 从直接调用 `yfinance` 改成 Provider 层
- 为不同市场分别实现数据适配
- 建立缓存、重试、限流
- 引入时间粒度标准化

## 6.4 持久化层

当前已有运行态 SQLite，但还不够。

最终还需要持久化：

- watchlists
- layouts
- price alerts
- chart preferences
- recent symbols
- news cache
- tick / depth 快照缓存

---

## 7. 分阶段路线图

## Phase 1：专业行情工作区底座

状态：已完成

包含：

- 单标的工作区
- K 线 / 分时切换
- 周期切换
- 技术指标
- A / US 市场切换

后续补强：

- 更清晰的时间轴
- 十字光标数据面板
- 更专业的 OHLC tooltip

## Phase 2：盘口与成交

目标：

- 五档 / 十档盘口
- Tick 成交列表
- 成交量联动增强
- 市场表专业字段增强

验收标准：

- A 股可查看五档与成交明细
- 美股至少支持简化版 bid/ask 与 recent prints

## Phase 3：资讯与板块

目标：

- 新闻流
- 情绪标签
- 财报日历
- 板块热力图
- 行业分布

验收标准：

- 选中标的能看到相关新闻
- 市场概览支持板块热力图

## Phase 4：风险分析

目标：

- 相关性矩阵
- 敞口分析
- 板块 / 行业风险
- 持仓集中度图

验收标准：

- 至少能对当前组合输出相关性热力图和行业敞口

## Phase 5：交易工作流

目标：

- 自选股管理
- 告警管理
- 导出
- 多图布局

验收标准：

- 自选股可分组
- 告警可触发
- 持仓和行情可导出 CSV
- 可切换单图 / 双图 / 四图布局

## Phase 6：真实专业数据源

目标：

- A 股专业数据 Provider
- 美股专业数据 Provider
- 回退与冗余机制

验收标准：

- 脱离单一 `yfinance`
- A 股与美股都具备专业级稳定行情来源

---

## 8. 优先级建议

按价值与依赖关系，建议这样推进：

1. 图表时间轴和 tooltip 做专业化
2. 抽象 Provider 层
3. 做盘口 / Tick
4. 增强 Markets Table 字段
5. 做 Watchlist 与 Price Alert
6. 做 News / Calendar
7. 做 Correlation / Heatmap / Exposure
8. 最后做多图布局与导出

---

## 9. 近期执行建议

下一步最合理的动作不是继续堆 UI，而是先做下面两件事：

### 任务 A：图表专业化补完

- 时间轴密度优化
- 十字光标信息条
- 分时关键时点标记
- OHLC / 成交量 / 涨跌 tooltip

### 任务 B：Provider 抽象

- 定义 `MarketDataProvider` 基类
- 新建 `AShareMarketDataProvider`
- 新建 `USMarketDataProvider`
- 当前先把 `yfinance` 和 A 股临时源包到 Provider 里
- API / runtime 不再直接依赖 `yfinance`

如果这两件事完成，后面加盘口、新闻、告警、热力图都会顺很多。

---

## 10. 结论

这个项目接下来的关键不只是“多做几个组件”，而是同时完成两类升级：

- 产品升级：从基础看板变成专业工作台
- 架构升级：从单一数据源直连变成可替换 Provider 体系

最终方向建议：

- 一套统一内核
- A 股 / 美股两种市场工作区预设
- 两套专业数据源策略
- 逐步从原型数据源过渡到专业数据源

这会让项目既能快速迭代，也不会在后期因为数据源和市场差异被迫推倒重来。
