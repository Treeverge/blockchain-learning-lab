"""
Day 2 共识实验：最长链原则
两个节点各自挖自己的链，然后连接，看最长链如何胜出
"""
import requests
import time

NODE1 = "http://localhost:5001"
NODE2 = "http://localhost:5002"

print("=" * 60)
print("Day 2 共识实验：最长链规则")
print("=" * 60)

# 查看两个节点的初始状态
r1 = requests.get(f"{NODE1}/chain").json()
r2 = requests.get(f"{NODE2}/chain").json()
print(f"\n初始状态:")
print(f"  节点1 (5001): {r1['length']} 个区块")
print(f"  节点2 (5002): {r2['length']} 个区块")

# 节点2 独立挖 3 个块
print(f"\n【步骤 1】节点2 自己挖 3 个区块（形成自己的链）")
for i in range(3):
    start = time.time()
    r = requests.get(f"{NODE2}/mine")
    elapsed = time.time() - start
    data = r.json()
    print(f"  挖到区块 #{data['index']}, proof={data['proof']}, 耗时 {elapsed:.2f}秒")

r1 = requests.get(f"{NODE1}/chain").json()
r2 = requests.get(f"{NODE2}/chain").json()
print(f"\n当前状态:")
print(f"  节点1: {r1['length']} 个区块")
print(f"  节点2: {r2['length']} 个区块")

# 连接两个节点
print(f"\n【步骤 2】连接两个节点（把节点2 注册到节点1 的网络）")
requests.post(f"{NODE1}/nodes/register", json={
    "nodes": ["http://localhost:5002"]
})
print(f"  节点1 已认识节点2")

# 节点1 执行共识算法
print(f"\n【步骤 3】节点1 执行共识算法（/nodes/resolve）")
print(f"  节点1 询问节点2: '你的链多长？'")
print(f"  节点2 的链({r2['length']} 个块) > 节点1 的链({r1['length']} 个块)")
print(f"  节点1 验证节点2 的链...")
r = requests.get(f"{NODE1}/nodes/resolve")
result = r.json()
print(f"  结果: {result['message']}")

# 最终状态
r1 = requests.get(f"{NODE1}/chain").json()
r2 = requests.get(f"{NODE2}/chain").json()
print(f"\n最终状态:")
print(f"  节点1: {r1['length']} 个区块")
print(f"  节点2: {r2['length']} 个区块")

# 验证两条链是否相同
chain1_hashes = [b.get('previous_hash', '') for b in r1['chain']]
chain2_hashes = [b.get('previous_hash', '') for b in r2['chain']]
if r1['length'] == r2['length']:
    print(f"  两条链现在长度相同！节点1 采用了节点2 的链")

print(f"\n" + "=" * 60)
print("共识算法 = 最长链胜出")
print("=" * 60)
print("""
这就是区块链解决"分叉"的方法：

  节点1:  [0]-[1]-[2]-[3]-[4]-[5]  5个区块
  节点2:  [0]-[1]-[2]-[3]            3个区块（这是另一个新链）

  连接后，节点1 发现自己有 5 个块，节点2 有 3 个块
  → 没有人需要换链

  但如果节点2 挖了 6 个块：
  节点1 发现自己只有 5 个块，节点2 有 6 个块
  → 节点1 验证节点2 的链，有效！
  → 节点1 放弃自己的链，采用节点2 的链
  → 全网统一到同一条链上
""")