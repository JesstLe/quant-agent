"""Regression checks for target/stop bracket direction."""

import unittest

from quant_agent.agents.executor import ExecutorAgent
from quant_agent.agents.strategist import SignalType, _is_valid_bracket_structure, _normalize_brackets
from quant_agent.core.llm import get_llm


class BracketNormalizationTests(unittest.TestCase):
    def test_buy_brackets_are_normalized_below_and_above_entry(self) -> None:
        stop_loss, target_price = _normalize_brackets(
            SignalType.BUY,
            100.0,
            108.0,
            95.0,
            default_stop_loss_pct=0.05,
            risk_reward_ratio=2.0,
        )
        self.assertTrue(_is_valid_bracket_structure(SignalType.BUY, 100.0, stop_loss, target_price))

    def test_sell_brackets_are_normalized_below_and_above_entry(self) -> None:
        stop_loss, target_price = _normalize_brackets(
            SignalType.SELL,
            100.0,
            94.0,
            108.0,
            default_stop_loss_pct=0.05,
            risk_reward_ratio=2.0,
        )
        self.assertTrue(_is_valid_bracket_structure(SignalType.SELL, 100.0, stop_loss, target_price))

    def test_executor_restore_corrects_stale_inverted_short_brackets(self) -> None:
        executor = ExecutorAgent(get_llm())
        executor.restore_state(
            {
                "managed_positions": [
                    {
                        "position_id": "POS-TEST",
                        "symbol": "TEST",
                        "side": "short",
                        "quantity": 10,
                        "initial_quantity": 10,
                        "entry_price": 100.0,
                        "stop_loss": 95.0,
                        "target_price": 110.0,
                        "risk_per_share": 5.0,
                        "strategy": "fortress",
                    }
                ]
            }
        )
        restored = executor.get_managed_positions()[0]
        self.assertGreater(restored.stop_loss, restored.entry_price)
        self.assertLess(restored.target_price, restored.entry_price)


if __name__ == "__main__":
    unittest.main()
