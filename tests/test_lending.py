import importlib.util
from pathlib import Path
from decimal import Decimal as D
import unittest

spec = importlib.util.spec_from_file_location('lending_demo', Path(__file__).resolve().parents[1] / '04-六天实战源码/day5-defi/03-lending-demo.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LendingTests(unittest.TestCase):
    def pool(self):
        p = module.LendingPool(price='100')
        p.register('Dave', cash='10000')
        p.register('Alice', collateral='4')
        p.register('Liquidator', cash='1000')
        p.deposit('Dave', '10000')
        return p

    def test_repeated_borrow_preserves_previous_debt(self):
        p = self.pool()
        p.borrow('Alice', '2', '100')
        p.borrow('Alice', '1', '80')
        self.assertEqual(p.loans['Alice']['debt'], D('180'))
        self.assertEqual(p.loans['Alice']['collateral'], D('3'))
        self.assertEqual(p.pool_cash, D('9820'))

    def test_insolvent_liquidation_cannot_create_assets(self):
        p = self.pool()
        p.borrow('Alice', '3', '180')
        p.set_price('60')
        cash_before = p.pool_cash + sum(u['cash'] for u in p.wallets.values())
        coll_before = sum(u['collateral'] for u in p.wallets.values()) + p.loans['Alice']['collateral']
        result = p.liquidate('Alice', 'Liquidator')
        self.assertGreater(result['bad_debt'], 0)
        self.assertLessEqual(result['seized'], D('3'))
        self.assertEqual(p.pool_cash + sum(u['cash'] for u in p.wallets.values()), cash_before)
        self.assertEqual(sum(u['collateral'] for u in p.wallets.values()), coll_before)
        self.assertNotIn('Alice', p.loans)

    def test_invalid_repayment_and_healthy_liquidation_change_nothing(self):
        p = self.pool()
        p.borrow('Alice', '3', '180')
        before = repr((p.wallets, p.loans, p.pool_cash))
        for amount in ['-1', '181']:
            with self.assertRaises(ValueError):
                p.repay('Alice', amount)
        with self.assertRaises(ValueError):
            p.liquidate('Alice', 'Liquidator')
        self.assertEqual(repr((p.wallets, p.loans, p.pool_cash)), before)

    def test_full_repayment_returns_collateral(self):
        p = self.pool()
        p.borrow('Alice', '3', '180')
        p.repay('Alice', '180')
        self.assertEqual(p.wallets['Alice']['collateral'], D('4'))
        self.assertEqual(p.pool_cash, D('10000'))
        self.assertNotIn('Alice', p.loans)

    def test_solvent_liquidation_returns_remaining_collateral(self):
        p = self.pool()
        p.borrow('Alice', '3', '180')
        p.set_price('70')
        result = p.liquidate('Alice', 'Liquidator')
        self.assertEqual(result['repaid'], D('180'))
        self.assertEqual(result['seized'], D('2.7'))
        self.assertEqual(result['returned'], D('0.3'))
        self.assertEqual(result['bad_debt'], D('0'))
        self.assertEqual(p.wallets['Alice']['collateral'], D('1.3'))

if __name__ == '__main__':
    unittest.main()
