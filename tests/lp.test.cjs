const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../assets/js/amm.js");
const LP = require("../assets/js/lp.js");
const u = M.parseAmount;
function totals(s) {
  return ["A", "B"].map((t) =>
    ["pool", "wallet", "trader", "arbitrage", "market"].reduce(
      (sum, k) => sum + s[k][t],
      0n,
    ),
  );
}

test("proportional deposit and withdrawal preserve assets and fair ownership", () => {
  const start = LP.createState(30);
  const joined = LP.deposit(start, u("100"));
  assert.deepEqual(totals(start), totals(joined));
  assert.equal(joined.userShares, u("100"));
  assert.equal(joined.totalShares, u("1100"));
  const ended = LP.withdraw(joined);
  assert.deepEqual(ended.position.received, { A: u("100"), B: u("100") });
  assert.deepEqual(totals(start), totals(ended));
  assert.equal(ended.wallet.A, start.wallet.A);
});
test("swaps retain fees and an LP claim includes them", () => {
  const s = LP.deposit(LP.createState(30), u("100"));
  const next = LP.swap(s, "A", u("100"));
  assert.deepEqual(totals(s), totals(next));
  assert.equal(next.pool.A, u("1200"));
  assert.equal(next.feeNumerator.A, u("100") * 30n);
  assert.ok(next.pool.A * next.pool.B > s.pool.A * s.pool.B);
});
test("changing an external price alone does not change reserves", () => {
  const s = LP.deposit(LP.createState(30), u("100"));
  const priced = LP.setPrice(s, u("4"));
  assert.deepEqual(priced.pool, s.pool);
  const settled = LP.arbitrage(priced);
  assert.ok(settled.lastArbitrage.profit > 0n);
  assert.deepEqual(totals(s), totals(settled));
  assert.ok(settled.pool.A < s.pool.A && settled.pool.B > s.pool.B);
});
test("zero-fee fourfold price yields approximately -20% versus holding", () => {
  let s = LP.deposit(LP.createState(0), u("100"));
  s = LP.arbitrage(LP.setPrice(s, u("4")));
  const result = LP.comparison(s);
  assert.equal(result.holdValue, u("500"));
  assert.ok(
    result.lpValue >= u("399.999998") && result.lpValue <= u("400.000002"),
  );
  const ended = LP.withdraw(s);
  assert.deepEqual(LP.comparison(ended), result);
});
test("arbitrage in either direction conserves each asset and uses real capital", () => {
  for (const price of ["0.5", "2", "4"]) {
    const s = LP.deposit(LP.createState(30), u("100"));
    const settled = LP.arbitrage(LP.setPrice(s, u(price)));
    assert.deepEqual(totals(s), totals(settled));
    assert.equal(
      settled.arbitrage.B - s.arbitrage.B,
      settled.lastArbitrage.profit,
    );
    assert.equal(settled.arbitrage.A, 0n);
  }
});
test("invalid actions and balances do not mutate input state", () => {
  const s = LP.createState(30);
  assert.throws(() => LP.withdraw(s));
  assert.throws(() => LP.deposit(s, u("1001")));
  assert.throws(() => LP.deposit(s, u("0.5")));
  const joined = LP.deposit(s, u("100"));
  assert.throws(() => LP.deposit(joined, u("100")));
  assert.throws(() => LP.swap(joined, "A", u("1001")));
  assert.throws(() => LP.setPrice(joined, u("100")));
  const ended = LP.withdraw(joined);
  assert.throws(() => LP.swap(ended, "A", u("1")));
  assert.throws(() => LP.setPrice(ended, u("2")));
  assert.equal(s.pool.A, u("1000"));
});
