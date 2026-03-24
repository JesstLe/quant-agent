"""Executor Agent - Order execution and trade monitoring."""

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from quant_agent.agents.base import AgentRole, BaseAgent
from quant_agent.agents.strategist import SignalType, TradingSignal
from quant_agent.core.llm import LLMProvider
from quant_agent.core.memory import AgentMemory, MemoryType


class OrderType(Enum):
    """Types of orders."""

    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"
    TRAILING_STOP = "trailing_stop"


class OrderStatus(Enum):
    """Status of an order."""

    PENDING = "pending"
    SUBMITTED = "submitted"
    PARTIAL = "partial"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    EXPIRED = "expired"


class TimeInForce(Enum):
    """Time in force for orders."""

    DAY = "day"
    GTC = "good_till_cancelled"
    IOC = "immediate_or_cancel"
    FOK = "fill_or_kill"


@dataclass
class Order:
    """A trading order with full details."""

    order_id: str
    symbol: str
    side: str  # "buy" or "sell"
    quantity: float
    order_type: OrderType
    limit_price: float | None = None
    stop_price: float | None = None
    status: OrderStatus = OrderStatus.PENDING
    time_in_force: TimeInForce = TimeInForce.DAY

    # Execution details
    filled_quantity: float = 0.0
    avg_fill_price: float | None = None
    commission: float = 0.0
    slippage: float = 0.0

    # Timestamps
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    filled_at: str | None = None

    # Additional info
    broker_order_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "order_id": self.order_id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "order_type": self.order_type.value,
            "limit_price": self.limit_price,
            "stop_price": self.stop_price,
            "status": self.status.value,
            "time_in_force": self.time_in_force.value,
            "filled_quantity": self.filled_quantity,
            "avg_fill_price": self.avg_fill_price,
            "commission": self.commission,
            "slippage": self.slippage,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "filled_at": self.filled_at,
            "broker_order_id": self.broker_order_id,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Order":
        return cls(
            order_id=str(data["order_id"]),
            symbol=str(data["symbol"]),
            side=str(data["side"]),
            quantity=float(data["quantity"]),
            order_type=OrderType(str(data.get("order_type", OrderType.LIMIT.value))),
            limit_price=_optional_float(data.get("limit_price")),
            stop_price=_optional_float(data.get("stop_price")),
            status=OrderStatus(str(data.get("status", OrderStatus.PENDING.value))),
            time_in_force=TimeInForce(str(data.get("time_in_force", TimeInForce.DAY.value))),
            filled_quantity=float(data.get("filled_quantity", 0.0)),
            avg_fill_price=_optional_float(data.get("avg_fill_price")),
            commission=float(data.get("commission", 0.0)),
            slippage=float(data.get("slippage", 0.0)),
            created_at=str(data.get("created_at", datetime.now().isoformat())),
            updated_at=str(data.get("updated_at", datetime.now().isoformat())),
            filled_at=data.get("filled_at"),
            broker_order_id=data.get("broker_order_id"),
            metadata=dict(data.get("metadata", {})),
        )


@dataclass
class ExecutionResult:
    """Result of an order execution."""

    success: bool
    order_id: str
    status: OrderStatus
    filled_quantity: float
    avg_price: float | None
    message: str
    execution_time_ms: float
    slippage_bps: float  # basis points

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "order_id": self.order_id,
            "status": self.status.value,
            "filled_quantity": self.filled_quantity,
            "avg_price": self.avg_price,
            "message": self.message,
            "execution_time_ms": self.execution_time_ms,
            "slippage_bps": self.slippage_bps,
        }


