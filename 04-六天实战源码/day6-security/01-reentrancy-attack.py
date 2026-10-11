"""
======================================================================
Day 6 - 智能合约安全：重入攻击
======================================================================

这是智能合约历史上最著名的漏洞。
2016年，一个叫 The DAO 的项目因此被黑走 6000 万美元。
直接导致以太坊硬分叉（ETH 和 ETC 分裂）。

理解这个攻击，你就理解了"为什么合约安全跟传统软件安全完全不同"。

核心问题：合约 A 调用合约 B 时，B 可以反过来再调用 A。
如果 A 在"还没更新完状态"的时候被 B 回调，A 就会被重复利用。
"""

print("=" * 60)
print("Day 6: 重入攻击 (Reentrancy Attack)")
print("=" * 60)


# ============================================================
# 模拟一个"银行"合约 - 有漏洞的版本
# ============================================================

class VulnerableBank:
    """有重入漏洞的银行合约"""

    def __init__(self):
        self.balances = {}  # 用户的存款
        self.logs = []

    def deposit(self, user, amount):
        """存钱"""
        self.balances[user] = self.balances.get(user, 0) + amount
        self.logs.append(f"  [Bank] {user} 存入 {amount}, 余额 {self.balances[user]}")

    def withdraw_bug(self, user):
        """
        有漏洞的提款函数！

        致命问题：先转账，后改余额。
        转账的时候钱已经给出去了，但余额还没减！
        对方可以在"收到钱"的瞬间再次调用 withdraw，再提一次。
        """
        balance = self.balances.get(user, 0)
        if balance == 0:
            return

        # ↓↓↓ 致命顺序：先给钱，后改账 ↓↓↓

        # 第1步: 给钱 (调用对方的"接收"函数)
        self.logs.append(f"  [Bank] 给 {user} 转账 {balance}...")
        user.receive(balance)  # ← 这里会触发对方的代码!

        # 第2步: 改账本 (但这时候可能已经来不及了!)
        self.balances[user] = 0
        self.logs.append(f"  [Bank] {user} 余额清零")


# ============================================================
# 模拟一个"攻击者"合约
# ============================================================

class Attacker:
    """
    攻击者合约 - 利用重入漏洞无限提款

    关键：在 receive() 里再次调用 bank.withdraw_bug()
    形成递归调用: withdraw -> receive -> withdraw -> receive -> ...
    """

    def __init__(self, bank):
        self.bank = bank
        self.stolen = 0
        self.call_count = 0
        self.max_calls = 5  # 限制递归次数，防止无限循环

    def receive(self, amount):
        """
        银行转账时会调用这个函数
        攻击：在收到钱的瞬间，立刻再提一次！
        """
        self.stolen += amount
        self.call_count += 1

        if self.call_count < self.max_calls:
            # ← 关键！余额还没清零，再提一次！
            print(f"  [Attacker] 收到 {amount}! 但银行还没改我的余额，再提一次!")
            self.bank.withdraw_bug(self)  # 递归调用！
        else:
            print(f"  [Attacker] 收到 {amount}! 已偷够，停止递归。")


# ============================================================
# 执行攻击
# ============================================================

print("\n=== 设置场景 ===")
bank = VulnerableBank()

# 三个正常用户存钱
bank.deposit("Alice", 100)
bank.deposit("Bob", 100)
bank.deposit("Charlie", 100)
# 银行总共有 300

# 攻击者存入 100 (作为诱饵) - 注意: 用 attacker 对象做 key, 不是字符串
attacker = Attacker(bank)
bank.deposit(attacker, 100)
# 银行现在有 400, attacker 余额 100

print(f"\n  银行总存款: {sum(bank.balances.values())}")
print(f"  attacker 余额: {bank.balances[attacker]}")

print("\n=== 攻击者发起提款 ===")
print("  attacker 调用 withdraw_bug()")
print()

bank.withdraw_bug(attacker)

