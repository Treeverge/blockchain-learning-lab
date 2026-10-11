"""
Day 2 实验：完整加密货币系统
"""
import requests
import time

BASE = "http://localhost:5001"

print("=" * 60)
print("Day 2 实验：完整加密货币系统")
print("=" * 60)

# 1. 查看创世链
print("\n【步骤 1】查看当前链")
r = requests.get(f"{BASE}/chain")
data = r.json()
print(f"  链长度: {data['length']}")
for block in data['chain']:
    print(f"  区块 #{block['index']}: proof={block['proof']}, 交易={len(block['transactions'])}笔")

# 2. 添加交易
print("\n【步骤 2】添加交易")
r = requests.post(f"{BASE}/transactions/new", json={
    "sender": "Alice", "recipient": "Bob", "amount": 50
})
print(f"  {r.json()['message']}")

r = requests.post(f"{BASE}/transactions/new", json={
    "sender": "Bob", "recipient": "Charlie", "amount": 20
})
print(f"  {r.json()['message']}")

# 3. 挖矿打包
print("\n【步骤 3】挖矿打包交易")
start = time.time()
r = requests.get(f"{BASE}/mine")
elapsed = time.time() - start
block = r.json()
print(f"  挖到区块 #{block['index']}！")
print(f"  proof(nonce) = {block['proof']}, 耗时 {elapsed:.2f}秒")
print(f"  包含 {len(block['transactions'])} 笔交易:")
for tx in block['transactions']:
    label = "[coinbase 奖励]" if tx['sender'] == '0' else ""
    print(f"    {tx['sender']} -> {tx['recipient']} : {tx['amount']} {label}")

# 4. 验证链
print("\n【步骤 4】验证整条链")
r = requests.get(f"{BASE}/chain")
chain_data = r.json()
print(f"  链长度: {chain_data['length']}")

# 手动验证：每个区块的 previous_hash 是否对上
chain = chain_data['chain']
import hashlib, json

def hash_block(block):
    block_copy = dict(block)
    block_str = json.dumps(block_copy, sort_keys=True).encode()
    return hashlib.sha256(block_str).hexdigest()

all_valid = True
for i in range(1, len(chain)):
    prev_hash = chain[i]['previous_hash']
    expected = hash_block(chain[i-1])
    if prev_hash != expected:
        print(f"  [FAIL] 区块 {chain[i]['index']}: previous_hash 不匹配!")
        all_valid = False
    else:
        print(f"  [OK] 区块 {chain[i]['index']}: previous_hash 匹配")

if all_valid:
    print(f"  结论: 链完整，未被篡改")
