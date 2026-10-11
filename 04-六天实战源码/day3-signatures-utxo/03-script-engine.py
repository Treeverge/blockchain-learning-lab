"""
======================================================================
Day 3 — 第三部分：解锁脚本 & 脚本引擎
======================================================================
对照 Bitcoin Core 源码: src/script/script.h + src/script/interpreter.h

你已经知道：
  私钥 → 签名
  公钥 → 验证签名

现在的问题是：这个"验证"过程在比特币里到底是怎么执行的？

答案：脚本。每个 UTXO 都带着一段程序：
  - scriptPubKey (锁定脚本): "想花这笔钱? 先解开这个谜题"
  - scriptSig    (解锁脚本): "我解开了！这是答案"


====================================
从 Bitcoin Core 源码看脚本系统
====================================

// src/script/script.h — 关键操作码

  OP_DUP           = 0x76  // 复制栈顶元素
  OP_HASH160       = 0xa9  // Hash160 哈希（SHA256 + RIPEMD160）
  OP_EQUALVERIFY   = 0x88  // 比较两个值，不相等就失败
  OP_CHECKSIG      = 0xac  // 验证签名！核心！

// 最经典的支付模式: P2PKH (Pay to Public Key Hash)

// scriptPubKey (锁定在 UTXO 输出里):
//   OP_DUP OP_HASH160 <公钥哈希> OP_EQUALVERIFY OP_CHECKSIG
//
//   逻辑: "先验证你的公钥哈希对不对，再验证你的签名对不对"

// scriptSig (放在交易的 input 里):
//   <签名> <公钥>
//
//   逻辑: "这是我的签名和公钥，验吧"


====================================
脚本是怎么执行的？（栈虚拟机）
====================================

比特币的脚本引擎是一个简单的栈式虚拟机：

  scriptSig 先执行（往栈上放数据）
  然后 scriptPubKey 执行（操作栈上的数据）

  以 P2PKH 为例，节点把 scriptSig 和 scriptPubKey 拼起来执行：

  1. <签名>           → 入栈：[签名]
  2. <公钥>           → 入栈：[签名, 公钥]
  3. OP_DUP           → 复制栈顶：[签名, 公钥, 公钥]
  4. OP_HASH160       → 哈希栈顶：[签名, 公钥, 公钥哈希]
  5. <预期的公钥哈希>  → 入栈：[签名, 公钥, 公钥哈希, 预期哈希]
  6. OP_EQUALVERIFY   → 比较两个哈希：[签名, 公钥]
                         (不相等就直接失败！)
  7. OP_CHECKSIG      → 用公钥验证签名：[]
                         (签名不对也失败！)


运行方式: python 03-script-engine.py
"""

import hashlib
from ecdsa import SigningKey, VerifyingKey, SECP256k1

# 这是一个工具函数：把数据哈希成 20 字节
# 真实比特币用 Hash160 = RIPEMD160(SHA256(data)), 这里用 SHA256 截断模拟
def hash160(data):
    return hashlib.sha256(data).digest()[:20]

print("=" * 60)
print("Day 3-3: 解锁脚本 & 脚本引擎")
print("=" * 60)


# ==========================================
# Step 1: 一个简化的比特币脚本引擎
# ==========================================