print(f"\n=== 攻击结果 ===")
print(f"  攻击者存入: 100")
print(f"  攻击者偷走: {attacker.stolen}")
print(f"  净赚: {attacker.stolen - 100}")
print(f"  银行剩余: {sum(bank.balances.values())}")
print(f"  攻击者调用次数: {attacker.call_count}")

for log in bank.logs:
    print(log)


# ============================================================
# 修复方案：Checks-Effects-Interactions 模式
# ============================================================

print(f"""
{'='*60}
修复方案：Checks-Effects-Interactions
{'='*60}

漏洞的根因是"先给钱后改账"。修复很简单：调换顺序。

  Checks:     先检查条件 (余额够不够)
  Effects:    先改自己的状态 (把余额清零)  ← 先改账!
  Interactions: 最后才跟外部交互 (转账)    ← 后给钱!

修复后的提款函数:

  def withdraw_fixed(self, user):
      balance = self.balances.get(user, 0)
      if balance == 0:
          return

      # 第1步: 先改账本 (Effects)
      self.balances[user] = 0

      # 第2步: 后给钱 (Interactions)
      user.receive(balance)

为什么这样就安全了？
  攻击者在 receive() 里再次调用 withdraw_fixed()
  但这时候 self.balances[user] 已经是 0 了
  -> 第一个检查 if balance == 0 就直接返回
  -> 递归被切断，攻击失败

C++ 程序员的类比：
  这就像你先在账本上划掉"已支付"，然后再转账
  对方再回来要钱的时候，你翻开账本一看：已经付过了，拒绝

另一个修复：用锁 (mutex)
  def withdraw_with_lock(self, user):
      require(not self.locked, "reentrant call")  # 加锁
      self.locked = True
      # ... 正常逻辑 ...
      self.locked = False

  Solidity 里用 modifier 实现这个:
    modifier nonReentrant() {{
        require(!locked, "locked");
        locked = true;
        _;
        locked = false;
    }}

  OpenZeppelin 的 ReentrancyGuard 就是这个原理
""")


# ============================================================
# 验证修复方案
# ============================================================

class FixedBank:
    """修复后的银行 - Checks-Effects-Interactions"""

    def __init__(self):
        self.balances = {}

    def deposit(self, user, amount):
        self.balances[user] = self.balances.get(user, 0) + amount

    def withdraw_fixed(self, user):
        """修复版：先改账，后给钱"""
        balance = self.balances.get(user, 0)
        if balance == 0:
            print(f"  [FixedBank] 余额为 0，拒绝提款")
            return

        # 先改账本 (Effects)
        self.balances[user] = 0

        # 后给钱 (Interactions)
        user.receive(balance)


class AttackerV2:
    """同样的攻击策略，但打不穿修复后的银行"""

    def __init__(self, bank):
        self.bank = bank
        self.stolen = 0
        self.call_count = 0

    def receive(self, amount):
        self.stolen += amount
        self.call_count += 1
        if self.call_count < 5:
            print(f"  [AttackerV2] 收到 {amount}! 试图再提一次...")
            self.bank.withdraw_fixed(self)  # 递归调用
        else:
            print(f"  [AttackerV2] 停止。")


print("\n=== 验证修复方案 ===")
fixed_bank = FixedBank()
fixed_bank.deposit("Alice", 100)
fixed_bank.deposit("Bob", 100)
attacker2 = AttackerV2(fixed_bank)
fixed_bank.deposit(attacker2, 100)

print(f"  attacker 余额: {fixed_bank.balances[attacker2]}")
print(f"  attacker 发起提款...")

fixed_bank.withdraw_fixed(attacker2)

print(f"\n  攻击者偷走: {attacker2.stolen}")
print(f"  攻击者调用次数: {attacker2.call_count}")
print(f"  -> 只成功提款一次! 第二次递归时余额已经是 0, 被拒绝。修复有效!")