@dataclass
class ManagedPosition:
    """Runtime position state with protective exits."""

    position_id: str
    symbol: str
    side: str  # "long" or "short"
    quantity: float
    initial_quantity: float
    entry_price: float
    stop_loss: float
    target_price: float
    risk_per_share: float
    strategy: str
    high_watermark: float
    low_watermark: float
    partial_exit_done: bool = False
    trailing_active: bool = False
    realized_pnl: float = 0.0
    opened_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    closed_at: str | None = None
    status: str = "open"
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "position_id": self.position_id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": self.quantity,
            "initial_quantity": self.initial_quantity,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "target_price": self.target_price,
            "risk_per_share": self.risk_per_share,
            "strategy": self.strategy,
            "high_watermark": self.high_watermark,
            "low_watermark": self.low_watermark,
            "partial_exit_done": self.partial_exit_done,
            "trailing_active": self.trailing_active,
            "realized_pnl": self.realized_pnl,
            "opened_at": self.opened_at,
            "updated_at": self.updated_at,
            "closed_at": self.closed_at,
            "status": self.status,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ManagedPosition":
        return cls(
            position_id=str(data["position_id"]),
            symbol=str(data["symbol"]),
            side=str(data["side"]),
            quantity=float(data["quantity"]),
            initial_quantity=float(data.get("initial_quantity", data["quantity"])),
            entry_price=float(data["entry_price"]),
            stop_loss=float(data["stop_loss"]),
            target_price=float(data["target_price"]),
            risk_per_share=float(data.get("risk_per_share", 0.0)),
            strategy=str(data.get("strategy", "unknown")),
            high_watermark=float(data.get("high_watermark", data["entry_price"])),
            low_watermark=float(data.get("low_watermark", data["entry_price"])),
            partial_exit_done=bool(data.get("partial_exit_done", False)),
            trailing_active=bool(data.get("trailing_active", False)),
            realized_pnl=float(data.get("realized_pnl", 0.0)),
            opened_at=str(data.get("opened_at", datetime.now(UTC).isoformat())),
            updated_at=str(data.get("updated_at", datetime.now(UTC).isoformat())),
            closed_at=data.get("closed_at"),
            status=str(data.get("status", "open")),
            metadata=dict(data.get("metadata", {})),
        )


