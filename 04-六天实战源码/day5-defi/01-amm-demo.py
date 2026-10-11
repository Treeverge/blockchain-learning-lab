"""恒定乘积交换：整数报价、手续费留池、独立比较和失败保护。
交易函数接收 6 位精度的最小单位整数。只模拟教学资产。
"""
from decimal import Decimal

SCALE = 10 ** 6


def quote_output(x, y, amount, fee_bps=30):
    if any(type(v) is not int or v <= 0 for v in (x, y, amount)):
        raise ValueError('储备与金额必须是正整数最小单位')
    if type(fee_bps) is not int or not 0 <= fee_bps < 10000:
        raise ValueError('手续费参数无效')
    effective = amount * (10000 - fee_bps)
    output = effective * y // (x * 10000 + effective)
    if output == 0:
        raise ValueError('输出舍入为零')
    return output


def display(amount):
    return format(Decimal(amount) / SCALE, '.6f')


class SimpleAMM:
    def __init__(self, token_a_amount, token_b_amount, fee_bps=30):
        if any(type(v) is not int or v <= 0 for v in (token_a_amount, token_b_amount)):
            raise ValueError('初始化储备使用正整数个代币')
        if type(fee_bps) is not int or not 0 <= fee_bps < 10000:
            raise ValueError('手续费参数无效')
        self.reserve_a = token_a_amount * SCALE
        self.reserve_b = token_b_amount * SCALE
        self.fee_bps = fee_bps

    @property
    def k(self):
        return self.reserve_a * self.reserve_b

    def price(self):
        return Decimal(self.reserve_b) / self.reserve_a

    def swap_a_to_b(self, amount, min_out=0):
        output = quote_output(self.reserve_a, self.reserve_b, amount, self.fee_bps)
        if type(min_out) is not int or min_out < 0 or output < min_out:
            raise ValueError('输出低于最小接收量或最小接收量无效；储备未改变')
        self.reserve_a += amount
        self.reserve_b -= output
        return output

    def swap_b_to_a(self, amount, min_out=0):
        output = quote_output(self.reserve_b, self.reserve_a, amount, self.fee_bps)
        if type(min_out) is not int or min_out < 0 or output < min_out:
            raise ValueError('输出低于最小接收量或最小接收量无效；储备未改变')
        self.reserve_b += amount
        self.reserve_a -= output
        return output


def main():
    print('DeFi 交换实验 | A、B 均采用 6 位小数')
    print('\n先预测：池子 A=1000、B=1000，输入 100 A，会得到 100 B 吗？')
    print('\n实验一：同一起点比较交易规模（每次创建新池子）')
    for amount in (10, 100, 500):
        pool = SimpleAMM(1000, 1000)
        old_k = pool.k
        output = pool.swap_a_to_b(amount * SCALE)
        average = Decimal(output) / (amount * SCALE)
        print(f'输入 {amount:>3} A → {display(output)} B；成交均价 {average:.6f} B/A')
        print(f'  储备 {display(pool.reserve_a)} A / {display(pool.reserve_b)} B；k 增加 {pool.k - old_k} 最小单位²')
    print('\n实验二：同样输入 100 A，不同池子深度')
    for depth in (100, 1000, 10000):
        pool = SimpleAMM(depth, depth)
        print(f'储备 {depth}/{depth} → {display(pool.swap_a_to_b(100 * SCALE))} B')
    print('\n实验三：手续费在哪里？')
    pool = SimpleAMM(1000, 1000)
    wallet_a, wallet_b = 1000 * SCALE, 1000 * SCALE
    before_a, before_b = wallet_a + pool.reserve_a, wallet_b + pool.reserve_b
    amount = 100 * SCALE
    output = pool.swap_a_to_b(amount)
    wallet_a -= amount
    wallet_b += output
    assert wallet_a + pool.reserve_a == before_a
    assert wallet_b + pool.reserve_b == before_b
    print(f'100 A 全部进入池子，其中 0.3 A 是留池手续费；用户收到 {display(output)} B。')
    print('逐资产对账通过。手续费包含在池子余额内，不再额外加一次。')
    print('\n实验四：报价后，其他交易先成交')
    pool = SimpleAMM(1000, 1000)
    quoted = quote_output(pool.reserve_a, pool.reserve_b, 100 * SCALE)
    minimum = quoted * 9950 // 10000
    pool.swap_a_to_b(200 * SCALE)
    snapshot = (pool.reserve_a, pool.reserve_b)
    try:
        pool.swap_a_to_b(100 * SCALE, minimum)
    except ValueError as error:
        assert snapshot == (pool.reserve_a, pool.reserve_b)
        print(error)
    print('\n自身交易沿曲线移动价格，是价格影响；报价到执行之间的变化另行比较。')
    print('有手续费时实际储备乘积增长；无手续费时也可能因整数舍入略增。')
    print('省略 Gas、外部价格、LP 份额与协议抽成。')


if __name__ == '__main__':
    main()
