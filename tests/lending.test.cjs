const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../assets/js/amm.js");
const L = require("../assets/js/lending.js");
const u = M.parseAmount;
function funded() {
  return L.provide(L.createState(), u("10000"));
}
function borrowed() {
  return L.borrow(L.pledge(funded(), u("3")), u("180"));
}

test("providing cash, pledging and borrowing transfer real assets", () => {
  const initial = L.createState(),
    s = borrowed();
  assert.deepEqual(L.totals(initial), L.totals(s));
  assert.equal(s.poolCash, u("9820"));
  assert.equal(s.wallets.borrower.B, u("180"));
  assert.equal(s.wallets.borrower.C, u("1"));
  assert.equal(L.metrics(s).maxBorrow, u("200"));
  assert.equal(L.metrics(s).health, 1333333n);
});
test("repeated borrowing accumulates debt, not overwrites it", () => {
  let s = L.pledge(funded(), u("3"));
  s = L.borrow(s, u("100"));
  s = L.borrow(s, u("80"));
  assert.equal(s.debt, u("180"));
  assert.throws(() => L.borrow(s, u("21")), /上限/);
});
test("price changes no balances; exact threshold is not liquidatable", () => {
  const s = borrowed(),
    p = L.setPrice(s, u("75"));
  assert.deepEqual(L.totals(s), L.totals(p));
  assert.deepEqual(s.wallets, p.wallets);
  assert.equal(L.metrics(p).health, u("1"));
  assert.equal(L.metrics(p).liquidatable, false);
  assert.throws(() => L.liquidate(p), /健康/);
  assert.equal(L.metrics(L.setPrice(s, u("74.999999"))).liquidatable, true);
});
test("additional collateral and partial repayment restore health", () => {
  const s = L.setPrice(borrowed(), u("70"));
  assert.ok(L.metrics(s).liquidatable);
  const pledged = L.pledge(s, u("0.5"));
  const repaid = L.repay(s, u("30"));
  assert.equal(L.metrics(pledged).liquidatable, false);
  assert.equal(L.metrics(repaid).liquidatable, false);
  assert.deepEqual(L.totals(s), L.totals(pledged));
  assert.deepEqual(L.totals(s), L.totals(repaid));
});
test("full repayment returns collateral and closes scenario", () => {
  const s = L.repay(borrowed(), u("180"));
  assert.equal(s.collateral, 0n);
  assert.equal(s.debt, 0n);
  assert.equal(s.wallets.borrower.C, u("4"));
  assert.equal(s.poolCash, u("10000"));
  assert.equal(s.closed, true);
});
test("Python and browser liquidation fixtures agree exactly", () => {
  for (const v of require("./lending-vectors.json")) {
    const s = L.setPrice(borrowed(), u(v.price));
    const result = L.liquidate(s);
    for (const field of ["repaid", "seized", "returned", "badDebt"])
      assert.equal(M.formatAmount(result.settlement[field]), v[field]);
    assert.deepEqual(L.totals(s), L.totals(result));
    assert.equal(
      result.poolCash + result.debt + result.badDebt,
      result.deposits,
    );
    assert.equal(
      result.wallets.liquidator.B,
      s.wallets.liquidator.B - result.settlement.repaid,
    );
  }
});
test("failed actions leave balances unchanged", () => {
  const s = borrowed();
  const snapshot = JSON.stringify(s, (_, v) =>
    typeof v === "bigint" ? String(v) : v,
  );
  assert.throws(() => L.pledge(s, u("2")));
  assert.throws(() => L.repay(s, u("181")));
  assert.throws(() => L.repay(s, -1n));
  assert.throws(() => L.setPrice(s, u("201")));
  assert.throws(() => L.provide(s, u("1")));
  assert.equal(
    JSON.stringify(s, (_, v) => (typeof v === "bigint" ? String(v) : v)),
    snapshot,
  );
  const poor = {
    ...L.setPrice(s, u("60")),
    wallets: { ...s.wallets, liquidator: { C: 0n, B: u("1") } },
  };
  assert.throws(() => L.liquidate(poor), /余额/);
});
