"""Cross-check the fixed Day 5 LP source example against the lesson's ledger."""

import copy
import importlib.util
from pathlib import Path
import subprocess
import sys
import unittest


SCRIPT = (Path(__file__).resolve().parents[1] / "04-六天实战源码" /
          "day5-defi" / "04-lp-vs-hold.py")
SPEC = importlib.util.spec_from_file_location("lp_source", SCRIPT)
LP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LP)
U = 1_000_000


class LPSourceTests(unittest.TestCase):
    def joined(self):
        state = LP.create_state()
        initial = LP.totals(state)
        LP.deposit(state, 100 * U)
        self.assertEqual(LP.totals(state), initial)
        return state

    def test_deposit_creates_fair_shares_without_moving_assets_outside_ledger(self):
        state = self.joined()
        self.assertEqual(state["shares_total"], 1100 * U)
        self.assertEqual(state["lp_shares"], 100 * U)
        self.assertEqual(state["balances"]["pool"], {"A": 1100 * U, "B": 1100 * U})
        self.assertEqual(state["balances"]["lp"], {"A": 0, "B": 0})

    def test_price_change_alone_does_not_move_assets(self):
        state = self.joined()
        before = copy.deepcopy(state["balances"])
        LP.set_price(state, 4 * U)
        self.assertEqual(state["balances"], before)
        self.assertEqual(LP.comparison(state)["lp_value"], 500 * U)

    def test_arbitrage_has_real_funding_and_conserves_both_assets(self):
        state = self.joined()
        LP.set_price(state, 4 * U)
        before = LP.totals(state)
        trade = LP.arbitrage(state)
        self.assertEqual(trade, {"paid_B": 1100 * U, "received_A": 550 * U,
                                 "market_paid_B": 2200 * U, "profit_B": 1100 * U})
        amm_path = SCRIPT.with_name("01-amm-demo.py")
        amm_spec = importlib.util.spec_from_file_location("amm_source", amm_path)
        amm = importlib.util.module_from_spec(amm_spec)
        amm_spec.loader.exec_module(amm)
        self.assertEqual(trade["received_A"],
                         amm.quote_output(1100 * U, 1100 * U, trade["paid_B"], 0))
        self.assertEqual(state["balances"]["pool"], {"A": 550 * U, "B": 2200 * U})
        self.assertEqual(state["balances"]["arbitrage"], {"A": 0, "B": 11100 * U})
        self.assertEqual(state["balances"]["market"], {"A": 100550 * U, "B": 97800 * U})
        self.assertEqual(LP.totals(state), before)

    def test_withdrawal_compares_the_same_assets_at_the_same_price(self):
        state = self.joined()
        LP.set_price(state, 4 * U)
        LP.arbitrage(state)
        comparison = LP.comparison(state)
        self.assertEqual(comparison, {"claim": {"A": 50 * U, "B": 200 * U},
                                      "lp_value": 400 * U, "hold_value": 500 * U,
                                      "difference": -100 * U})
        before = LP.totals(state)
        self.assertEqual(LP.withdraw(state), {"A": 50 * U, "B": 200 * U})
        self.assertEqual(state["balances"]["lp"], {"A": 50 * U, "B": 200 * U})
        self.assertEqual(LP.totals(state), before)

    def test_unprofitable_trade_fails_without_partial_balance_changes(self):
        state = self.joined()
        before = copy.deepcopy(state)
        with self.assertRaises(ValueError):
            LP.arbitrage(state)
        self.assertEqual(state, before)

    def test_insufficient_arbitrage_or_market_cash_is_atomic(self):
        for actor in ("arbitrage", "market"):
            with self.subTest(actor=actor):
                state = self.joined()
                LP.set_price(state, 4 * U)
                state["balances"][actor]["B"] = 1000 * U
                before = copy.deepcopy(state)
                with self.assertRaisesRegex(ValueError, "资金不足"):
                    LP.arbitrage(state)
                self.assertEqual(state, before)

    def test_cli_explains_relative_loss_and_scope(self):
        run = subprocess.run([sys.executable, "-X", "utf8", str(SCRIPT)],
                             capture_output=True, text=True, timeout=10, check=False)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("50.000000 A + 200.000000 B", run.stdout)
        self.assertIn("相对持有 -20%", run.stdout)
        self.assertIn("无手续费", run.stdout)
        self.assertIn("外部市场余额", run.stdout)
        self.assertIn("A 总量", run.stdout)


if __name__ == "__main__":
    unittest.main()
