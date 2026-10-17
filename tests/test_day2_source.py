"""Checks for the verified, no-server Day 2 Python fork exercise."""

import pathlib
import subprocess
import sys
import unittest
from unittest.mock import patch


ROOT = pathlib.Path(__file__).resolve().parents[1]
DAY2 = ROOT / "04-六天实战源码" / "day2-python-blockchain"
sys.path.insert(0, str(DAY2))
try:
    import verified_network as V
except ModuleNotFoundError as error:
    if error.name != "verified_network":
        raise
    V = None


class VerifiedNetworkTests(unittest.TestCase):
    def setUp(self):
        self.assertIsNotNone(V, "Day 2 verified_network.py 尚未实现")
        self.net = V.create_network()

    def test_signed_candidates_wait_in_independent_pools(self):
        x, y = self.net.candidates["X"], self.net.candidates["Y"]
        self.assertEqual(self.net.receive("A", x), "pending")
        self.assertEqual(self.net.receive("A", y), "pending-conflict")
        self.assertEqual(self.net.receive("C", y), "pending")
        self.assertEqual(self.net.receive("A", x), "duplicate")
        for node in self.net.nodes.values():
            self.assertEqual(node.ledger.balance(self.net.people["Alice"]), 100)
            self.assertEqual(node.ledger.balance(self.net.people["Bob"]), 50)

    def test_tie_then_valid_more_work_reorganizes_and_replaces_fees(self):
        self.net.receive("A", self.net.candidates["X"])
        self.net.receive("C", self.net.candidates["Y"])
        self.net.mine("A")
        self.net.mine("C")
        tie = self.net.adopt("A", self.net.nodes["C"].chain)
        self.assertEqual(tie["reason"], "tie")
        self.assertEqual(self.net.nodes["A"].ledger.balance(self.net.people["Bob"]), 95)
        self.net.mine("C")  # Empty block increases valid work.
        result = self.net.adopt("A", self.net.nodes["C"].chain)
        self.assertEqual(result["reason"], "more-work")
        node = self.net.nodes["A"]
        self.assertEqual(node.ledger.balance(self.net.people["Alice"]), 54)
        self.assertEqual(node.ledger.balance(self.net.people["Bob"]), 50)
        self.assertEqual(node.ledger.balance(self.net.people["Eve"]), 45)
        self.assertEqual(node.ledger.fees, 1)
        self.assertEqual(sum(u.amount for u in node.ledger.utxos.values()) + node.ledger.fees, 150)
        self.assertEqual(node.pending, [])  # Old X signature is valid, input is spent by Y.

    def test_invalid_longer_chain_cannot_win_with_real_proofs(self):
        self.net.receive("A", self.net.candidates["X"])
        self.net.mine("A")
        forged = self.net.forge_wrong_owner()
        bad = [self.net.genesis]
        bad.append(V.mine_block(bad, forged))
        bad.append(V.mine_block(bad))
        bad.append(V.mine_block(bad))
        self.assertTrue(all(block.hash.startswith("0") for block in bad[1:]))
        before = list(self.net.nodes["A"].chain)
        report = self.net.adopt("A", bad)
        self.assertEqual(report["reason"], "invalid")
        self.assertEqual(self.net.nodes["A"].chain, before)
        self.assertEqual(self.net.nodes["A"].ledger.balance(self.net.people["Bob"]), 95)

    def test_modified_signature_commitment_is_rejected(self):
        original = self.net.candidates["X"]
        chain = [self.net.genesis, V.mine_block([self.net.genesis], original)]
        altered = V.Transaction(original.inputs, original.outputs, (b"bad signature",))
        changed = V.replace(chain[1], transaction=altered)
        self.assertEqual(self.net.adopt("A", [chain[0], changed])["reason"], "invalid")
        self.assertEqual(len(self.net.nodes["A"].chain), 1)

    def test_unconfirmed_orphan_with_free_input_returns_to_pool(self):
        alice, bob = self.net.keys["Alice"], self.net.people["Bob"]
        independent = V.sign_transaction(
            V.Transaction((("genesis", 0),), (V.Output(29, bob),)), (alice,)
        )
        self.net.receive("A", independent)
        self.net.mine("A")
        self.net.receive("C", self.net.candidates["Y"])
        self.net.mine("C")
        self.net.mine("C")
        report = self.net.adopt("A", self.net.nodes["C"].chain)
        self.assertIn(independent.txid(), report["restored"])
        self.assertEqual([tx.txid() for tx in self.net.nodes["A"].pending], [independent.txid()])

    def test_dependent_orphans_return_to_pool_in_parent_child_order(self):
        alice = self.net.keys["Alice"]
        alice_pub = self.net.people["Alice"]
        bob_pub = self.net.people["Bob"]
        parent = V.sign_transaction(
            V.Transaction((("genesis", 0),), (V.Output(29, alice_pub),)), (alice,)
        )
        child = V.sign_transaction(
            V.Transaction(((parent.txid(), 0),), (V.Output(28, bob_pub),)), (alice,)
        )
        self.net.receive("A", parent)
        self.net.mine("A")
        self.net.receive("A", child)
        self.net.mine("A")
        for _ in range(3):
            self.net.mine("C")
        report = self.net.adopt("A", self.net.nodes["C"].chain)
        self.assertEqual(report["restored"], [parent.txid(), child.txid()])
        self.assertEqual([tx.txid() for tx in self.net.nodes["A"].pending],
                         [parent.txid(), child.txid()])

    def test_failed_mining_leaves_node_unchanged(self):
        self.net.receive("A", self.net.candidates["X"])
        node = self.net.nodes["A"]
        with self.assertRaisesRegex(ValueError, "次数|上限"):
            self.net.mine("A", max_attempts=0)
        self.assertEqual(len(node.chain), 1)
        self.assertEqual(node.ledger.balance(self.net.people["Alice"]), 100)
        self.assertEqual([tx.txid() for tx in node.pending], [self.net.candidates["X"].txid()])

    def test_demo_runs_without_server(self):
        result = subprocess.run(
            [sys.executable, "-X", "utf8", str(DAY2 / "scripts" / "05-verified-reorg.py")],
            capture_output=True, text=True, timeout=20, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Bob=50", result.stdout)
        self.assertIn("Eve=45", result.stdout)
        self.assertIn("无效长链被拒绝", result.stdout)


class UpstreamFlaskSmokeTests(unittest.TestCase):
    def setUp(self):
        import blockchain as upstream

        self.upstream = upstream
        self.previous_chain = upstream.blockchain
        upstream.blockchain = upstream.Blockchain()
        self.client = upstream.app.test_client()

    def tearDown(self):
        self.upstream.blockchain = self.previous_chain

    def test_chain_endpoint_and_reject_null_payloads(self):
        self.assertEqual(self.client.get("/chain").status_code, 200)
        for route in ("/transactions/new", "/nodes/register"):
            with self.subTest(route=route):
                response = self.client.post(route, data="null", content_type="application/json")
                self.assertEqual(response.status_code, 400)

    def test_unreachable_peer_does_not_crash_consensus_endpoint(self):
        self.upstream.blockchain.register_node("http://127.0.0.1:1")
        response = self.client.get("/nodes/resolve")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.upstream.blockchain.chain), 1)

    def test_empty_peer_chain_is_invalid(self):
        self.assertFalse(self.upstream.blockchain.valid_chain([]))

    def test_malformed_peer_chain_does_not_crash_consensus_endpoint(self):
        self.upstream.blockchain.register_node("http://127.0.0.1:1")

        class BrokenResponse:
            status_code = 200

            def json(self):
                return {"chain": [{}, {}]}

        with patch.object(self.upstream.requests, "get", return_value=BrokenResponse()):
            response = self.client.get("/nodes/resolve")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(self.upstream.blockchain.chain), 1)

    def test_invalid_node_registration_rejects_without_partial_update(self):
        response = self.client.post("/nodes/register", json={
            "nodes": ["http://127.0.0.1:1", ""],
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.upstream.blockchain.nodes, set())


if __name__ == "__main__":
    unittest.main()
