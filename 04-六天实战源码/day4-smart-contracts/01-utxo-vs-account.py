"""Day 4: 用同一笔 45 单位付款比较 UTXO 与账户状态。

这是纯 Python 的最小账本：单位没有真实币值，身份是可信的字符串。
未模拟签名、交易序列化、手续费、Gas、网络共识或链重组。
真实签名与 UTXO 校验见 Day 3，账户执行回滚见本章网页与 Solidity 实验。
"""


def create_utxo_ledger():
    """键是输出 ID；只有仍可花费的输出留在集合中。"""
    return {
        "tx0#0": {"owner": "Alice", "amount": 70},
        "tx0#1": {"owner": "Alice", "amount": 30},
        "tx1#0": {"owner": "Bob", "amount": 50},
    }


def utxo_balance(ledger, owner):
    return sum(output["amount"] for output in ledger.values()
               if output["owner"] == owner)


def apply_utxo_payment(ledger, input_id, sender, recipient, amount, txid):
    """先校验，再消费整个输入并创建收款与找零输出；本例手续费为零。"""
    source = ledger.get(input_id)
    if source is None:
        raise ValueError("输入不存在或已花费")
    if source["owner"] != sender:
        raise ValueError("输入所有者不匹配")
    if not isinstance(amount, int) or amount <= 0 or amount > source["amount"]:
        raise ValueError("付款金额必须在可用输入范围内")
    if not recipient or recipient == sender:
        raise ValueError("本例要求不同的有效收款人")
    payment_id, change_id = f"{txid}#0", f"{txid}#1"
    if payment_id in ledger or change_id in ledger or input_id in (payment_id, change_id):
        raise ValueError("新输出 ID 已存在")

    change = source["amount"] - amount
    del ledger[input_id]
    ledger[payment_id] = {"owner": recipient, "amount": amount}
    if change:
        ledger[change_id] = {"owner": sender, "amount": change}


def create_account_ledger():
    return {
        "Alice": {"balance": 100, "nonce": 0},
        "Bob": {"balance": 50, "nonce": 0},
    }


def apply_account_payment(accounts, sender, recipient, amount, nonce):
    """比较期望 nonce 与余额后提交；这里没有手续费或执行失败。"""
    if sender not in accounts or recipient not in accounts or sender == recipient:
        raise ValueError("本例要求两个不同的现有账户")
    source = accounts[sender]
    if nonce != source["nonce"]:
        raise ValueError("nonce 不匹配，旧交易不能重放")
    if not isinstance(amount, int) or amount <= 0 or amount > source["balance"]:
        raise ValueError("金额无效或余额不足")

    source["balance"] -= amount
    source["nonce"] += 1
    accounts[recipient]["balance"] += amount


def run_demo():
    print("=" * 60)
    print("Day 4-1: UTXO vs 账户模型")
    print("=" * 60)

    utxos = create_utxo_ledger()
    print("\n=== UTXO：整枚输入被消费，另建收款与找零 ===")
    print(f"  初始 Alice={utxo_balance(utxos, 'Alice')}, Bob={utxo_balance(utxos, 'Bob')}")
    apply_utxo_payment(utxos, "tx0#0", "Alice", "Bob", 45, "tx2")
    print(f"  剩余可花费输出: {list(utxos.items())}")
    print(f"  转账后 Alice={utxo_balance(utxos, 'Alice')}, Bob={utxo_balance(utxos, 'Bob')}")
    try:
        apply_utxo_payment(utxos, "tx0#0", "Alice", "Bob", 45, "tx3")
    except ValueError as error:
        print(f"  重复花费被拒绝：{error}")

    accounts = create_account_ledger()
    print("\n=== 账户：扣余额、加余额、递增发送者 nonce ===")
    print(f"  初始 Alice={accounts['Alice']}, Bob={accounts['Bob']}")
    apply_account_payment(accounts, "Alice", "Bob", 45, nonce=0)
    print(f"  转账后 Alice={accounts['Alice']}, Bob={accounts['Bob']}")
    try:
        apply_account_payment(accounts, "Alice", "Bob", 45, nonce=0)
    except ValueError as error:
        print(f"  nonce 重放被拒绝：{error}")

    print("\n=== 读懂边界 ===")
    print("  两种账本都从总量 150 变为 Alice 55、Bob 95；有效性来自校验规则，不是数据结构自动保证。")
    print("  UTXO 还可附带脚本条件；账户状态还可包含合约代码与持久存储。")
    print("  未模拟签名、手续费、Gas 或网络：冲突交易可先被不同节点看到，最终结果要看有效链。")
    print("  账户的已纳入执行失败可能消耗 Gas 并递增 nonce；本例只展示纳入前拒绝与成功付款。")


if __name__ == "__main__":
    run_demo()
