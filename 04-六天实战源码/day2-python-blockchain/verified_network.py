"""No-server Day 2 network lesson with signed UTXO replay.

This is a separate teaching model. The preserved upstream Flask example in
blockchain.py has different rules and must not be treated as its peer node.
"""

from dataclasses import dataclass, replace
import copy
import hashlib
import json
from pathlib import Path
import sys


DAY3 = Path(__file__).resolve().parent.parent / "day3-signatures-utxo"
if str(DAY3) not in sys.path:
    sys.path.insert(0, str(DAY3))
from day3_core import (  # noqa: E402
    Ledger, Output, Transaction, UTXO, create_key, public_bytes, sign_transaction,
)


DIFFICULTY_PREFIX = "0"  # One leading hex zero; expected work = 16 per block.


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def block_hash(index, previous_hash, commitment, nonce):
    message = json.dumps([index, previous_hash, commitment, nonce],
                         separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return sha256(message)


def commitment(transaction):
    # Day 3's teaching ID binds the signed body and the exact signature bytes.
    return "empty" if transaction is None else "tx:" + transaction.txid()


@dataclass(frozen=True)
class Block:
    index: int
    previous_hash: str
    commitment: str
    nonce: int
    transaction: Transaction | None
    hash: str


def mine_block(chain, transaction=None, max_attempts=100_000):
    """Produce a proof; transaction validity is checked by Network.replay."""
    if not chain or type(max_attempts) is not int or not 0 <= max_attempts <= 100_000:
        raise ValueError("需要已有链，且挖矿次数上限必须在 0 到 100000 之间")
    index = len(chain)
    previous_hash = chain[-1].hash
    record = commitment(transaction)
    for nonce in range(max_attempts):
        digest = block_hash(index, previous_hash, record, nonce)
        if digest.startswith(DIFFICULTY_PREFIX):
            return Block(index, previous_hash, record, nonce, transaction, digest)
    raise ValueError("已达到挖矿次数上限，未提交半成品")


@dataclass
class Node:
    chain: list
    ledger: Ledger
    pending: list


class Network:
    def __init__(self, keys, initial, genesis, candidates):
        self.keys = keys
        self.people = {name: public_bytes(key) for name, key in keys.items()}
        self.initial = dict(initial)
        self.genesis = genesis
        self.candidates = candidates
        self.nodes = {
            name: Node([genesis], Ledger(dict(initial)), []) for name in ("A", "B", "C")
        }

    def node(self, name):
        if name not in self.nodes:
            raise ValueError("请选择节点 A、B 或 C")
        return self.nodes[name]

    def replay(self, chain):
        """Check proof and every transaction from the shared initial UTXOs."""
        if not chain or chain[0] != self.genesis:
            raise ValueError("创世锚点不匹配")
        ledger = Ledger(dict(self.initial))
        for index, block in enumerate(chain[1:], start=1):
            if (block.index != index or block.previous_hash != chain[index - 1].hash
                    or block.commitment != commitment(block.transaction)
                    or block.hash != block_hash(block.index, block.previous_hash,
                                                block.commitment, block.nonce)
                    or not block.hash.startswith(DIFFICULTY_PREFIX)):
                raise ValueError(f"区块 #{index} 的链接、摘要、哈希或工作量证明无效")
            if block.transaction is not None:
                ledger.apply(block.transaction)
        return ledger, 16 * (len(chain) - 1)

    @staticmethod
    def _pending_again(ledger, transactions):
        pending, restored, dropped, seen, remaining = [], [], [], set(), []
        for tx in transactions:
            txid = tx.txid()
            if txid in seen or txid in ledger.confirmed:
                continue
            seen.add(txid)
            remaining.append(tx)

        # Replay accepted pending transactions in a temporary ledger, so a
        # child of a detached transaction can be rechecked after its parent.
        tentative = copy.deepcopy(ledger)
        while remaining:
            deferred, progressed = [], False
            for tx in remaining:
                txid = tx.txid()
                if any(set(tx.inputs) & set(other.inputs) for other in pending):
                    dropped.append(txid)
                    continue
                try:
                    tentative.apply(tx)
                except ValueError:
                    deferred.append(tx)
                else:
                    pending.append(tx)
                    restored.append(txid)
                    progressed = True
            if not progressed:
                dropped.extend(tx.txid() for tx in deferred)
                break
            remaining = deferred
        return pending, restored, dropped

    def receive(self, name, transaction):
        node = self.node(name)
        try:
            copy.deepcopy(node.ledger).apply(transaction)
        except ValueError:
            return "invalid"
        if any(tx.txid() == transaction.txid() for tx in node.pending):
            return "duplicate"
        if any(set(tx.inputs) & set(transaction.inputs) for tx in node.pending):
            return "pending-conflict"
        node.pending.append(transaction)
        return "pending"

    def mine(self, name, max_attempts=100_000):
        node = self.node(name)
        self.replay(node.chain)
        transaction = node.pending[0] if node.pending else None
        block = mine_block(node.chain, transaction, max_attempts)
        candidate = [*node.chain, block]
        ledger, _ = self.replay(candidate)
        pending, _, _ = self._pending_again(ledger, node.pending)
        node.chain, node.ledger, node.pending = candidate, ledger, pending
        return block

    def adopt(self, name, candidate):
        node = self.node(name)
        _, current_work = self.replay(node.chain)
        try:
            ledger, proposed_work = self.replay(candidate)
        except (ValueError, IndexError, AttributeError, TypeError):
            return {"accepted": False, "reason": "invalid", "restored": [], "dropped": []}
        if candidate[-1].hash == node.chain[-1].hash:
            reason = "same-tip"
        elif proposed_work == current_work:
            reason = "tie"
        elif proposed_work < current_work:
            reason = "less-work"
        else:
            reason = "more-work"
        if reason != "more-work":
            return {"accepted": False, "reason": reason, "restored": [], "dropped": []}

        common = 0
        while (common < len(node.chain) and common < len(candidate)
               and node.chain[common].hash == candidate[common].hash):
            common += 1
        orphaned = [block.transaction for block in node.chain[common:]
                    if block.transaction is not None]
        pending, restored, dropped = self._pending_again(ledger, [*node.pending, *orphaned])
        node.chain, node.ledger, node.pending = list(candidate), ledger, pending
        orphaned_ids = {tx.txid() for tx in orphaned}
        return {
            "accepted": True,
            "reason": reason,
            "restored": [txid for txid in restored if txid in orphaned_ids],
            "dropped": dropped,
        }

    def forge_wrong_owner(self):
        original = self.candidates["X"]
        return sign_transaction(Transaction(original.inputs, original.outputs),
                                (self.keys["Eve"],))


def create_network():
    keys = {name: create_key() for name in ("Alice", "Bob", "Eve")}
    people = {name: public_bytes(key) for name, key in keys.items()}
    initial = {
        ("genesis", 0): UTXO(30, people["Alice"]),
        ("genesis", 1): UTXO(70, people["Alice"]),
        ("genesis", 2): UTXO(50, people["Bob"]),
    }
    seed = json.dumps([[list(ref), utxo.amount, utxo.owner.hex()]
                       for ref, utxo in sorted(initial.items())], separators=(",", ":"))
    anchor = "initial-utxos:" + sha256(seed.encode("utf-8"))
    digest = block_hash(0, "0" * 64, anchor, 0)
    genesis = Block(0, "0" * 64, anchor, 0, None, digest)
    candidates = {}
    for label, recipient in (("X", "Bob"), ("Y", "Eve")):
        unsigned = Transaction((("genesis", 1),),
                               (Output(45, people[recipient]), Output(24, people["Alice"])))
        candidates[label] = sign_transaction(unsigned, (keys["Alice"],))
    return Network(keys, initial, genesis, candidates)
