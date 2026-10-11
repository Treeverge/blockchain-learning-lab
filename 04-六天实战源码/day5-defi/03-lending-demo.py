"""借贷教学账本：数量和价格分开，重复借款累加，清算显式记录坏账。
不连接网络。固定参数，仅模拟一种抵押资产与一种现金资产；不计利息。
"""
from decimal import Decimal, ROUND_DOWN

UNIT = Decimal('0.000001')


def positive(value):
    try:
        result = Decimal(str(value))
    except Exception as error:
        raise ValueError('请输入正数') from error
    if not result.is_finite() or result <= 0 or result > Decimal('1e12'):
        raise ValueError('金额或价格必须为有限正数，且不超过 1 万亿')
    if result != result.quantize(UNIT):
        raise ValueError('最多保留 6 位小数')
    return result


class LendingPool:
    def __init__(self, price='100'):
        self.price = positive(price)
        self.wallets = {}
        self.deposits = {}
        self.loans = {}
        self.pool_cash = Decimal(0)
        self.bad_debt = Decimal(0)
        self.borrow_ltv = Decimal(2) / 3
        self.liquidation_threshold = Decimal('0.8')
        self.bonus = Decimal('0.05')

    def register(self, who, cash='0', collateral='0'):
        if who in self.wallets:
            raise ValueError('账户已存在')
        self.wallets[who] = {
            'cash': Decimal(0) if str(cash) == '0' else positive(cash),
            'collateral': Decimal(0) if str(collateral) == '0' else positive(collateral),
        }

    def deposit(self, who, amount):
        amount = positive(amount)
        wallet = self.wallets[who]
        if amount > wallet['cash']:
            raise ValueError('存款人余额不足')
        wallet['cash'] -= amount
        self.pool_cash += amount
        self.deposits[who] = self.deposits.get(who, Decimal(0)) + amount

    def borrow(self, who, collateral, borrow_amount):
        collateral, amount = positive(collateral), positive(borrow_amount)
        wallet = self.wallets[who]
        old = self.loans.get(who, {'collateral': Decimal(0), 'debt': Decimal(0)})
        total_collateral, total_debt = old['collateral'] + collateral, old['debt'] + amount
        if collateral > wallet['collateral']:
            raise ValueError('抵押资产数量不足')
        if total_debt > total_collateral * self.price * self.borrow_ltv:
            raise ValueError('累计债务超过借款上限')
        if amount > self.pool_cash:
            raise ValueError('池子可用现金不足')
        wallet['collateral'] -= collateral
        wallet['cash'] += amount
        self.pool_cash -= amount
        self.loans[who] = {'collateral': total_collateral, 'debt': total_debt}

    def set_price(self, price):
        self.price = positive(price)

    def health_factor(self, who):
        loan = self.loans[who]
        return loan['collateral'] * self.price * self.liquidation_threshold / loan['debt']

    def repay(self, who, amount):
        amount = positive(amount)
        loan = self.loans[who]
        wallet = self.wallets[who]
        if amount > loan['debt'] or amount > wallet['cash']:
            raise ValueError('还款超过债务或钱包余额')
        wallet['cash'] -= amount
        self.pool_cash += amount
        loan['debt'] -= amount
        if loan['debt'] == 0:
            wallet['collateral'] += loan['collateral']
            del self.loans[who]

    def liquidate(self, who, liquidator):
        if who == liquidator:
            raise ValueError('本教学模型使用独立清算账户')
        if self.health_factor(who) >= 1:
            raise ValueError('头寸健康，不能清算')
        loan = self.loans[who]
        wallet = self.wallets[liquidator]
        collateral_value = loan['collateral'] * self.price
        max_repay = (collateral_value / (1 + self.bonus)).quantize(UNIT, rounding=ROUND_DOWN)
        repay = min(loan['debt'], max_repay)
        if repay <= 0 or wallet['cash'] < repay:
            raise ValueError('清算账户余额不足或抵押价值过低')
        insolvent = max_repay < loan['debt']
        seized = loan['collateral'] if insolvent else min(loan['collateral'], (repay * (1 + self.bonus) / self.price).quantize(UNIT, rounding=ROUND_DOWN))
        bad_debt = loan['debt'] - repay
        remaining = loan['collateral'] - seized
        wallet['cash'] -= repay
        wallet['collateral'] += seized
        self.pool_cash += repay
        self.wallets[who]['collateral'] += remaining
        self.bad_debt += bad_debt
        del self.loans[who]
        return {'repaid': repay, 'seized': seized, 'returned': remaining, 'bad_debt': bad_debt}


def main():
    pool = LendingPool(price='100')
    pool.register('Dave', cash='10000')
    pool.register('Alice', collateral='4')
    pool.register('Liquidator', cash='1000')
    pool.deposit('Dave', '10000')
    pool.borrow('Alice', '2', '100')
    pool.borrow('Alice', '1', '80')
    print('抵押数量 3 个，单价 100，价值 300；累计债务 180。')
    print(f'初始健康因子：{pool.health_factor("Alice"):.6f}；小于 1 时可清算。')
    cash_before = pool.pool_cash + sum(w['cash'] for w in pool.wallets.values())
    collateral_before = sum(w['collateral'] for w in pool.wallets.values()) + pool.loans['Alice']['collateral']
    pool.set_price('60')
    print(f'单价降到 60，抵押价值 180；健康因子：{pool.health_factor("Alice"):.6f}')
    result = pool.liquidate('Alice', 'Liquidator')
    print(f'清算者实际偿还 {result["repaid"]}，拿走 {result["seized"]} 个抵押资产。')
    print(f'退回借款人 {result["returned"]} 个；协议坏账 {result["bad_debt"]}，不会凭空补齐。')
    assert cash_before == pool.pool_cash + sum(w['cash'] for w in pool.wallets.values())
    assert collateral_before == sum(w['collateral'] for w in pool.wallets.values())
    print('现金与抵押数量分别对账通过。价格下降改变价值，不改变资产数量。')
    print('模型省略利息、部分清算、费用、真实预言机和存款退出；坏账会影响存款人的可回收资产。')
    print('闪电贷依赖交易原子性，但不代表零风险；本例未实现闪电贷。')


if __name__ == '__main__':
    main()
