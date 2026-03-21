# QuantAgent Setup Guide

## Quick Start

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

### 3. 运行示例

```bash
# 查看可用Agent
python -m quant_agent agents

# 运行回测
python -m quant_agent run-backtest --strategy momentum --start 2024-01-01 --end 2024-03-31

# 启动Paper Trading
python -m quant_agent start --mode paper
```

### 4. 埥看支持的模型

```bash
python -m quant_agent models
```

## 项目结构

```
quant-agent/
├── quant_agent/           # Core package
│   ├── agents/             # Multi-agent system
│   ├── core/              # LLM & Memory & Tools
│   ├── data/              # Data sources
│   └── backtest/          # Backtesting engine
├── frontend/              # React Dashboard
├── tests/               # Test suite
└── .env.example          # Environment template
```

## Architecture

```
┌─────────────────┐     ┌───────────────┐
│   Coordinator │────▶│ Researcher │
│               │     │  Strategist │
│               │     │  Risk Mgr │
│               │     │  Executor │
└─────────────────┘     └───────────────┘
```

## Agent Workflow

1. **Researcher** collects market data and sentiment
2. **Strategist** generates trading signals
3. **Risk Manager** validates and sizes positions
4. **Executor** places and monitors orders
5. **Coordinator** orchestrates entire process
