"""Day 3-1: secp256k1 ECDSA, authorization versus identity.

Conceptual references: Bitcoin Core src/key.h and src/pubkey.h. The message
below is a teaching string, not Bitcoin's transaction signature preimage.
"""

from day3_core import create_key, public_bytes, sign, verify


def main():
    alice = create_key()
    eve = create_key()
    alice_public = public_bytes(alice)
    eve_public = public_bytes(eve)
    message = "花费 Alice 的一笔输出，支付 Bob 45 单位".encode("utf-8")

    print("Day 3-1 · 密钥与签名")
    print(f"公钥：{alice_public.hex()[:32]}…，长度 {len(alice_public)} 字节")
    print("私钥只在内存中使用；演示不会输出私钥或其片段。")

    signature = sign(alice, message)
    print(f"对固定消息签名：{len(signature)} 字节 DER 编码 ECDSA 签名")
    print(f"原消息验证：{'验证通过' if verify(alice_public, signature, message) else '验证失败'}")
    print(f"篡改收款人：{'错误地通过' if verify(alice_public, signature, message.replace(b'Bob', b'Eve')) else '验证失败'}")
    print(f"Eve 用自己的密钥签名，Alice 公钥验证：{'错误地通过' if verify(alice_public, sign(eve, message), message) else '验证失败'}")
    print(f"Eve 公钥验证 Alice 签名：{'错误地通过' if verify(eve_public, signature, message) else '验证失败'}")
    print("结论：签名证明持有相应私钥；它本身不证明现实身份、输入归属、余额或交易已确认。")


if __name__ == "__main__":
    main()
