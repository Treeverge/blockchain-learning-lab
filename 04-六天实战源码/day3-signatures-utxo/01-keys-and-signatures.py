"""
======================================================================
Day 3 — 第一部分：数字签名
======================================================================
对照 Bitcoin Core 源码: src/key.h (CKey) + src/pubkey.h (CPubKey)

你要理解的核心问题：
  一笔交易发到网上，别人怎么知道是你发的，而不是别人冒充你？

答案：数字签名。

流程很简单：
  1. 你生成一对密钥：私钥（秘密保管）+ 公钥（公开）
  2. 你要转钱时，用私钥对交易做签名
  3. 全网任何节点都能用你的公钥验证：这个签名确实是用对应私钥做的
  4. 但没人能从公钥反推出私钥


====================================
从 Bitcoin Core 源码看签名机制
====================================

// src/key.h: CKey 类 — 封装了私钥（32字节随机数，存在 secp256k1 椭圆曲线上）
class CKey {
    // 生成新私钥（真随机）
    void MakeNewKey(bool fCompressed);

    // 从私钥推导出公钥（椭圆曲线乘法，单向不可逆）
    CPubKey GetPubKey() const;

    // 用私钥签名一个哈希值，生成签名（~70字节）
    bool Sign(const uint256& hash, vector<unsigned char>& vchSig) const;

    // BIP-340 的 Schnorr 签名（Taproot 用，更现代）
    bool SignSchnorr(const uint256& hash, ...) const;
};

// src/pubkey.h: CPubKey 类 — 封装了公钥（33或65字节）
class CPubKey {
    // 验证签名：给定哈希和签名，返回 true/false
    bool Verify(const uint256& hash, const vector<unsigned char>& vchSig) const;

    // 从压缩签名中恢复公钥（Compact Signature）
    bool RecoverCompact(const uint256& hash, const vector<unsigned char>& vchSig);

    // 公钥 → 地址：Hash160(公钥)
    CKeyID GetID() const;
};


====================================
签名过程（简化版）
====================================

  发起方                        全网节点
  ──────                       ──────
  私钥: 只有你知道
  公钥: 公开的

  交易内容: "Alice 转给 Bob 5 BTC"
  对交易做哈希 → 得到32字节的 hash
  用私钥对 hash 做签名 → 得到签名 sig

  广播：{交易内容, 公钥, 签名}   ───→   收到后用公钥验证：
                                              Verify(公钥, hash, 签名)
                                              返回 true → 签名有效！


核心约束：
  - 私钥 → 公钥：很容易（椭圆曲线乘法）
  - 公钥 → 私钥：数学上不可行（离散对数问题）
  - 没有私钥就做不出有效签名，但有公钥就能验证签名

====================================
运行方式: python 01-keys-and-signatures.py
====================================
"""

import hashlib
from ecdsa import SigningKey, VerifyingKey, SECP256k1

print("=" * 60)
print("Day 3-1: 密钥和数字签名")
print("=" * 60)

# ==========================================
# Step 1: 生成密钥对
# ==========================================
# 对应 Bitcoin Core 中: CKey::MakeNewKey() + CKey::GetPubKey()

print("\n[步骤 1] 生成密钥对")

# 私钥：32 字节随机数（比特币用 secp256k1 曲线）
private_key = SigningKey.generate(curve=SECP256k1)
# 公钥：从私钥推导，在椭圆曲线上做乘法
public_key = private_key.get_verifying_key()

print(f"  私钥 (16进制, 前40字符): {private_key.to_string().hex()[:40]}...")
print(f"  私钥长度: {len(private_key.to_string())} 字节")
print(f"  → 私钥就是你的密码，绝对不能给人看")
print(f"  公钥 (16进制, 前40字符): {public_key.to_string().hex()[:40]}...")
print(f"  → 公钥是公开的，别人用它验证你的签名")


# ==========================================
# Step 2: 签名 — "用私钥证明这个交易是我发的"
# ==========================================
# 对应 Bitcoin Core 中: CKey::Sign(hash, sig)

print("\n[步骤 2] 签名过程")

