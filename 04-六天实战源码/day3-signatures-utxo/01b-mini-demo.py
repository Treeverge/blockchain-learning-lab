"""
用一个极小规模的例子，演示"私钥 → 公钥"为什么是单向的

真实比特币用的是 secp256k1 椭圆曲线，私钥是 256 位的随机数（1 后面跟 77 个零的量级）
这里用一个 2 位数的迷你群来演示完全相同的数学原理
"""

print("=" * 50)
print("迷你版：私钥 → 公钥 的单向过程")
print("=" * 50)

# ============================================================
# 先把真实情况翻译成"人能算"的迷你版
# ============================================================

print("""
┌─────────────────────────────────────────────────────────┐
│  真实比特币          │  迷你版（这里演示的）               │
├─────────────────────────────────────────────────────────┤
│  椭圆曲线: secp256k1  │  简单模运算群                     │
│  私钥: 1 ~ 2²⁵⁶ 的随机数│  私钥: 1 ~ 22 的小整数              │
│  公钥: 椭圆曲线上的点  │  公钥: mod 运算的结果              │
│  运算: 椭圆曲线标量乘  │  运算: 模指数 g^私钥 mod p          │
│  安全性: 离散对数问题  │  安全性: 离散对数问题(同一类问题!)  │
└─────────────────────────────────────────────────────────┘
""")

# ============================================================
# 迷你加密系统
# ============================================================

# 选一个小质数 p=23 作为"世界大小"
# 选 g=5 作为"生成元"（所有运算的起点）
p = 23
g = 5

print(f"【设定】质数 p = {p}, 生成元 g = {g}")
print(f"规则: 公钥 = g^私钥 mod p  (即 {g} 的 私钥 次方，除以 {p} 取余数)")
print()

# ============================================================
# 正向：私钥 → 公钥（容易！）
# ============================================================

print("=" * 50)
print("正方向: 私钥 → 公钥（小学生都会算）")
print("=" * 50)

private_key = 3  # 假设私钥 = 3

# 计算公钥
public_key = (g ** private_key) % p  # 5^3 mod 23 = 125 mod 23 = 10

print(f"""
计算过程:
  私钥 = {private_key}
  公钥 = {g}^{private_key} mod {p}
       = {g**private_key} mod {p}
       = {g**private_key} 除以 {p}
       = {g**private_key // p} × {p} + {g**private_key % p}
       = 商 {g**private_key // p}, 余数 {public_key}

  所以: 私钥 {private_key} → 公钥 {public_key}   (算出来只需要一瞬间)
""")

# ============================================================
# 反向：公钥 → 私钥（难！）
# ============================================================

print("=" * 50)
print("反方向: 公钥 → 私钥（唯一的办法就是暴力试）")
print("=" * 50)

print(f"""
假设攻击者拿到了公钥 = {public_key}
他知道 p={p}, g={g}
但不知道私钥是多少

他只能逐个尝试：
""")

for guess in range(1, 24):
    result = (g ** guess) % p
    marker = " ← 找到！私钥 = " + str(guess) if result == public_key else ""
    if guess <= 5 or marker:
        print(f"  猜测私钥={guess:2d}: {g}^{guess:2d} mod {p:2d} = {g**guess:7d} mod {p:2d} = {result:2d}{marker}")

print(f"""
  攻击者试了 {private_key} 次才找到（而且是凑巧从 1 开始试的）
  如果私钥是 17，就要试 17 次
""")

# ============================================================
# 展示完整的所有可能公钥
# ============================================================

print("=" * 50)
print("完整映射表（私钥 → 公钥）")
print("=" * 50)
print(f"  私钥  |  g^私钥 mod {p}  |  公钥")
print(f"  " + "-" * 30)

for d in range(0, 23):
    pk = (g ** d) % p
    print(f"  {d:4d}  |  {g}^{d} mod {p:2d} = {g**d:7d} mod {p:2d} = {pk:2d}")

print(f"""
注意! 对于 0~22 的每一个私钥,都有一个对应的公钥
但给定一个公钥(比如 {public_key}),你需要遍历整张表才能找到对应私钥
而且这张表不是按次序排列的:

  私钥 3 → 公钥 {public_key}
  私钥 7 → 公钥 {(g**7) % p}
  私钥 15 → 公钥 {(g**15) % p}

  你没法"除以"什么来反推，只能猜。
""")

# ============================================================
# 现在把规模放大
# ============================================================

print("=" * 50)
print("把规模放大到比特币的量级...")
print("=" * 50)

print(f"""
  刚才的迷你版: 私钥范围 1~22，攻击者最多试 22 次
  比特币真实版: 私钥范围 1~2²⁵⁶（约等于 115792089237316195423570985008687907853269984665640564039457584007913129639936）

  形象地理解:
  - 如果你每秒尝试 10 亿个私钥 (10⁹次/秒)
  - 从宇宙大爆炸到现在 (138 亿年) 一直在试
  - 你才试了大约 10²⁶ 个
  - 而总数是 10⁷⁷ 的量级
  - 你连总数的 0.000000000000000000000000000000000000000000000000001% 都没试完

  结论: 从公钥反推私钥，在数学上等价于"暴力猜宇宙中每一粒沙子"
""")

