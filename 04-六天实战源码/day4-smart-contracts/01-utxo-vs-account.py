"""
======================================================================
Day 4 — 从比特币到以太坊：理解"世界计算机"
======================================================================

第一天你要理解一个核心转换：
  比特币 = UTXO + 脚本（存钱、花钱、验签）
  以太坊 = 账户模型 + 智能合约（存钱、花钱、跑程序）


====================================
核心区别：UTXO vs 账户模型
====================================

比特币的 UTXO 你已经理解了：
  钱是一堆"硬币"（UTXO），你花一枚整枚毁掉，找零回来一枚新的。
  这跟现金一样——你钱包里是一张张钞票，不是余额数字。

以太坊是账户模型：
  每个地址就是一个账户，有余额，转账就是加减法。
  跟银行一样——你的账户余额 100，转 20 给别人，余额变 80。

两者的直观对比：
                                        ┌──────────────────┐
  比特币                        │ UTXO集合         │
  Alice's UTXOs:                │ (tx0,#0):30→Alice│
    UTXO1: 30 BTC               │ (tx0,#1):70→Alice│
    UTXO2: 70 BTC               │ (tx1,#0):50→Bob  │
  总余额: 100 BTC（自己算的）    │                  │
                                └──────────────────┘

                                        ┌──────────────────┐
  以太坊                        │ 全局状态树        │
  Alice.balance: 100 ETH        │ Alice: 100       │
  Bob.balance:   50 ETH         │ Bob:   50        │
                                │ ...              │
                                └──────────────────┘

====================================
最关键的区别：两类账户
====================================

以太坊有两种账户，这是它跟比特币最大的不同：

  1. 外部账户 (EOA) — 就是你
     只有余额 + nonce
     由私钥控制（跟比特币一样）
     只能发起交易

  2. 合约账户 — 就是一段代码
     有余额 + 代码 + 存储空间
     没有私钥！不能被"拥有"
     收到交易时，自动执行代码

这就是"世界计算机"：
  你发起一笔交易 → 这交易不是"转钱"而是"调用合约里的函数"
  → 合约代码在以太坊的每个节点上执行 → 结果改变全局状态


====================================
一个故事帮你记住
====================================

比特币 ≈ 黄金
  你有一块金条（UTXO）
  你把它切成两块（花 UTXO = 毁旧 + 造新 UTXO）

以太坊 ≈ 自动贩卖机
  你投币（发交易 + ETH）
  机器执行代码 → 自动出结果
  机器里能存状态（比如"谁投了多少钱"）

以太坊的名字由来：Ethereum = Ether（以太，一种假想的介质）+ eum（空间）
→ "所有节点共同运行的大计算机"
"""

print("=" * 60)
print("Day 4-1: UTXO vs 账户模型")
print("=" * 60)

# ============================================================
# UTXO 转账（比特币）
# ============================================================
print("\n=== 比特币 UTXO 转账 ===")

# 初始状态：两枚硬币
utxo1 = {"id": "tx0#0", "amount": 70, "owner": "Alice", "exists": True}
utxo2 = {"id": "tx0#1", "amount": 30, "owner": "Alice", "exists": True}
utxo3 = {"id": "tx1#0", "amount": 50, "owner": "Bob", "exists": True}

utxos = [utxo1, utxo2, utxo3]

def utxo_balance(who):
    return sum(u["amount"] for u in utxos if u["owner"] == who and u["exists"])

print(f"  初始 UTXO 集合: {[(u['id'], u['amount']) for u in utxos if u['exists']]}")
print(f"  Alice = {utxo_balance('Alice')}, Bob = {utxo_balance('Bob')}")

# Alice 给 Bob 转 45
# 步骤: 找一枚够 45 的硬币 → 整个花掉 → 创建两枚新硬币
to_spend = utxo1  # 70 BTC 那枚
to_spend["exists"] = False
new_utxo_for_bob = {"id": "tx2#0", "amount": 45, "owner": "Bob", "exists": True}
new_utxo_for_alice = {"id": "tx2#1", "amount": 25, "owner": "Alice", "exists": True}
utxos.extend([new_utxo_for_bob, new_utxo_for_alice])

print(f"\n  Alice 花费 tx0#0 (70 BTC)")
print(f"  创建 tx2#0 (45 → Bob), tx2#1 (25 → Alice 找零)")
print(f"  剩余 UTXO: {[(u['id'], u['amount']) for u in utxos if u['exists']]}")
print(f"  Alice = {utxo_balance('Alice')}, Bob = {utxo_balance('Bob')}")


# ============================================================
# 账户模型转账（以太坊）
# ============================================================
print(f"\n=== 以太坊 账户模型转账 ===")

# 初始状态：一本大账本
world_state = {
    "Alice":   {"balance": 100, "nonce": 0},
    "Bob":     {"balance": 50,  "nonce": 0},
}

print(f"  初始状态: Alice={world_state['Alice']['balance']}, "
      f"Bob={world_state['Bob']['balance']}")

# Alice 给 Bob 转 45
# 步骤: 直接修改
world_state["Alice"]["balance"] -= 45
world_state["Alice"]["nonce"] += 1
world_state["Bob"]["balance"] += 45

print(f"  Alice 转 45 给 Bob")
print(f"  直接修改状态!")
print(f"  Alice={world_state['Alice']['balance']}, "
      f"Bob={world_state['Bob']['balance']}")

# ============================================================
# 总结
# ============================================================
print(f"\n=== 总结 ===")
print(f"""
  UTXO: 转账 → 毁硬币 + 造新硬币 → 多枚硬币 -> 找零是必须的
  账户: 转账 → 读余额 → 减余额 → 加余额 → 不需要找零

  这决定了两个重要的不同:
  1. UTXO 天然防双花（花过的硬币不存在了）
     账户模型需要 nonce 防重放（每笔交易一个递增序号）

  2. UTXO 不能"存状态"（只能记"谁拥有多少钱"）
     账户模型可以（合约账户有存储空间，能记任意数据）
     → 这就是智能合约能做的事！
""")
