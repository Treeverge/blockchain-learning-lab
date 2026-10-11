"""
======================================================================
Day 3 — 第二部分：UTXO 交易模型
======================================================================
对照 Bitcoin Core 源码: src/primitives/transaction.h

你要理解的核心问题：
  你有一笔钱存在区块链上，你怎么花它？怎么防止同一笔钱花两次？

答案：UTXO = Unspent Transaction Output（未花费的交易输出）

这不是一个"账户余额"模型，而是一个"钞票流动"模型。


====================================
从 Bitcoin Core 源码看交易结构
====================================

// src/primitives/transaction.h

// COutPoint: 指向系统中某个"硬币"的指针
// 这个类就是一句话:"我要花掉 txid#n 这笔钱"
class COutPoint {
    Txid hash;      // 哪笔交易创建了这枚"硬币"
    uint32_t n;     // 那笔交易的第 n 个输出
};

// CTxIn: 交易的输入 — 指"我要花掉这笔钱 + 我证明我有权花它"
class CTxIn {
    COutPoint prevout;      // 指向某个存在的 UTXO（要花的钱）
    CScript scriptSig;      // 解锁脚本 = 签名 + 公钥（证明我是主人）
    uint32_t nSequence;     // 时间锁相关（可以先忽略）
};

// CTxOut: 交易的输出 — 指"这笔钱现在归谁"
class CTxOut {
    CAmount nValue;          // 金额（单位：聪，1 BTC = 1亿聪）
    CScript scriptPubKey;    // 锁定脚本 = "谁能花这笔钱"（用公钥/地址锁住）
};

// CTransaction: 整个交易
// 核心逻辑: ∑inputs(被销毁的 UTXO) → ∑outputs(新创建的 UTXO)
class CTransaction {
    const vector<CTxIn> vin;     // 输入列表 = 你要花掉的 UTXO
    const vector<CTxOut> vout;   // 输出列表 = 新创建的 UTXO
    const uint32_t version;      // 版本号
    const uint32_t nLockTime;    // 锁定时间
};


====================================
UTXO 模型 vs 账户模型
====================================

账户模型（以太坊、银行）:           UTXO 模型（比特币）:
┌──────────────────────┐             ┌──────────────────────┐
│ Alice: 余额 100      │             │ UTXO#1: 30 BTC → Alice│
│ Bob:   余额 50       │             │ UTXO#2: 70 BTC → Alice│
│ Charlie: 余额 0      │             │ UTXO#3: 50 BTC → Bob  │
│                      │             │                      │
│ Alice 转 Bob 20:     │             │ Alice 要给 Bob 45 BTC: │
│  Alice.balance -= 20 │             │  花掉 UTXO#2(70)      │
│  Bob.balance   += 20 │             │  创建 UTXO#4: 45→Bob  │
└──────────────────────┘             │  创建 UTXO#5: 25→Alice│
                                     │  (找零! 70-45=25)    │
                                     └──────────────────────┘

UTXO 的关键规则:
  1. 每个 UTXO 只能被花一次（花完就从 UTXO 集合中删除）
  2. 花 UTXO 时必须整个花掉，不能只花一部分
  3. 如果要转的金额小于 UTXO 面额 → 找零（创建新的 UTXO 给自己）
  4. 交易费 = 所有输入之和 - 所有输出之和

这种设计天然防止双花：因为 UTXO 花了就没了，同一个 UTXO 不能花两次。


运行方式: python 02-utxo-model.py
"""

import hashlib
import json
from ecdsa import SigningKey, VerifyingKey, SECP256k1

print("=" * 60)
print("Day 3-2: UTXO 交易模型")
print("=" * 60)


# ==========================================
# Step 1: 定义 UTXO 数据结构
# ==========================================

class UTXO:
    """对应 Bitcoin Core 中的 COutPoint + CTxOut 组合

    一个 UTXO = 一个还没被花掉的"硬币"
    它记录了: 面额多少 + 属于谁（用公钥锁定）
    """
    def __init__(self, tx_id, output_index, amount, owner_pubkey):
        self.tx_id = tx_id              # 哪个交易创建了这个 UTXO
        self.output_index = output_index # 那个交易的第几个输出
        self.amount = amount             # 面额
        self.owner_pubkey = owner_pubkey # 所有者的公钥（谁能花这个 UTXO）

    def __repr__(self):
        return f"UTXO({self.amount}BTC, owner={self.owner_pubkey[:20]}...)"

    def key(self):
        """UTXO 的唯一标识：交易ID + 输出序号"""
        return (self.tx_id, self.output_index)


# ==========================================
# Step 2: 创建初始的 UTXO 集合（模拟区块链状态）
# ==========================================

print("\n[步骤 1] 初始化 — 系统里有 3 个 UTXO")

