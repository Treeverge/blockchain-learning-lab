# Day 5 LP Source Implementation Plan

> **For agentic workers:** Execute inline in this task. The user has authorized independent continuation; do not dispatch subagents.

**Goal:** Add a runnable zero-fee LP versus holding source exercise with an auditable two-asset ledger.

**Architecture:** A standalone Python module uses integer atomic units and four named balance locations: pool, LP, arbitrageur, and external market. Each transition validates before changing balances. Tests compare the fixed scenario with the existing JavaScript lesson and check conservation separately for A and B.

**Tech Stack:** Python standard library (`math.isqrt`, `unittest`); existing Node model remains unchanged.

---

### Task 1: Specify numerical behavior in tests

**Files:** Create `tests/test_day5_lp_source.py`.

- [ ] Write tests that load `04-六天实战源码/day5-defi/04-lp-vs-hold.py` through `importlib.util.spec_from_file_location`.
- [ ] Assert 100 A/B deposit grants 100 shares out of 1100, with separate A/B totals unchanged.
- [ ] Assert price 4 alone leaves every asset balance unchanged.
- [ ] Assert zero-fee arbitrage pays 1100 B into the pool, receives 550 A, sells it for 2200 B at the market, earns 1100 B, and preserves both asset totals.
- [ ] Assert withdrawal returns 50 A and 200 B; LP/hold values are 400/500 B and the difference is -100 B (-20%).
- [ ] Assert an impossible trade fails with no partial ledger changes, and the CLI prints the comparison and scope.
- [ ] Run `python -X utf8 -m unittest discover -s tests -p test_day5_lp_source.py`; verify the tests fail because the new module is absent.

### Task 2: Implement the minimal ledger

**Files:** Create `04-六天实战源码/day5-defi/04-lp-vs-hold.py`.

- [ ] Define `SCALE = 10**6`, `create_state()`, `totals(state)`, `deposit(state)`, `set_price(state, price)`, `arbitrage(state)`, `comparison(state)`, and `withdraw(state)`.
- [ ] In `arbitrage`, compute target B reserve with `math.isqrt(pool_A * pool_B * price // SCALE)`, use `amount_B = target - pool_B`, and compute `out_A = amount_B * pool_A // (pool_B + amount_B)`; check cash and positive profit before all balance writes.
- [ ] Keep original deposited amounts for the holding benchmark; value both positions at the same external price. Print intermediate balances, the LP claim, the holding benchmark and omitted features under `if __name__ == '__main__'`.
- [ ] Re-run the focused test and the script until both pass.

### Task 3: Connect the source lesson

**Files:** Modify `04-六天实战源码/day5-defi/README.md`, `README.md`, `docs/verification.md`.

- [ ] Add a Day 5 README command to run the new script and one prediction exercise: price change alone versus arbitrage.
- [ ] Explain the four ledger locations, zero-fee fixed scenario, -20% relative-to-hold result, and distinction from the Solidity minimum-liquidity lock.
- [ ] Update the root chapter summary and append verification evidence with the actual passing test counts.

### Task 4: Verify and publish

- [ ] Run the focused and full Python tests, all 73 Node tests, `tests/solidity-check.cjs` with the existing temporary `NODE_PATH`, manuscript consistency, and `git diff --check`.
- [ ] Review the diff for scope and untracked files; commit and push using this machine's configured local proxy `http://127.0.0.1:7897` if needed.
- [ ] Confirm the remote commit and the matching GitHub checks / Pages workflow finish successfully.
