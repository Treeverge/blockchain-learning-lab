"""Day 3-3: a readable P2PKH stack trace.

Conceptual references: Bitcoin Core src/script/script.h and interpreter.cpp.
Only five stack steps are modeled; Bitcoin signature-hash and Script rules are
much larger. HASH160 itself uses SHA-256 followed by RIPEMD-160.
"""

from day3_core import create_key, hash160, public_bytes, sign
from script_engine import evaluate_p2pkh


def main():
    alice, eve = create_key(), create_key()
    alice_public, eve_public = public_bytes(alice), public_bytes(eve)
    lock = hash160(alice_public)
    message = b"spend output 0 to Bob:45"
    signature = sign(alice, message)

    print("Day 3-3 · P2PKH 栈演示")
    print(f"锁定条件 HASH160(公钥)：{lock.hex()}")
    trace = []
    result = evaluate_p2pkh(signature, alice_public, lock, message, trace)
    for operation, depth in trace:
        print(f"  {operation:<25} 栈深 {depth}")
    print(f"原消息和 Alice 公钥：{'验证通过' if result else '验证失败'}")
    print(f"Eve 公钥：{'错误地通过' if evaluate_p2pkh(signature, eve_public, lock, message) else '在公钥哈希检查处失败'}")
    print(f"篡改后的消息：{'错误地通过' if evaluate_p2pkh(signature, alice_public, lock, b'spend output 0 to Eve:45') else '在签名检查处失败'}")
    print("结论：锁定公钥哈希与交易签名都要通过；还需 UTXO 状态和完整交易规则。")


if __name__ == "__main__":
    main()