# Alice 的密钥对
alice_sk = SigningKey.generate(curve=SECP256k1)
alice_pk = alice_sk.get_verifying_key().to_string().hex()

# Bob 的密钥对
bob_sk = SigningKey.generate(curve=SECP256k1)
bob_pk = bob_sk.get_verifying_key().to_string().hex()

# UTXO 集合 — 这就是整个比特币网络的"当前状态"
# 对应 Bitcoin Core 中的 UTXO set (LevelDB 存储)
utxo_set = {}

# 创建初始 UTXO（模拟之前有人转钱给 Alice）
utxo_set[("tx0", 0)] = UTXO("tx0", 0, 30, alice_pk)
utxo_set[("tx0", 1)] = UTXO("tx0", 1, 70, alice_pk)
utxo_set[("tx1", 0)] = UTXO("tx1", 0, 50, bob_pk)

print(f"  UTXO#1: ({utxo_set[('tx0',0)].tx_id},#{utxo_set[('tx0',0)].output_index}) — {utxo_set[('tx0',0)].amount}BTC, 属于 Alice")
print(f"  UTXO#2: ({utxo_set[('tx0',1)].tx_id},#{utxo_set[('tx0',1)].output_index}) — {utxo_set[('tx0',1)].amount}BTC, 属于 Alice")
print(f"  UTXO#3: ({utxo_set[('tx1',0)].tx_id},#{utxo_set[('tx1',0)].output_index}) — {utxo_set[('tx1',0)].amount}BTC, 属于 Bob")

# 计算 Alice 的总余额
alice_utxos = [u for u in utxo_set.values() if u.owner_pubkey == alice_pk]
alice_balance = sum(u.amount for u in alice_utxos)
bob_balance = sum(u.amount for u in utxo_set.values() if u.owner_pubkey == bob_pk)
print(f"\n  当前余额: Alice={alice_balance}BTC, Bob={bob_balance}BTC")


# ==========================================
# Step 3: Alice 转账 — 构造交易
# ==========================================

print("\n[步骤 2] Alice 要转给 Bob 45 BTC")

# 选中要花的 UTXO
# Alice 有一张 70 的 UTXO，不够 45？够了但需要找零
inputs_to_spend = [utxo_set[("tx0", 1)]]  # 花掉 70 BTC 的 UTXO#2
total_input = sum(u.amount for u in inputs_to_spend)
print(f"  Alice 选择花掉 UTXO#2 ({total_input}BTC)")
print(f"  转账目标: Bob 收到 45 BTC")

# 构造交易
# 对应 Bitcoin Core: CMutableTransaction
tx_id = "tx2"
outputs = []
outputs.append({"amount": 45, "owner": bob_pk, "desc": "支付给 Bob"})

# 找零：45 需要付给 Bob，输入是 70
change = total_input - 45
if change > 0:
    outputs.append({"amount": change, "owner": alice_pk, "desc": "找零给 Alice"})

print(f"  构造输出:")
for out in outputs:
    name = out["desc"]
    print(f"    → {out['amount']}BTC ({name})")

fee = total_input - sum(o["amount"] for o in outputs)
if fee > 0:
    print(f"    交易费: {fee}BTC (留给矿工)")
else:
    print(f"    交易费: 0BTC")


# ==========================================
# Step 4: 对交易做签名（证明 Alice 有权花这些 UTXO）
# ==========================================

print("\n[步骤 3] Alice 对交易做签名")

# 对应 Bitcoin Core 中:
#   SignatureHash(...)  → 计算交易的哈希
#   CKey::Sign(hash)    → 用私钥签名

# 交易的"核心信息" — 签名要覆盖的内容
# 对应 interpreter.h 中的 SIGHASH_ALL: 签名覆盖所有输入和所有输出
tx_core = {
    "version": 1,
    "inputs": [{"tx_id": u.tx_id, "output_index": u.output_index}
                for u in inputs_to_spend],
    "outputs": [{"amount": o["amount"], "owner": o["owner"]}
                for o in outputs],
}

tx_json = json.dumps(tx_core, sort_keys=True)
tx_hash = hashlib.sha256(tx_json.encode()).digest()

# Alice 对每个 input 各签一次名
# 真实比特币中这里更复杂（每个 input 可以有不同的签名方式）
signatures = []
for i, utxo in enumerate(inputs_to_spend):
    # 验证：这个 UTXO 确实属于 Alice 吗？
    if utxo.owner_pubkey != alice_pk:
        print(f"  ❌ Input#{i}: 这个 UTXO 不属于 Alice！跳过签名")
        continue
    sig = alice_sk.sign(tx_hash)
    signatures.append(sig)
    print(f"  Input#{i}({utxo.key()}): 签名完成，长度={len(sig)}字节")


# ==========================================
# Step 5: 验证交易并更新 UTXO 集合
# ==========================================

print("\n[步骤 4] 全网节点验证这笔交易")

