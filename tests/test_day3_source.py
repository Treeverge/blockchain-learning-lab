"""Behavior checks for the runnable Day 3 Python exercises."""

import hashlib
import pathlib
import subprocess
import sys
import unittest


DAY3 = pathlib.Path(__file__).resolve().parents[1] / "04-六天实战源码" / "day3-signatures-utxo"
sys.path.insert(0, str(DAY3))

from day3_core import (  # noqa: E402
    Ledger,
    Output,
    Transaction,
    UTXO,
    create_key,
    hash160,
    public_bytes,
    sign,
    sign_transaction,
    verify,
)
from script_engine import evaluate_p2pkh  # noqa: E402


class Day3SourceTests(unittest.TestCase):
    def setUp(self):
        self.alice = create_key()
        self.bob = create_key()
        self.eve = create_key()
        self.alice_pub = public_bytes(self.alice)
        self.bob_pub = public_bytes(self.bob)
        self.eve_pub = public_bytes(self.eve)
        self.ledger = Ledger({
            ("genesis", 0): UTXO(70, self.alice_pub),
            ("genesis", 1): UTXO(30, self.alice_pub),
            ("genesis", 2): UTXO(50, self.bob_pub),
        })

    def payment(self, signer=None, outputs=None, inputs=None):
        tx = Transaction(
            tuple(inputs or [("genesis", 0)]),
            tuple(outputs or [Output(45, self.bob_pub), Output(24, self.alice_pub)]),
        )
        return sign_transaction(tx, [signer or self.alice] * len(tx.inputs))

    def test_signature_binds_message_and_key(self):
        signature = sign(self.alice, b"pay Bob")
        self.assertTrue(verify(self.alice_pub, signature, b"pay Bob"))
        self.assertFalse(verify(self.alice_pub, signature, b"pay Eve"))
        self.assertFalse(verify(self.eve_pub, signature, b"pay Bob"))

    def test_hash160_is_sha256_then_ripemd160(self):
        expected = hashlib.new("ripemd160", hashlib.sha256(b"hello").digest()).digest()
        self.assertEqual(hash160(b"hello"), expected)

    def test_p2pkh_checks_both_key_hash_and_signature(self):
        signature = sign(self.alice, b"tx")
        self.assertTrue(evaluate_p2pkh(signature, self.alice_pub, hash160(self.alice_pub), b"tx"))
        self.assertFalse(evaluate_p2pkh(signature, self.eve_pub, hash160(self.alice_pub), b"tx"))
        self.assertFalse(evaluate_p2pkh(signature, self.alice_pub, hash160(self.alice_pub), b"changed"))

    def test_valid_payment_conserves_value_and_replay_fails(self):
        tx = self.payment()
        txid, fee = self.ledger.apply(tx)
        self.assertEqual(fee, 1)
        self.assertEqual(self.ledger.balance(self.alice_pub), 54)
        self.assertEqual(self.ledger.balance(self.bob_pub), 95)
        self.assertEqual(sum(u.amount for u in self.ledger.utxos.values()) + self.ledger.fees, 150)
        self.assertIn((txid, 0), self.ledger.utxos)
        with self.assertRaisesRegex(ValueError, "已花费|不存在"):
            self.ledger.apply(tx)

    def test_signed_conflicts_can_exist_before_confirmation(self):
        first = self.payment()
        conflict = self.payment(outputs=[Output(69, self.eve_pub)])
        self.ledger.apply(conflict)
        with self.assertRaisesRegex(ValueError, "已花费|不存在"):
            self.ledger.apply(first)

    def test_wrong_signer_rejected_without_state_change(self):
        before = dict(self.ledger.utxos)
        with self.assertRaisesRegex(ValueError, "签名|所有者"):
            self.ledger.apply(self.payment(signer=self.eve))
        self.assertEqual(self.ledger.utxos, before)

    def test_tamper_duplicate_input_and_inflation_rejected(self):
        valid = self.payment()
        tampered = Transaction(valid.inputs, (Output(46, self.bob_pub), Output(24, self.alice_pub)), valid.signatures)
        duplicate = self.payment(inputs=[("genesis", 0), ("genesis", 0)])
        inflated = self.payment(outputs=[Output(71, self.bob_pub)])
        for tx in (tampered, duplicate, inflated):
            with self.subTest(tx=tx):
                with self.assertRaises(ValueError):
                    self.ledger.apply(tx)
        self.assertEqual(self.ledger.balance(self.alice_pub), 100)

    def test_missing_signature_and_unspendable_output_are_rejected_atomically(self):
        valid = self.payment()
        unsigned = Transaction(valid.inputs, valid.outputs)
        bad_owner = self.payment(outputs=[Output(69, b"not a secp256k1 key")])
        for tx in (unsigned, bad_owner):
            with self.subTest(tx=tx):
                with self.assertRaises(ValueError):
                    self.ledger.apply(tx)
        self.assertEqual(self.ledger.balance(self.alice_pub), 100)
        self.assertEqual(self.ledger.fees, 0)

    def test_all_three_examples_run(self):
        for filename in ("01-keys-and-signatures.py", "02-utxo-model.py", "03-script-engine.py"):
            with self.subTest(filename=filename):
                result = subprocess.run(
                    [sys.executable, "-X", "utf8", str(DAY3 / filename)],
                    capture_output=True, text=True, timeout=20, check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("验证通过", result.stdout)
                self.assertNotIn("私钥 (16进制", result.stdout)


if __name__ == "__main__":
    unittest.main()