class ExecutorAgent(BaseAgent):
    """
    Executor Agent responsibilities:
    - Execute approved trades with optimal routing
    - Monitor order status and handle partial fills
    - Manage slippage and execution quality
    - Implement smart order routing
    - Handle broker API integration
    """

    # Execution parameters
    MAX_SLIPPAGE_BPS = 50  # 50 basis points max slippage
    PARTIAL_FILL_THRESHOLD = 0.8  # Consider successful if 80% filled
    ORDER_TIMEOUT_SECONDS = 30

    def __init__(self, llm: LLMProvider, memory: AgentMemory | None = None):
        super().__init__(AgentRole.EXECUTOR, llm, memory)
        self._orders: dict[str, Order] = {}
        self._positions: dict[str, float] = {}  # symbol -> quantity
        self._managed_positions: dict[str, ManagedPosition] = {}
        self._execution_stats = {
            "total_orders": 0,
            "filled_orders": 0,
            "cancelled_orders": 0,
            "total_volume": 0.0,
            "total_commission": 0.0,
            "total_slippage_bps": 0.0,
        }

    @property
    def system_prompt(self) -> str:
        return """You are an Executor Agent responsible for optimal trade execution.

Your responsibilities:
1. Execute trades efficiently with minimal slippage
2. Monitor order status and handle issues
3. Optimize order routing and timing
4. Report execution quality metrics

Execution Guidelines:
- Use limit orders to control execution price
- Split large orders to minimize market impact
- Avoid market orders during high volatility periods
- Monitor for partial fills and handle appropriately
- Cancel and retry if execution quality is poor

Order Types:
- MARKET: Immediate execution, accepts slippage
- LIMIT: Execute at specified price or better
- STOP: Trigger market order at stop price
- STOP_LIMIT: Trigger limit order at stop price
- TRAILING_STOP: Dynamic stop that follows price

Risk Controls:
- Maximum slippage: 50 basis points
- Auto-cancel orders exceeding slippage limits
- Report any execution anomalies immediately

Always report:
- Execution status
- Fill price and quantity
- Slippage in basis points
- Any issues or warnings"""

    async def execute(self, task: str, **kwargs: Any) -> dict[str, Any]:
        """Execute an execution task."""
        task_handlers = {
            "place_order": self._place_order,
            "check_order": self._check_order,
            "cancel_order": self._cancel_order,
            "modify_order": self._modify_order,
            "get_positions": self._get_positions,
            "execution_report": self._execution_report,
            "sweep_orders": self._sweep_orders,
            "manage_positions": self._manage_positions,
        }

        handler = task_handlers.get(task)
        if not handler:
            return {"error": f"Unknown task: {task}"}

        return await handler(**kwargs)

    async def _place_order(
        self,
        signal: TradingSignal | dict[str, Any] | None = None,
        quantity: float | None = None,
        order_type: str = "limit",
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Place an order based on a trading signal."""
        signal_obj = self._normalize_signal(signal)
        if signal_obj is None:
            return {"error": "No signal provided"}

        # Determine order parameters
        side = "buy" if signal_obj.signal_type == SignalType.BUY else "sell"

        # Calculate quantity if not provided
        if quantity is None:
            capital = self.context.capital if self._context else 100000
            if signal_obj.entry_price and signal_obj.entry_price > 0:
                position_value = capital * signal_obj.position_size_pct
                quantity = position_value / signal_obj.entry_price
            else:
                return {"error": "Cannot determine quantity without entry price"}

        # Create order
        order_id = self._generate_order_id()
        order = Order(
            order_id=order_id,
            symbol=signal_obj.symbol,
            side=side,
            quantity=quantity,
            order_type=OrderType.LIMIT if order_type == "limit" else OrderType.MARKET,
            limit_price=signal_obj.entry_price,
            stop_price=signal_obj.stop_loss,
        )

        self._orders[order_id] = order
        self._execution_stats["total_orders"] += 1

        # Execute based on mode
        if self._context and self._context.mode == "paper":
            result = await self._execute_paper(order, signal_obj)
        else:
            result = await self._execute_live(order, signal_obj)

        # Update order status
        order.status = result.status
        order.filled_quantity = result.filled_quantity
        order.avg_fill_price = result.avg_price
        order.slippage = result.slippage_bps / 10000  # Convert bps to decimal
        order.updated_at = datetime.now().isoformat()

        if result.status == OrderStatus.FILLED:
            order.filled_at = datetime.now().isoformat()
            self._execution_stats["filled_orders"] += 1
            self._execution_stats["total_volume"] += result.filled_quantity * (result.avg_price or 0)
            self._execution_stats["total_slippage_bps"] += result.slippage_bps

            # Update position
            self._update_position(order)
            self._register_managed_position(order, signal_obj)

        # Store in memory
        self.memory.add(
            MemoryType.TRADE,
            content={
                "order": order.to_dict(),
                "signal": signal_obj.to_dict(),
                "execution_result": result.to_dict(),
            },
            metadata={"task": "place_order", "symbol": signal_obj.symbol},
            importance=0.9,
        )

        return {
            "success": result.success,
            "order": order.to_dict(),
            "execution": result.to_dict(),
        }

    async def _manage_positions(self, current_prices: dict[str, float], **kwargs: Any) -> dict[str, Any]:
        """Apply trailing stops, partial exits, and protective closes."""
        events: list[dict[str, Any]] = []

        for position in list(self._managed_positions.values()):
            if position.status != "open" or position.quantity <= 0:
                continue

            current_price = float(current_prices.get(position.symbol, 0.0) or 0.0)
            if current_price <= 0:
                continue

            position.high_watermark = max(position.high_watermark, current_price)
            position.low_watermark = min(position.low_watermark, current_price)
            position.updated_at = datetime.now(UTC).isoformat()

            favorable_move = (
                current_price - position.entry_price
                if position.side == "long"
                else position.entry_price - current_price
            )
            holding_minutes = self._holding_minutes(position)
            time_decay_minutes = int(position.metadata.get("time_decay_minutes", 0) or 0)

            if not position.partial_exit_done and favorable_move >= position.risk_per_share:
                closed_qty = min(position.quantity, max(position.quantity * 0.5, 0.0))
                if closed_qty > 0:
                    pnl = self._close_managed_position_slice(
                        position,
                        quantity=closed_qty,
                        fill_price=current_price,
                        reason="partial_exit",
                    )
                    position.partial_exit_done = True
                    position.trailing_active = True
                    position.stop_loss = (
                        max(position.stop_loss, position.entry_price)
                        if position.side == "long"
                        else min(position.stop_loss, position.entry_price)
                    )
                    events.append(
                        {
                            "symbol": position.symbol,
                            "reason": "partial_exit",
                            "price": current_price,
                            "quantity": closed_qty,
                            "pnl": pnl,
                        }
                    )

            if favorable_move >= position.risk_per_share:
                position.trailing_active = True

            if position.trailing_active:
                if position.side == "long":
                    position.stop_loss = max(position.stop_loss, position.high_watermark - position.risk_per_share)
                else:
                    position.stop_loss = min(position.stop_loss, position.low_watermark + position.risk_per_share)

            time_decay_hit = (
                time_decay_minutes > 0
                and holding_minutes >= time_decay_minutes
                and favorable_move < (position.risk_per_share * 0.5)
            )

            stop_hit = current_price <= position.stop_loss if position.side == "long" else current_price >= position.stop_loss
            target_hit = current_price >= position.target_price if position.side == "long" else current_price <= position.target_price

            if stop_hit or target_hit or time_decay_hit:
                reason = (
                    "time_decay_exit"
                    if time_decay_hit
                    else "trailing_stop" if stop_hit and position.trailing_active
                    else ("stop_loss" if stop_hit else "target_exit")
                )
                closed_qty = position.quantity
                pnl = self._close_managed_position_slice(
                    position,
                    quantity=closed_qty,
                    fill_price=current_price,
                    reason=reason,
                    close_all=True,
                )
                events.append(
                    {
                        "symbol": position.symbol,
                        "reason": reason,
                        "price": current_price,
                            "quantity": closed_qty,
                            "pnl": pnl,
                            "holding_minutes": holding_minutes,
                        }
                    )

        return {"events": events, "managed_positions": [position.to_dict() for position in self._managed_positions.values()]}

    async def _execute_paper(self, order: Order, signal: TradingSignal) -> ExecutionResult:
        """Simulate order execution for paper trading."""
        import random
        import time

        start_time = time.time()

        # Simulate market conditions
        base_price = order.limit_price or signal.entry_price or 100.0

        # Calculate slippage based on order type and size
        if order.order_type == OrderType.MARKET:
            # Market orders have higher slippage
            slippage_bps = random.uniform(5, 30)
        else:
            # Limit orders have controlled slippage
            slippage_bps = random.uniform(-5, 10)

        # Apply slippage
        if order.side == "buy":
            fill_price = base_price * (1 + slippage_bps / 10000)
        else:
            fill_price = base_price * (1 - slippage_bps / 10000)

        # Simulate fill (95% success rate for paper)
        success = random.random() < 0.95
        if success:
            status = OrderStatus.FILLED
            filled_qty = order.quantity
        else:
            status = OrderStatus.REJECTED
            filled_qty = 0
            fill_price = None
            slippage_bps = 0

        execution_time = (time.time() - start_time) * 1000  # ms

        return ExecutionResult(
            success=success,
            order_id=order.order_id,
            status=status,
            filled_quantity=filled_qty,
            avg_price=fill_price,
            message="Paper order executed successfully" if success else "Paper order rejected (simulated)",
            execution_time_ms=execution_time,
            slippage_bps=slippage_bps,
        )

    async def _execute_live(self, order: Order, signal: TradingSignal) -> ExecutionResult:
        """Execute order in live trading via broker API."""
        # Live execution connects to broker APIs (Alpaca, Interactive Brokers, etc.)
        # This implementation provides the structure for broker integration

        order.status = OrderStatus.SUBMITTED
        order.updated_at = datetime.now().isoformat()

        # Broker integration point - implement based on selected broker
        broker_adapter = self._get_broker_adapter()

        if broker_adapter is None:
            return ExecutionResult(
                success=False,
                order_id=order.order_id,
                status=OrderStatus.REJECTED,
                filled_quantity=0,
                avg_price=None,
                message="Live trading not configured - set up broker API credentials",
                execution_time_ms=0,
                slippage_bps=0,
            )

        # Submit to broker
        broker_result = await broker_adapter.submit_order(order)

        if broker_result.get("success"):
            order.broker_order_id = broker_result.get("broker_order_id")
            order.status = OrderStatus.SUBMITTED

            # Poll for fill
            fill_result = await self._poll_for_fill(order)

            return ExecutionResult(
                success=True,
                order_id=order.order_id,
                status=fill_result.get("status", OrderStatus.FILLED),
                filled_quantity=fill_result.get("filled_quantity", order.quantity),
                avg_price=fill_result.get("avg_price"),
                message="Order executed via broker",
                execution_time_ms=fill_result.get("execution_time_ms", 0),
                slippage_bps=fill_result.get("slippage_bps", 0),
            )
        else:
            order.status = OrderStatus.REJECTED
            return ExecutionResult(
                success=False,
                order_id=order.order_id,
                status=OrderStatus.REJECTED,
                filled_quantity=0,
                avg_price=None,
                message=broker_result.get("error", "Broker rejected order"),
                execution_time_ms=0,
                slippage_bps=0,
            )

    def _get_broker_adapter(self):
        """Get the appropriate broker adapter based on configuration."""
        # Import broker adapters when implemented
        # from quant_agent.execution.brokers import AlpacaAdapter, IBAdapter
        # settings = get_settings()
        # if settings.alpaca_api_key:
        #     return AlpacaAdapter(settings)
        return None

    async def _poll_for_fill(self, order: Order, timeout: int = 30) -> dict[str, Any]:
        """Poll broker for order fill status."""
        # Implementation depends on broker API
        return {
            "status": OrderStatus.FILLED,
            "filled_quantity": order.quantity,
            "avg_price": order.limit_price,
            "execution_time_ms": 100,
            "slippage_bps": 5,
        }

    async def _check_order(self, order_id: str, **kwargs: Any) -> dict[str, Any]:
        """Check status of an order."""
        order = self._orders.get(order_id)
        if not order:
            return {"error": f"Order not found: {order_id}"}

        return {
            "order": order.to_dict(),
            "remaining_quantity": order.quantity - order.filled_quantity,
            "is_complete": order.status in [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED],
        }

    async def _cancel_order(self, order_id: str, **kwargs: Any) -> dict[str, Any]:
        """Cancel an order."""
        order = self._orders.get(order_id)
        if not order:
            return {"error": f"Order not found: {order_id}"}

        if order.status in [OrderStatus.FILLED, OrderStatus.CANCELLED, OrderStatus.REJECTED]:
            return {"error": f"Cannot cancel order in status: {order.status.value}"}

        # Cancel via broker if live
        if self._context and self._context.mode != "paper":
            broker_adapter = self._get_broker_adapter()
            if broker_adapter:
                await broker_adapter.cancel_order(order.broker_order_id)

        order.status = OrderStatus.CANCELLED
        order.updated_at = datetime.now().isoformat()
        self._execution_stats["cancelled_orders"] += 1

        return {
            "order_id": order_id,
            "status": "cancelled",
            "message": "Order cancelled successfully",
            "order": order.to_dict(),
        }

    async def _modify_order(
        self,
        order_id: str,
        quantity: float | None = None,
        limit_price: float | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Modify an existing order."""
        order = self._orders.get(order_id)
        if not order:
            return {"error": f"Order not found: {order_id}"}

        if order.status not in [OrderStatus.PENDING, OrderStatus.SUBMITTED]:
            return {"error": f"Cannot modify order in status: {order.status.value}"}

        if quantity is not None:
            order.quantity = quantity
        if limit_price is not None:
            order.limit_price = limit_price

        order.updated_at = datetime.now().isoformat()

        return {
            "order_id": order_id,
            "status": "modified",
            "order": order.to_dict(),
        }

    async def _get_positions(self, **kwargs: Any) -> dict[str, Any]:
        """Get current positions."""
        return {
            "positions": self._positions,
            "total_positions": len([p for p in self._positions.values() if p != 0]),
            "managed_positions": [position.to_dict() for position in self._managed_positions.values()],
        }

    async def _execution_report(self, **kwargs: Any) -> dict[str, Any]:
        """Generate comprehensive execution quality report."""
        total = self._execution_stats["total_orders"]
        filled = self._execution_stats["filled_orders"]

        avg_slippage = (
            self._execution_stats["total_slippage_bps"] / filled if filled > 0 else 0
        )

        report = {
            "summary": {
                "total_orders": total,
                "filled_orders": filled,
                "cancelled_orders": self._execution_stats["cancelled_orders"],
                "fill_rate": filled / total if total > 0 else 0,
            },
            "volume": {
                "total_volume": self._execution_stats["total_volume"],
                "total_commission": self._execution_stats["total_commission"],
            },
            "quality": {
                "average_slippage_bps": avg_slippage,
                "slippage_rating": self._rate_slippage(avg_slippage),
            },
            "orders": {oid: o.to_dict() for oid, o in self._orders.items()},
        }

        # LLM analysis of execution quality
        prompt = f"""Analyze execution quality for this trading session:

{self._execution_stats}

Average Slippage: {avg_slippage:.2f} bps

Provide:
1. Overall execution quality assessment
2. Areas for improvement
3. Recommendations for better execution"""

        report["analysis"] = await self.think(prompt)

        return report

    @staticmethod
    def _normalize_signal(signal: TradingSignal | dict[str, Any] | None) -> TradingSignal | None:
        if signal is None:
            return None
        if isinstance(signal, TradingSignal):
            return signal
        return TradingSignal.from_dict(signal)

    async def _sweep_orders(self, symbol: str | None = None, **kwargs: Any) -> dict[str, Any]:
        """Cancel all open orders, optionally filtered by symbol."""
        cancelled = []

        for order_id, order in list(self._orders.items()):
            if symbol and order.symbol != symbol:
                continue
            if order.status in [OrderStatus.PENDING, OrderStatus.SUBMITTED, OrderStatus.PARTIAL]:
                result = await self._cancel_order(order_id)
                cancelled.append(order_id)

        return {
            "cancelled_orders": cancelled,
            "count": len(cancelled),
        }

    def _update_position(self, order: Order):
        """Update position after order fill."""
        symbol = order.symbol
        qty_change = order.filled_quantity if order.side == "buy" else -order.filled_quantity

        self._positions[symbol] = self._positions.get(symbol, 0) + qty_change

    def _register_managed_position(self, order: Order, signal: TradingSignal) -> None:
        """Create a managed position for newly opened signals."""
        if signal.signal_type not in {SignalType.BUY, SignalType.SELL}:
            return
        if order.avg_fill_price is None:
            return

        side = "long" if signal.signal_type == SignalType.BUY else "short"
        stop_loss = float(signal.stop_loss or order.avg_fill_price)
        target_price = float(signal.target_price or order.avg_fill_price)
        risk_per_share = abs(float(order.avg_fill_price) - stop_loss)
        if risk_per_share <= 0:
            risk_per_share = max(float(order.avg_fill_price) * 0.01, 0.01)

        position = ManagedPosition(
            position_id=f"POS-{uuid.uuid4().hex[:8].upper()}",
            symbol=order.symbol,
            side=side,
            quantity=float(order.filled_quantity or order.quantity),
            initial_quantity=float(order.filled_quantity or order.quantity),
            entry_price=float(order.avg_fill_price),
            stop_loss=stop_loss,
            target_price=target_price,
            risk_per_share=risk_per_share,
            strategy=str(signal.metadata.get("strategy", self.context.strategy if self._context else "unknown")),
            high_watermark=float(order.avg_fill_price),
            low_watermark=float(order.avg_fill_price),
            metadata=dict(signal.metadata),
        )
        self._managed_positions[position.position_id] = position

    @staticmethod
    def _holding_minutes(position: ManagedPosition) -> int:
        try:
            opened_at = datetime.fromisoformat(position.opened_at)
        except ValueError:
            return 0
        return max(0, int((datetime.now(UTC) - opened_at).total_seconds() // 60))

    def _close_managed_position_slice(
        self,
        position: ManagedPosition,
        *,
        quantity: float,
        fill_price: float,
        reason: str,
        close_all: bool = False,
    ) -> float:
        """Close all or part of a managed position and create a synthetic fill order."""
        if quantity <= 0:
            return 0.0

        exit_side = "sell" if position.side == "long" else "buy"
        order_id = self._generate_order_id()
        order = Order(
            order_id=order_id,
            symbol=position.symbol,
            side=exit_side,
            quantity=quantity,
            order_type=OrderType.MARKET,
            limit_price=fill_price,
            status=OrderStatus.FILLED,
            filled_quantity=quantity,
            avg_fill_price=fill_price,
            filled_at=datetime.now(UTC).isoformat(),
            metadata={
                "source": reason,
                "managed_position_id": position.position_id,
                "strategy": position.strategy,
            },
        )
        self._orders[order_id] = order
        self._execution_stats["total_orders"] += 1
        self._execution_stats["filled_orders"] += 1
        self._execution_stats["total_volume"] += quantity * fill_price
        self._update_position(order)

        pnl_per_share = fill_price - position.entry_price if position.side == "long" else position.entry_price - fill_price
        pnl = pnl_per_share * quantity
        position.realized_pnl += pnl
        position.quantity = max(0.0, position.quantity - quantity)
        position.updated_at = datetime.now(UTC).isoformat()

        if close_all or position.quantity <= 0:
            position.quantity = 0.0
            position.status = "closed"
            position.closed_at = datetime.now(UTC).isoformat()

        return pnl

    def _generate_order_id(self) -> str:
        """Generate a unique order ID."""
        return f"ORD-{uuid.uuid4().hex[:8].upper()}"

    def _rate_slippage(self, slippage_bps: float) -> str:
        """Rate slippage quality."""
        if slippage_bps <= 5:
            return "excellent"
        elif slippage_bps <= 15:
            return "good"
        elif slippage_bps <= 30:
            return "acceptable"
        else:
            return "poor"

    def export_state(self) -> dict[str, Any]:
        """Export executor state for persistence."""
        return {
            "orders": [order.to_dict() for order in self._orders.values()],
            "execution_stats": dict(self._execution_stats),
            "managed_positions": [position.to_dict() for position in self._managed_positions.values()],
        }

    def get_managed_positions(self) -> list[ManagedPosition]:
        """Return managed positions for dashboard projection."""
        return list(self._managed_positions.values())

    def restore_state(self, state: dict[str, Any]) -> None:
        """Restore executor state from persisted data."""
        restored_orders = [Order.from_dict(payload) for payload in state.get("orders", [])]
        self._orders = {order.order_id: order for order in restored_orders}
        self._execution_stats = {
            "total_orders": 0,
            "filled_orders": 0,
            "cancelled_orders": 0,
            "total_volume": 0.0,
            "total_commission": 0.0,
            "total_slippage_bps": 0.0,
            **state.get("execution_stats", {}),
        }
        restored_positions = [
            ManagedPosition.from_dict(payload)
            for payload in state.get("managed_positions", [])
            if isinstance(payload, dict)
        ]
        self._managed_positions = {position.position_id: position for position in restored_positions}
        self._positions = {}
        for order in restored_orders:
            if order.status == OrderStatus.FILLED:
                self._update_position(order)


def _optional_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