class ScriptEngine:
    """自己的比特币脚本引擎（极度简化版）

    对应 Bitcoin Core 中的 EvalScript() 函数
    src/script/interpreter.cpp
    """

    def __init__(self):
        self.stack = []

    def push(self, value):
        """入栈, 对应各种 OP_PUSHDATA 系列"""
        self.stack.append(value)

    def op_dup(self):
        """OP_DUP (0x76): 复制栈顶"""
        if not self.stack:
            raise Exception("OP_DUP: 栈为空")
        self.stack.append(self.stack[-1])

    def op_hash160(self):
        """OP_HASH160 (0xa9): SHA256 截断到20字节（模拟比特币的 SHA256+RIPEMD160）"""
        if not self.stack:
            raise Exception("OP_HASH160: 栈为空")
        data = self.stack.pop()
        h = hash160(data)
        self.stack.append(h)

    def op_equalverify(self):
        """OP_EQUALVERIFY (0x88): 比较两个值，不等就失败"""
        if len(self.stack) < 2:
            raise Exception("OP_EQUALVERIFY: 栈元素不足")
        a = self.stack.pop()
        b = self.stack.pop()
        if a != b:
            raise Exception("OP_EQUALVERIFY: 公钥哈希不匹配！")

    def op_checksig(self, tx_hash):
        """OP_CHECKSIG (0xac): 验证签名

        对应 Bitcoin Core: GenericTransactionSignatureChecker::CheckECDSASignature()
        栈顶两个元素: 公钥 + 签名
        弹出它们，然后验证签名
        """
        if len(self.stack) < 2:
            raise Exception("OP_CHECKSIG: 栈元素不足")

        pubkey_bytes = self.stack.pop()
        sig_bytes = self.stack.pop()

        try:
            vk = VerifyingKey.from_string(pubkey_bytes, curve=SECP256k1)
            vk.verify(sig_bytes, tx_hash)
        except Exception as e:
            raise Exception(f"OP_CHECKSIG: 签名验证失败 — {e}")


# ==========================================
# Step 2: 准备交易和密钥
# ==========================================

print("\n[步骤 1] 准备")

# Alice 的密钥
alice_sk = SigningKey.generate(curve=SECP256k1)
alice_pk = alice_sk.get_verifying_key()
alice_pk_bytes = alice_pk.to_string()
# 公钥哈希 = Hash160(公钥) — 这就是比特币地址的核心
alice_pk_hash = hash160(alice_pk_bytes)

print(f"  Alice 公钥:        {alice_pk_bytes.hex()[:30]}... ({len(alice_pk_bytes)}字节)")
print(f"  Alice 公钥哈希:    {alice_pk_hash.hex()} (20字节)")
print(f"  → 公钥哈希就是比特币地址的核心部分（Base58编码后就是地址）")

# 交易数据
tx_data = "Alice 支付 50 BTC 给 Bob"
tx_hash = hashlib.sha256(tx_data.encode()).digest()
print(f"  交易哈希:          {tx_hash.hex()[:30]}...")


# ==========================================
# Step 3: 构造 scriptPubKey 和 scriptSig
# ==========================================

print("\n[步骤 2] 构造锁定脚本和解锁脚本")

# scriptPubKey — 锁在 UTXO 输出里的"谜题"
# 真实比特币中：OP_DUP OP_HASH160 <公钥哈希> OP_EQUALVERIFY OP_CHECKSIG
scriptPubKey_code = [
    ("DUP", None),           # OP_DUP
    ("HASH160", None),       # OP_HASH160
    ("PUSH", alice_pk_hash), # <Alice的公钥哈希>
    ("EQUALVERIFY", None),   # OP_EQUALVERIFY
    ("CHECKSIG", tx_hash),   # OP_CHECKSIG
]

print(f"  scriptPubKey (锁定脚本):")
print(f"    OP_DUP")
print(f"    OP_HASH160")
print(f"    <{alice_pk_hash.hex()}>")
print(f"    OP_EQUALVERIFY")
print(f"    OP_CHECKSIG")
print(f"  → 含义: 谁想花这笔钱，必须提供 {alice_pk_hash.hex()} 对应的公钥和有效签名")

# scriptSig — 解锁脚本
# 真实比特币中: <签名> <公钥>
alice_sig = alice_sk.sign(tx_hash)
scriptSig_code = [
    ("PUSH", alice_sig),      # <签名>
    ("PUSH", alice_pk_bytes), # <公钥>
]

print(f"\n  scriptSig (解锁脚本):")
print(f"    <签名: {alice_sig.hex()[:30]}...>")
print(f"    <公钥: {alice_pk_bytes.hex()[:30]}...>")
print(f"  → 含义: 这是我的签名和公钥，你验证吧")


# ==========================================
# Step 4: 执行脚本 — 验证交易
# ==========================================

print(f"\n[步骤 3] 节点执行脚本验证")
print(f"  (先执行 scriptSig，再执行 scriptPubKey)")
print()

engine = ScriptEngine()

