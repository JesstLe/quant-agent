"""Streamlit Dashboard for QuantAgent."""

import streamlit as st
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from datetime import datetime, timedelta


st.set_page_config(
    page_title="QuantAgent Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
)


st.title("📊 QuantAgent Dashboard")
st.sidebar.title("Settings")


symbols = st.sidebar.multiselect(
    "Select Symbols",
    options=["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "JPM"],
    default=["AAPL", "MSFT", "GOOGL"],
)

strategy = st.sidebar.selectbox(
    "Strategy",
    options=["momentum", "mean_reversion", "breakout", "trend_following"],
    index=0,
)


col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Portfolio Value", "$100,000", "+2.5%")
with col2:
    st.metric("Today's P&L", "+$2,500", "+2.5%")
with col3:
    st.metric("Win Rate", "68%", "+5%")
with col4:
    st.metric("Sharpe Ratio", "1.85", "+0.12")


st.subheader("📈 Portfolio Performance")

dates = pd.date_range(end=datetime.now(), periods=30, freq="D")
portfolio_values = [100000 * (1 + 0.002 * i + 0.001 * (hash(str(d)) % 100) / 100) for i, d in enumerate(dates)]

fig = go.Figure()
fig.add_trace(go.Scatter(
    x=dates,
    y=portfolio_values,
    mode="lines",
    name="Portfolio Value",
    line=dict(color="#00D4AA", width=2),
))
fig.update_layout(
    height=400,
    margin=dict(l=0, r=0, t=0, b=0),
    xaxis_title="Date",
    yaxis_title="Value ($)",
)
st.plotly_chart(fig, use_container_width=True)


col1, col2 = st.columns(2)

with col1:
    st.subheader("🎯 Active Signals")

    signals_data = {
        "Symbol": ["AAPL", "MSFT", "GOOGL", "NVDA"],
        "Signal": ["BUY", "HOLD", "BUY", "SELL"],
        "Confidence": [0.85, 0.60, 0.78, 0.72],
        "Entry Price": [178.50, 378.25, 141.80, 485.00],
        "Target": [195.00, None, 155.00, 450.00],
        "Stop Loss": [170.00, None, 135.00, 500.00],
    }
    signals_df = pd.DataFrame(signals_data)
    st.dataframe(signals_df, use_container_width=True, hide_index=True)

with col2:
    st.subheader("📊 Position Allocation")

    positions = {
        "AAPL": 25,
        "MSFT": 20,
        "GOOGL": 15,
        "NVDA": 15,
        "Cash": 25,
    }

    fig_pie = go.Figure(data=[go.Pie(
        labels=list(positions.keys()),
        values=list(positions.values()),
        hole=0.4,
        marker_colors=["#00D4AA", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"],
    )])
    fig_pie.update_layout(height=350, margin=dict(l=0, r=0, t=0, b=0))
    st.plotly_chart(fig_pie, use_container_width=True)


st.subheader("⚡ Recent Trades")

trades_data = {
    "Time": ["10:30:15", "11:45:22", "14:20:08", "15:55:41"],
    "Symbol": ["AAPL", "MSFT", "NVDA", "GOOGL"],
    "Side": ["BUY", "SELL", "BUY", "BUY"],
    "Quantity": [50, 25, 10, 30],
    "Price": [178.50, 380.25, 485.00, 141.80],
    "P&L": ["-", "+$125.50", "-", "-"],
}
trades_df = pd.DataFrame(trades_data)
st.dataframe(trades_df, use_container_width=True, hide_index=True)


st.subheader("🤖 Agent Status")

agent_col1, agent_col2, agent_col3, agent_col4 = st.columns(4)

with agent_col1:
    st.info("🔬 **Researcher**\n\nStatus: Active\n\nLast Update: 2 min ago")

with agent_col2:
    st.info("🎯 **Strategist**\n\nStatus: Active\n\nSignals Generated: 4")

with agent_col3:
    st.warning("⚠️ **Risk Manager**\n\nStatus: Monitoring\n\nRisk Level: Medium")

with agent_col4:
    st.success("✅ **Executor**\n\nStatus: Ready\n\nOrders Today: 3")


st.sidebar.markdown("---")
st.sidebar.subheader("Controls")

if st.sidebar.button("🔄 Refresh Data"):
    st.rerun()

if st.sidebar.button("▶️ Start Trading"):
    st.sidebar.success("Trading started!")

if st.sidebar.button("⏹️ Stop Trading"):
    st.sidebar.warning("Trading stopped!")


st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: #888;'>"
    "QuantAgent v0.1.0 | Powered by Claude AI | "
    f"Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    "</div>",
    unsafe_allow_html=True,
)
