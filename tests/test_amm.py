import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('amm_demo', ROOT / '04-六天实战源码/day5-defi/01-amm-demo.py')
amm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(amm)

class AMMTests(unittest.TestCase):
    def test_exact_quotes(self):
        for v in json.loads((ROOT / 'tests/amm-vectors.json').read_text(encoding='utf-8')):
            with self.subTest(v=v):
                self.assertEqual(amm.quote_output(int(v['x']), int(v['y']), int(v['input']), v['feeBps']), int(v['output']))

    def test_fee_stays_in_pool(self):
        pool = amm.SimpleAMM(1000, 1000)
        before_b = pool.reserve_b
        output = pool.swap_a_to_b(100 * amm.SCALE)
        self.assertEqual(pool.reserve_a, 1100 * amm.SCALE)
        self.assertEqual(pool.reserve_b + output, before_b)
        self.assertGreater(pool.k, 1000 * 1000 * amm.SCALE ** 2)

    def test_rejection_keeps_reserves(self):
        pool = amm.SimpleAMM(1000, 1000)
        snapshot = (pool.reserve_a, pool.reserve_b)
        with self.assertRaises(ValueError):
            pool.swap_a_to_b(100 * amm.SCALE, min_out=100 * amm.SCALE)
        self.assertEqual((pool.reserve_a, pool.reserve_b), snapshot)

    def test_invalid_values(self):
        for amount in [0, -1]:
            with self.assertRaises(ValueError):
                amm.quote_output(1000, 1000, amount)

if __name__ == '__main__':
    unittest.main()
