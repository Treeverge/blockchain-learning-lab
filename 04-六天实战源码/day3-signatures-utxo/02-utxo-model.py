"""Day 3-2: signed UTXO transfers and a local confirmation order.

Conceptual reference: Bitcoin Core src/primitives/transaction.h. This lesson
does not implement Bitcoin serialization, Script, mempool, or consensus.
"""

from day3_core import Ledger, Output, Transaction, UTXO, create_key, public_bytes, sign_transaction


def main():
    alice, bob, eve = create_key(), create_key(), create_key()
    alice_pub, bob_pub, eve_pub = map(public_bytes, (alice, bob, eve))
    ledger = Ledger({
        ("genesis", 0): UTXO(30, alice_pub),
        ("genesis", 1): UTXO(70, alice_pub),
        ("genesis", 2): UTXO(50, bob_pub),
    })
    input_ref = ("genesis", 1)
    payment = sign_transaction(Transaction(
        (input_ref,), (Output(45, bob_pub), Output(24, alice_pub)),
    ), (alice,))
    conflict = sign_transaction(Transaction(
        (input_ref,), (Output(69, eve_pub),)
    ), (alice,))

    print("Day 3-2 · UTXO 与确认顺序")
    print("初始：Alice 有 30 + 70，Bob 有 50，总量 150。")
    print("Alice 对两个引用同一输入的候选分别签名。签名都有效，但最多确认一笔。")
    print("候选 A：输入 70，Bob 收到 45，Alice 找零 24，费用 1。")
    print("候选 B：输入 70，Eve 收到 69，费用 1。")

    txid, fee = ledger.apply(payment)
    print(f"候选 A 验证通过并确认：交易 ID {txid[:16]}…，费用 {fee}。")
    print(f"确认后 Alice={ledger.balance(alice_pub)}，Bob={ledger.balance(bob_pub)}，费用累计={ledger.fees}。")
    print(f"对账：未花费输出 {sum(u.amount for u in ledger.utxos.values())} + 费用 {ledger.fees} = 150。")
    for label, candidate in (("候选 A 重放", payment), ("候选 B 冲突", conflict)):
        try:
            ledger.apply(candidate)
        except ValueError as error:
            print(f"{label}被拒绝：{error}")
    forged = sign_transaction(Transaction((("genesis", 0),), (Output(29, eve_pub),)), (eve,))
    try:
        ledger.apply(forged)
    except ValueError as error:
        print(f"Eve 冒签 Alice 未花费输入被拒绝：{error}")
    print("结论：验签、输入归属、未花费状态和金额守恒是四道独立检查；真实网络还需共识决定历史。")


if __name__ == "__main__":
    main()