# 假设这是一笔交易的核心数据
transaction_data = "Alice 转给 Bob 50 BTC, 时间戳: 2026-07-24"
tx_hash = hashlib.sha256(transaction_data.encode()).digest()

print(f"  交易内容: {transaction_data}")
print(f"  交易哈希: {tx_hash.hex()[:40]}...")
print(f"  → 哈希就是交易的'指纹'，长度固定 32 字节")

# 用私钥对哈希做签名
signature = private_key.sign(tx_hash)
print(f"  签名结果: {signature.hex()[:40]}...")
print(f"  签名长度: {len(signature)} 字节")
print(f"  → 签名 = 私钥 + 交易哈希 → 一段不可伪造的数据")


# ==========================================
# Step 3: 验证 — "全网的节点都要验证这个签名"
# ==========================================
# 对应 Bitcoin Core 中: CPubKey::Verify(hash, sig)

print("\n[步骤 3] 验证签名")

try:
    # 用公钥验证：签名是否和交易哈希匹配
    is_valid = public_key.verify(signature, tx_hash)
    print(f"  验证结果: {'✅ 有效 — 交易确实是 Alice 发的' if is_valid else '❌ 无效'}")
except Exception:
    print("  ❌ 签名无效 — 可能被篡改过")


# ==========================================
# Step 4: 篡改攻击演示
# ==========================================

print("\n[步骤 4] 如果攻击者篡改了交易...")

# 攻击者篡改了交易数据
hacked_data = "Alice 转给 Bob 50000 BTC, 时间戳: 2026-07-24"  # 改成 50000
hacked_hash = hashlib.sha256(hacked_data.encode()).digest()

print(f"  原始交易: {transaction_data}")
print(f"  篡改交易: {hacked_data}")
print(f"  原始哈希: {tx_hash.hex()[:40]}...")
print(f"  篡改哈希: {hacked_hash.hex()[:40]}...")
print(f"  → 哪怕只改了一个数字，哈希也会完全不一样（雪崩效应）")

# 攻击者尝试用旧的签名去匹配篡改后的交易
try:
    public_key.verify(signature, hacked_hash)
    print(f"  验证结果: ✅ 有效（这不可能）")
except Exception:
    print(f"  验证结果: ❌ 无效 — 签名对不上！")
    print(f"  → 旧的签名只能用于原始交易数据，篡改后的数据签名必然失败")


# ==========================================
# Step 5: 冒充攻击演示
# ==========================================

print("\n[步骤 5] 如果攻击者想冒充 Alice 发交易...")

# 攻击者生成自己的密钥对
attacker_key = SigningKey.generate(curve=SECP256k1)
attacker_pubkey = attacker_key.get_verifying_key()

new_tx = "Alice 转给 攻击者 50 BTC"
new_hash = hashlib.sha256(new_tx.encode()).digest()

# 攻击者用自己的私钥签名
attacker_sig = attacker_key.sign(new_hash)

print(f"  攻击者用自己的私钥签名了交易: '{new_tx}'")

# 用 Alice 的公钥去验证攻击者的签名
try:
    public_key.verify(attacker_sig, new_hash)
    print(f"  验证结果: ✅ 有效 — Alice 的公钥认可了这个签名（不可能）")
except Exception:
    print(f"  验证结果: ❌ 无效 — Alice 的公钥不认攻击者的签名！")
    print(f"  → 签名和公钥必须是对应的，攻击者的私钥签不出 Alice 公钥能验证的签名")


# ==========================================
# 总结
# ==========================================

print("\n" + "=" * 60)
print("Day 3-1 总结")
print("=" * 60)
print("""
数字签名解决了区块链上"谁有权花钱"的问题：

  私钥 → 藏在你自己手里，用来生成签名
  公钥 → 写在交易输出里，全网都能看到
  签名 → 随交易一起广播，证明你有私钥

  私钥 → 公钥：单向计算（容易）
  私钥 → 签名：用私钥对交易哈希签名
  公钥 + 签名 → 验证：验证签名确实是对应私钥产生的

  攻击者没有你的私钥，就永远做不出"能用你公钥验证"的签名。
  这就保证了：只有持有私钥的人，才能花掉对应 UTXO 里的钱。
""")
