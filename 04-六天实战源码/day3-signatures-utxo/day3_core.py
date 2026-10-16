"""Small, executable Day 3 teaching model; not Bitcoin consensus code.

ECDSA uses secp256k1. Transaction serialization, IDs, initial balances, and
ledger confirmation are local rules chosen to make authorization observable.
"""

from dataclasses import dataclass, field
import hashlib
import json

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec


def create_key():
    return ec.generate_private_key(ec.SECP256K1())


def public_bytes(private_key):
    return private_key.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )


def sign(private_key, message):
    return private_key.sign(message, ec.ECDSA(hashes.SHA256()))


def verify(pubkey, signature, message):
    try:
        key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pubkey)
        key.verify(signature, message, ec.ECDSA(hashes.SHA256()))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False


def valid_public_key(pubkey):
    if not isinstance(pubkey, bytes):
        return False
    try:
        ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256K1(), pubkey)
        return True
    except ValueError:
        return False


def hash160(data):
    """Bitcoin's HASH160 primitive; this is not an address encoder."""
    return hashlib.new("ripemd160", hashlib.sha256(data).digest()).digest()


@dataclass(frozen=True)
class UTXO:
    amount: int
    owner: bytes


@dataclass(frozen=True)
class Output:
    amount: int
    owner: bytes


@dataclass(frozen=True)
class Transaction:
    inputs: tuple
    outputs: tuple
    signatures: tuple = ()

    def body(self):
        """Canonical teaching message: every input reference and output is signed."""
        payload = {
            "version": 1,
            "inputs": [[txid, index] for txid, index in self.inputs],
            "outputs": [[output.amount, output.owner.hex()] for output in self.outputs],
        }
        return json.dumps(payload, ensure_ascii=False, sort_keys=True,
                          separators=(",", ":")).encode("utf-8")

    def txid(self):
        material = self.body() + b"|" + b"|".join(sig.hex().encode() for sig in self.signatures)
        return hashlib.sha256(material).hexdigest()


def sign_transaction(transaction, private_keys):
    keys = tuple(private_keys)
    if len(keys) != len(transaction.inputs):
        raise ValueError("每个输入必须有一把签名私钥")
    message = transaction.body()
    return Transaction(transaction.inputs, transaction.outputs,
                       tuple(sign(key, message) for key in keys))


@dataclass
class Ledger:
    utxos: dict
    fees: int = 0
    confirmed: set = field(default_factory=set)

    def balance(self, owner):
        return sum(utxo.amount for utxo in self.utxos.values() if utxo.owner == owner)

    def apply(self, transaction):
        """Validate first, then change the local UTXO set atomically."""
        if not transaction.inputs or not transaction.outputs:
            raise ValueError("交易必须有输入和输出")
        if len(transaction.inputs) != len(set(transaction.inputs)):
            raise ValueError("一笔交易内不能重复引用同一输入")
        if len(transaction.signatures) != len(transaction.inputs):
            raise ValueError("每个输入都必须有签名")
        if any(type(out.amount) is not int or out.amount <= 0 or not valid_public_key(out.owner)
               for out in transaction.outputs):
            raise ValueError("输出金额必须为正整数且所有者必须是有效公钥")

        message = transaction.body()
        total_in = 0
        for key, signature in zip(transaction.inputs, transaction.signatures):
            utxo = self.utxos.get(key)
            if utxo is None:
                raise ValueError("输入不存在或已花费")
            if not verify(utxo.owner, signature, message):
                raise ValueError("签名与输入所有者或交易内容不匹配")
            total_in += utxo.amount

        total_out = sum(out.amount for out in transaction.outputs)
        if total_out > total_in:
            raise ValueError("输出超过输入，金额不守恒")
        txid = transaction.txid()
        if txid in self.confirmed or any((txid, i) in self.utxos
                                         for i in range(len(transaction.outputs))):
            raise ValueError("交易 ID 已存在")

        for key in transaction.inputs:
            del self.utxos[key]
        for index, output in enumerate(transaction.outputs):
            self.utxos[(txid, index)] = UTXO(output.amount, output.owner)
        fee = total_in - total_out
        self.fees += fee
        self.confirmed.add(txid)
        return txid, fee
