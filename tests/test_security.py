import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / '04-六天实战源码/day6-security/01-reentrancy-attack.py'
spec = importlib.util.spec_from_file_location('security_demo', path)
security = importlib.util.module_from_spec(spec)
spec.loader.exec_module(security)

class SecurityTests(unittest.TestCase):
    def test_real_cash_not_claim_sum(self):
        initial = security.create_state()
        result = security.run(initial)
        self.assertEqual(result['state']['cash'], 0)
        self.assertEqual(result['state']['wallets']['Attacker'], 6)
        self.assertEqual(security.totals(result['state']), {'claims':5, 'assets':6, 'gap':5})
        self.assertEqual(initial, security.create_state())

    def test_defenses_and_failure_scope(self):
        for mode in ('cei', 'lock'):
            result = security.run(security.create_state(), mode=mode)
            self.assertTrue(result['success'])
            self.assertEqual(result['state']['cash'],5)
            self.assertEqual(result['state']['wallets']['Attacker'],1)
            self.assertFalse(result['state']['locked'])
            for options in ({'catch_failure':False}, {'receiver_reject':True}):
                result = security.run(security.create_state(), mode=mode, **options)
                self.assertFalse(result['success'])
                self.assertEqual(result['state'],security.create_state())
                self.assertEqual(result['logs'],[])

    def test_bounded_attack_and_honest_depositor(self):
        for count in range(1,9):
            for caught in (False,True):
                result = security.run(security.create_state(),max_payouts=count,catch_failure=caught)
                self.assertEqual(result['success'],count<=6 or caught)
                self.assertEqual(security.totals(result['state'])['assets'],6)
        drained=security.run(security.create_state())['state']
        failure=security.run(drained,caller='Alice')
        self.assertFalse(failure['success'])
        self.assertEqual(failure['state'],drained)

    def test_invalid_parameters(self):
        for options in ({'mode':'unknown'},{'caller':'Mallory'},{'max_payouts':True},{'max_payouts':9},{'catch_failure':'yes'}):
            with self.assertRaises(ValueError):
                security.run(security.create_state(),**options)

if __name__ == '__main__':
    unittest.main()
