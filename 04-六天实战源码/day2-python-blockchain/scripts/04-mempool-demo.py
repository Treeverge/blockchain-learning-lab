"""
待处理交易列表是什么？—— 交互式演示
"""
import time

print("=" * 60)
print("待处理交易列表 current_transactions 演示")
print("=" * 60)

# 模拟区块链的 current_transactions
current_transactions = []
chain = []

print("""
比喻：待处理交易列表 = 银行柜台前的排队区

你去银行转账：
  1. 填好单子 → 交给柜员 → 柜员放桌上（待处理）
  2. 柜员凑够 10 张单子 → 一起处理（挖矿打包）
  3. 处理完 → 单子归档（上链），桌上清空

Day 2 的 current_transactions 就是柜员桌上的那叠单子。
""")

# ===== 场景模拟 =====
print("=" * 60)
print("场景模拟：10 分钟内发生的事")
print("=" * 60)

# 第 1 分钟：Alice 来转账
print("\n第 1 分钟：Alice 来转账 50 给 Bob")
current_transactions.append({"sender": "Alice", "recipient": "Bob", "amount": 50})
print(f"  待处理列表: {current_transactions}")
print(f"  链上区块: {len(chain)} 个")

# 第 2 分钟：Charlie 来转账
print("\n第 2 分钟：Charlie 来转账 30 给 Dave")
current_transactions.append({"sender": "Charlie", "recipient": "Dave", "amount": 30})
print(f"  待处理列表: {current_transactions}")
print(f"  链上区块: {len(chain)} 个")

# 第 3 分钟：有人挖矿了！
print("\n第 3 分钟：有人挖矿了！")
print(f"  挖矿前 → 待处理列表: {current_transactions}")
print(f"  挖矿前 → 链上区块: {len(chain)} 个")

# 打包：把待处理交易全部拿走，加点奖励，做成区块
block = {
    "index": 1,
    "transactions": list(current_transactions),  # 全部打包
    "reward": {"sender": "0", "recipient": "miner", "amount": 1}
}
chain.append(block)
current_transactions = []  # 清空桌子！

print(f"  挖矿后 → 待处理列表: {current_transactions}  (清空了！)")
print(f"  挖矿后 → 链上区块: {len(chain)} 个")
print(f"  新区块包含: {block['transactions']}")

# 第 5 分钟：又来新交易
print("\n第 5 分钟：Eve 来转账 100 给 Frank")
current_transactions.append({"sender": "Eve", "recipient": "Frank", "amount": 100})
print(f"  待处理列表: {current_transactions}")

print("\n第 6 分钟：Grace 来转账 5 给 Henry")
current_transactions.append({"sender": "Grace", "recipient": "Henry", "amount": 5})
print(f"  待处理列表: {current_transactions}")

# 第 10 分钟：又有人挖矿
print("\n第 10 分钟：又有人挖矿了！")
block2 = {
    "index": 2,
    "transactions": list(current_transactions),
    "reward": {"sender": "0", "recipient": "miner2", "amount": 1}
}
chain.append(block2)
current_transactions = []
print(f"  挖矿后 → 待处理列表: {current_transactions}  (又清空了！)")
print(f"  挖矿后 → 链上区块: {len(chain)} 个")

# 总结
print("\n" + "=" * 60)
print("总结")
print("=" * 60)
print("""
待处理交易列表（current_transactions / mempool）的作用：

  1. 交易不是立刻上链的，先排队
  2. 挖矿时，矿工把排队的所有交易打包进一个区块
  3. 打包完，排队区清空，等下一批交易来

为什么要这样？

  答：因为挖矿很慢（比特币 10 分钟一个块）。
     如果每来一笔交易就挖一次矿，太慢了。
     所以攒够一批，一起打包。

Day 1 没有这个，因为 Day 1 是单机脚本，挖矿瞬间完成。
Day 2 有，因为 Day 2 模拟真实场景——交易随时来，挖矿要等。
""")

# 对比 Day 1 vs Day 2
print("=" * 60)
print("Day 1 vs Day 2 对比")
print("=" * 60)
print("""
Day 1 JS:
  createBlock(1, [tx1, tx2], prevHash)  → 直接写交易进区块
  （交易和区块同时创建，没有"排队"概念）

Day 2 Python:
  new_transaction(tx1)  → 先存进 current_transactions（排队）
  new_transaction(tx2)  → 继续排队
  mine()                → 挖矿时把排队的全部打包
  new_block() 里面: transactions = self.current_transactions
                  self.current_transactions = []  ← 清空
""")