# 模拟一个节点收到交易后做的验证工作
tx_valid = True

# 验证 1: 每个 input 引用的 UTXO 是否真的存在且未被花掉
print(f"  验证1: 输入的 UTXO 是否存在且未被花掉?")
for i, utxo in enumerate(inputs_to_spend):
    key = utxo.key()
    if key in utxo_set:
        print(f"    Input#{i} {key}: ✅ 存在")
    else:
        print(f"    Input#{i} {key}: ❌ 不存在或已被花掉!")
        tx_valid = False

# 验证 2: 每个 input 的签名是否有效
print(f"  验证2: 签名的有效性?")
for i, (utxo, sig) in enumerate(zip(inputs_to_spend, signatures)):
    # 从 UTXO 中取得所有者的公钥，验证签名
    owner_vk = VerifyingKey.from_string(
        bytes.fromhex(utxo.owner_pubkey), curve=SECP256k1
    )
    try:
        owner_vk.verify(sig, tx_hash)
        print(f"    Input#{i}: ✅ 签名有效 — {utxo.owner_pubkey[:20]}... 的公钥验证通过")
    except Exception:
        print(f"    Input#{i}: ❌ 签名无效!")
        tx_valid = False

# 验证 3: 输入总额 >= 输出总额（不能无中生有）
total_out = sum(o["amount"] for o in outputs)
print(f"  验证3: 金额守恒? Input={total_input}BTC, Output={total_out}BTC")
if total_input >= total_out:
    print(f"    ✅ 金额守恒（差额 = 矿工费）")
else:
    print(f"    ❌ 输出大于输入，试图无中生有!")
    tx_valid = False


# ==========================================
# Step 6: 如果验证通过，更新 UTXO 集合
# ==========================================

if tx_valid:
    print(f"\n[步骤 5] 交易有效！更新 UTXO 集合")

    # 1. 删除被花掉的 UTXO
    for utxo in inputs_to_spend:
        del utxo_set[utxo.key()]
        print(f"  删除: {utxo.key()}")

    # 2. 创建新的 UTXO
    for idx, output in enumerate(outputs):
        new_utxo = UTXO(tx_id, idx, output["amount"], output["owner"])
        utxo_set[new_utxo.key()] = new_utxo
        owner_name = "Alice" if output["owner"] == alice_pk else "Bob"
        print(f"  创建: ({tx_id},#{idx}) — {output['amount']}BTC → {owner_name}")

    # 3. 显示最终状态
    alice_utxos = [u for u in utxo_set.values() if u.owner_pubkey == alice_pk]
    bob_utxos = [u for u in utxo_set.values() if u.owner_pubkey == bob_pk]
    print(f"\n  最终 UTXO 集合:")
    for u in utxo_set.values():
        owner = "Alice" if u.owner_pubkey == alice_pk else "Bob"
        print(f"    ({u.tx_id},#{u.output_index}): {u.amount}BTC → {owner}")
    print(f"  最终余额: Alice={sum(u.amount for u in alice_utxos)}BTC, "
          f"Bob={sum(u.amount for u in bob_utxos)}BTC")

else:
    print(f"\n[步骤 5] 交易无效！被拒绝。")


# ==========================================
# Step 7: 防御双花攻击
# ==========================================

print("\n[步骤 6] 如果 Alice 试图双花 — 再用同一个 UTXO 转账...")

print(f"  Alice 试图用已被花掉的 UTXO ({inputs_to_spend[0].key()}) 再转一次 70 BTC")
print(f"  检查 UTXO 集合...")

double_spend_key = inputs_to_spend[0].key()
if double_spend_key in utxo_set:
    print(f"  ✅ {double_spend_key} 还在（可以花）")
else:
    print(f"  ❌ {double_spend_key} 已经被删除了！")
    print(f"  → 交易被拒绝。同一个 UTXO 不可能花两次！")


# ==========================================
# 总结
# ==========================================

print("\n" + "=" * 60)
print("Day 3-2 总结")
print("=" * 60)
print("""
UTXO 模型的核心思想：

  1. 没有"账户余额"这个概念，只有一堆"硬币"（UTXO）
  2. 你要转账 = 花掉你的 UTXO + 创建新 UTXO 给对方（+ 找零给自己）
  3. UTXO 花完就没了（从集合中删除），所以你没法双花
  4. 每花一个 UTXO 都要用私钥做签名，证明你有权花它
  5. 交易费 = 输入总额 - 输出总额（隐含的，不是显式字段）

  账户模型（像银行）：看余额，增减数字
  UTXO 模型（像现金）：数硬币，整张花掉再找零

  为什么比特币选 UTXO？
  → 天然防双花：花过的 UTXO 就删了，不可能再花一次
  → 并行验证：每笔交易独立验证，不需要串行处理
  → 隐私性：每次转账都生成新的 UTXO（新地址），追踪困难
""")
