"""Minimal P2PKH stack walkthrough, not a Bitcoin Script interpreter."""

from day3_core import hash160, verify


def evaluate_p2pkh(signature, pubkey, expected_key_hash, message, trace=None):
    """Evaluate PUSH sig, PUSH key, DUP, HASH160, EQUALVERIFY, CHECKSIG."""
    stack = [signature, pubkey]

    def record(op):
        if trace is not None:
            trace.append((op, len(stack)))

    record("PUSH signature, PUSH pubkey")
    stack.append(stack[-1])
    record("OP_DUP")
    stack.append(hash160(stack.pop()))
    record("OP_HASH160")
    stack.append(expected_key_hash)
    record("PUSH expected key hash")
    actual = stack.pop()
    locked = stack.pop()
    if actual != locked:
        record("OP_EQUALVERIFY failed")
        return False
    record("OP_EQUALVERIFY")
    key = stack.pop()
    sig = stack.pop()
    valid = verify(key, sig, message)
    stack.append(valid)
    record("OP_CHECKSIG")
    return len(stack) == 1 and stack[0] is True
