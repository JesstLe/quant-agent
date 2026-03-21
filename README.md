# QuantAgent - AI驱动的金融量化交易Agent

一个基于LLM的多Agent金融量化交易系统，支持策略研究、回测、风险管理和自动交易。

## 核心特性

- **Multi-Agent架构** - 专业分工的Agent协作（研究、策略、风控、执行）
- **LLM驱动分析** - 使用Claude/GPT进行市场分析和策略生成
- **量化指标库** - 技术指标、因子分析、情绪分析
- **回测框架** - 历史数据回测，策略评估
- **风险管理** - 仓位管理、止损止盈、VaR计算
- **实时监控** - Dashboard可视化，告警通知
- **Paper Trading** - 模拟交易，安全验证策略
- **多市场支持** - 股票、加密货币、期货

## 项目结构

```
quant-agent/
├── agents/                 # Agent模块
│   ├── researcher.py       # 市场研究Agent
│   ├── strategist.py       # 策略生成Agent
│   ├── risk_manager.py     # 风险管理Agent
│   ├── executor.py         # 交易执行Agent
│   └── coordinator.py      # 协调器
├── core/                   # 核心组件
│   ├── llm.py              # LLM接口
│   ├── memory.py           # 记忆系统
│   └── tools.py            # 工具集
├── data/                   # 数据模块
│   ├── sources/            # 数据源
│   ├── processors/         # 数据处理
│   └── storage.py          # 数据存储
├── strategies/             # 策略库
│   ├── technical.py        # 技术分析策略
│   ├── factor.py           # 因子策略
│   └── sentiment.py        # 情绪策略
├── backtest/               # 回测引擎
│   ├── engine.py           # 回测引擎
│   ├── portfolio.py        # 组合管理
│   └── metrics.py          # 评估指标
├── risk/                   # 风险管理
│   ├── position.py         # 仓位管理
│   ├── var.py              # VaR计算
│   └── limits.py           # 风险限制
├── execution/              # 交易执行
│   ├── broker.py           # 券商接口
│   ├── orders.py           # 订单管理
│   └── paper_trading.py    # 模拟交易
├── api/                    # API服务
│   ├── main.py             # FastAPI应用
│   ├── routes/             # 路由
│   └── websocket.py        # WebSocket
├── dashboard/              # 前端Dashboard
├── config/                 # 配置文件
├── tests/                  # 测试
└── scripts/                # 脚本
```

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入API密钥

# 运行回测
python -m quant_agent run-backtest --strategy momentum --start 2024-01-01 --end 2024-12-31

# 启动Agent系统
python -m quant_agent start --mode paper

# 启动Dashboard
streamlit run dashboard/app.py
```

## Agent架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Coordinator Agent                       │
│              (任务分配、状态监控、决策整合)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┬─────────────┐
        ▼             ▼             ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│ Research  │ │ Strategist│ │   Risk    │ │  Executor │
│  Agent    │ │   Agent   │ │  Manager  │ │   Agent   │
│           │ │           │ │           │ │           │
│ 市场研究   │ │ 策略生成   │ │ 风险评估   │ │ 订单执行  │
│ 数据分析   │ │ 信号生成   │ │ 仓位控制   │ │ 交易监控  │
│ 情绪分析   │ │ 回测验证   │ │ 止损管理   │ │ 滑点控制  │
└───────────┘ └───────────┘ └───────────┘ └───────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             ▼
                    ┌────────────────┐
                    │  Shared Memory │
                    │  (状态、历史)    │
                    └────────────────┘
```

## 技术栈

- **Agent框架**: LangGraph / LangChain
- **LLM**: Claude (Anthropic) / GPT-4 (OpenAI) / DeepSeek
- **数据源**: Yahoo Finance, Alpha Vantage, CCXT (加密货币)
- **回测**: Backtrader, VectorBT
- **分析**: Pandas, NumPy, TA-Lib
- **API**: FastAPI, WebSocket
- **Dashboard**: Streamlit / React
- **数据库**: SQLite / PostgreSQL + Redis
- **任务队列**: Celery

## License

MIT