# ============================================================
# 签名演示（也是迷你版）
# ============================================================

print("=" * 50)
print("签名演示（迷你版）")
print("=" * 50)

# 这次换一个私钥
actual_private_key = 7
actual_public_key = (g ** actual_private_key) % p

print(f"""
  Alice 的私钥 = {actual_private_key}
  Alice 的公钥 = {actual_public_key}
""")

# ============================================================
# 签名演示（Schnorr 签名迷你版）
# ============================================================
# 真实 Schnorr 用的是椭圆曲线加法群，这里用模乘法群
# 群的大小（阶）q = p-1 = 22，即 g^22 ≡ 1 mod 23
#
# Schnorr 签名公式:
#   生成: k随机, R=g^k, e=H(R||数据), s=(k + 私钥×e) mod q
#   验证: g^s ≡ R × 公钥^e mod p
#
# 为什么一定对? 因为:
#   g^s = g^(k + d×e) = g^k × g^(d×e) = R × (g^d)^e = R × 公钥^e

q = p - 1  # 群的阶 = 22

actual_private_key = 7
actual_public_key = (g ** actual_private_key) % p

print(f"""
  Alice 的私钥 d = {actual_private_key}
  Alice 的公钥 y = g^d mod {p} = {g}^{actual_private_key} mod {p} = {actual_public_key}
""")

transaction_data = 8  # 假设交易内容的"影子" = 8
k = 20  # 临时的随机数（固定值方便你验证）
R = (g ** k) % p            # 承诺值
e = (R + transaction_data) % q  # 挑战值（对阶q取模）
s = (k + actual_private_key * e) % q  # 回应值（必须对阶q取模！）

print(f"""
  Schnorr 签名过程:
    交易数据 = {transaction_data}
    随机数 k = {k}（只用一次的临时秘密）
    承诺 R   = g^k mod {p} = {g}^{k} mod {p} = {R}
    挑战 e   = (R + 数据) mod {q} = ({R} + {transaction_data}) mod {q} = {e}
    回应 s   = (k + d×e) mod {q} = ({k} + {actual_private_key}×{e}) mod {q} = {s}
               ↑ 这里用到私钥 d={actual_private_key}

    签名 = (R={R}, s={s})
""")

# 验证
left = (g ** s) % p
right = (R * ((actual_public_key ** e) % p)) % p

print(f"""
  Schnorr 验证过程:
    左边 = g^s mod {p} = {g}^{s} mod {p} = {left}
    右边 = R × 公钥^e mod {p} = {R} × {actual_public_key}^{e} mod {p} = {right}

  {left} == {right}?  {'✅✅✅  验证通过！签名确实是用私钥 {actual_private_key} 算出来的' if left == right else '❌ 不匹配'}
""")

# 攻击者不知道 Alice 的私钥(7)，用自己的私钥(11)签名
attacker_d = 11
attacker_pub = (g ** attacker_d) % p
attacker_s = (k + attacker_d * e) % q  # 用了自己的 d=11，不是 Alice 的 7

left_fake = (g ** attacker_s) % p
# 注意: 右边用的是 Alice 的公钥(17)，不是攻击者的公钥(22)
right_alice = (R * ((actual_public_key ** e) % p)) % p

print(f"""
  攻击者的私钥 d' = {attacker_d}
  攻击者的公钥 = g^{attacker_d} mod {p} = {attacker_pub}

  攻击者用自己私钥({attacker_d})算出 s = (k + d'×e) mod {q} = {attacker_s}
  然后声称这个签名对应的是 Alice 的公钥 ({actual_public_key})

  验证（用 Alice 的公钥）:
    左边 = g^s mod {p} = {g}^{attacker_s} mod {p} = {left_fake}
    右边 = R × Alice公钥^e mod {p} = {right_alice}

  {left_fake} == {right_alice}?  {'✅' if left_fake == right_alice else '❌ 不等 → 攻击失败！'}

  为什么一定失败?
    Schnorr 验证等式: g^s = R × y^e
    代入 s = k + d'×e:
      左边 = g^(k + d'×e)
      右边 = R × y^e = g^k × (g^d)^e = g^(k + d×e)
    只有当 d' = d 时两边才相等！
    → 攻击者的 d'({attacker_d}) ≠ Alice 的 d({actual_private_key})
    → g^(k + {attacker_d}×{e}) ≠ g^(k + {actual_private_key}×{e})
    → 签不出来的
""")

print("=" * 50)
print("总结：")
print(f"  私钥 = 一个数字（只有你知道）")
print(f"  公钥 = g^私钥 mod p = 另一个数字（发到全世界）")
print(f"  签名 = 私钥参与的计算结果（只有你能算出来）")
print(f"  验证 = 用公钥检查签名对不对（所有人都能验）")
print(f"  核心: 知道公钥，没办法算出私钥（就像看得到锁，造不出钥匙）")
print("=" * 50)