# --- 执行 scriptSig ---
print(f"  === 执行 scriptSig ===")
for op, data in scriptSig_code:
    if op == "PUSH":
        engine.push(data)
        preview = data.hex()[:20] if isinstance(data, bytes) else str(data)[:20]
        if len(data) > 70:
            print(f"    PUSH <签名: {preview}...>    栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个)")
        else:
            print(f"    PUSH <公钥: {preview}...>    栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个)")

# --- 执行 scriptPubKey ---
print(f"\n  === 执行 scriptPubKey ===")
for op, data in scriptPubKey_code:
    try:
        if op == "DUP":
            engine.op_dup()
            print(f"    OP_DUP          栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个)")
        elif op == "HASH160":
            engine.op_hash160()
            print(f"    OP_HASH160      栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个)")
        elif op == "PUSH":
            engine.push(data)
            if len(data) == 20:
                print(f"    <公钥哈希>       栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个)")
            else:
                print(f"    <数据>          栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个)")
        elif op == "EQUALVERIFY":
            engine.op_equalverify()
            print(f"    OP_EQUALVERIFY  栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个) ✅ 匹配")
        elif op == "CHECKSIG":
            engine.op_checksig(data)
            print(f"    OP_CHECKSIG     栈: [{'|'*len(engine.stack)}] ({len(engine.stack)}个) ✅ 签名有效")
    except Exception as e:
        print(f"    ❌ 脚本执行失败: {e}")
        break
else:
    print(f"\n  ✅ 脚本执行成功！这笔钱可以花。")


# ==========================================
# Step 5: 演示攻击 — 错误的公钥
# ==========================================

print(f"\n[步骤 4] 如果攻击者用错误的公钥...")

attacker_sk = SigningKey.generate(curve=SECP256k1)
attacker_pk = attacker_sk.get_verifying_key()

# 攻击者想冒充 Alice，但他只能用自己公钥导出的哈希去碰运气
attacker_pk_hash = hash160(attacker_pk.to_string())

# 攻击者的 scriptSig
fake_scriptSig = [
    ("PUSH", alice_sig),           # 拿不到 Alice 的签名，只能用旧的
    ("PUSH", attacker_pk.to_string()), # 用自己的公钥
]

attacker_engine = ScriptEngine()

print(f"  攻击者的公钥哈希: {attacker_pk_hash.hex()}")
print(f"  锁定的公钥哈希:   {alice_pk_hash.hex()}")
print(f"  → 这两个哈希完全不同！")

for op, data in fake_scriptSig:
    if op == "PUSH":
        attacker_engine.push(data)

for op, data in scriptPubKey_code:
    try:
        if op == "DUP":
            attacker_engine.op_dup()
        elif op == "HASH160":
            attacker_engine.op_hash160()
        elif op == "PUSH":
            attacker_engine.push(data)
        elif op == "EQUALVERIFY":
            attacker_engine.op_equalverify()
            print(f"  OP_EQUALVERIFY: ✅ 通过（不可能）")
        elif op == "CHECKSIG":
            attacker_engine.op_checksig(data)
    except Exception as e:
        print(f"  ❌ 在 {op} 步骤失败: {e}")
        break


# ==========================================
# 总结
# ==========================================

print("\n" + "=" * 60)
print("Day 3-3 总结")
print("=" * 60)
print("""
比特币的脚本系统本质上是一个"解锁谜题"机制：

  锁 (scriptPubKey) — 在 UTXO 里:
    "要花这笔钱？先证明你拥有 Hash160(公钥)=XXXX 的私钥"

  钥匙 (scriptSig) — 在交易 input 里:
    "这里是我的公钥，这里是我用私钥做的签名，验吧"

  验证过程:
    1. 弹出公钥，算它的哈希 → 和 scriptPubKey 里存的哈希比较
       → 不匹配 = 公钥不对，拒绝
    2. 用公钥验证签名 →
       → 签名不对 = 没有对应私钥，拒绝
    3. 两个都通过 = 交易合法！

  为什么不用 "账户+密码" 而是用这种复杂机制？
  → 因为区块链上的一切都是公开的
  → 你不能像网站那样 "输入密码验证后登录"
  → 必须用非交互式的验证：任何人拿到 公钥+签名+交易 就能独立验证
  → 不需要知道私钥，也不需要联系任何服务器

  这就是比特币 "不需要信任任何人" 的技术基础。
""")
