"""Behavior checks for the Day 4 UTXO/account comparison script."""

import copy
import importlib.util
import pathlib
import subprocess
import sys
import unittest


SCRIPT = (pathlib.Path(__file__).resolve().parents[1] / "04-六天实战源码" /
          "day4-smart-contracts" / "01-utxo-vs-account.py")
SPEC = importlib.util.spec_from_file_location("day4_comparison", SCRIPT)
DAY4 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DAY4)


class Day4SourceTests(unittest.TestCase):
    def test_utxo_payment_consumes_input_and_replay_cannot_change_balances(self):
        ledger = DAY4.create_utxo_ledger()
        DAY4.apply_utxo_payment(ledger, "tx0#0", "Alice", "Bob", 45, "tx2")
        self.assertEqual(DAY4.utxo_balance(ledger, "Alice"), 55)
        self.assertEqual(DAY4.utxo_balance(ledger, "Bob"), 95)
        self.assertEqual(sum(output["amount"] for output in ledger.values()), 150)
        self.assertNotIn("tx0#0", ledger)
        self.assertEqual(ledger["tx2#0"], {"owner": "Bob", "amount": 45})
        self.assertEqual(ledger["tx2#1"], {"owner": "Alice", "amount": 25})
        before = copy.deepcopy(ledger)
        with self.assertRaisesRegex(ValueError, "已花费|不存在"):
            DAY4.apply_utxo_payment(ledger, "tx0#0", "Alice", "Bob", 45, "tx3")
        self.assertEqual(ledger, before)

    def test_utxo_rejects_wrong_owner_and_invalid_amount_atomically(self):
        ledger = DAY4.create_utxo_ledger()
        before = copy.deepcopy(ledger)
        for sender, amount in (("Eve", 45), ("Alice", 71), ("Alice", 0)):
            with self.subTest(sender=sender, amount=amount):
                with self.assertRaises(ValueError):
                    DAY4.apply_utxo_payment(ledger, "tx0#0", sender, "Bob", amount, "tx2")
                self.assertEqual(ledger, before)

    def test_account_nonce_replay_and_insufficient_balance_leave_state_unchanged(self):
        accounts = DAY4.create_account_ledger()
        DAY4.apply_account_payment(accounts, "Alice", "Bob", 45, nonce=0)
        self.assertEqual(accounts["Alice"], {"balance": 55, "nonce": 1})
        self.assertEqual(accounts["Bob"], {"balance": 95, "nonce": 0})
        self.assertEqual(sum(a["balance"] for a in accounts.values()), 150)
        before = copy.deepcopy(accounts)
        for amount, nonce in ((45, 0), (56, 1), (0, 1)):
            with self.subTest(amount=amount, nonce=nonce):
                with self.assertRaises(ValueError):
                    DAY4.apply_account_payment(accounts, "Alice", "Bob", amount, nonce)
                self.assertEqual(accounts, before)

    def test_script_reports_both_replays_and_scope(self):
        run = subprocess.run([sys.executable, "-X", "utf8", str(SCRIPT)],
                             capture_output=True, text=True, timeout=10, check=False)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("重复花费被拒绝", run.stdout)
        self.assertIn("nonce 重放被拒绝", run.stdout)
        self.assertIn("未模拟签名", run.stdout)


if __name__ == "__main__":
    unittest.main()
