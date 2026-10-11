const { test } = require("node:test");
const assert = require("node:assert/strict");
const amm = require("../assets/js/amm.js");
const fixture = require("./amm-vectors.json");

test("cross-language exact integer quotes", () => {
  for (const v of fixture) {
    assert.equal(
      amm
        .quoteOutput(BigInt(v.x), BigInt(v.y), BigInt(v.input), v.feeBps)
        .toString(),
      v.output,
    );
  }
});
test("fees stay in reserves; both assets are conserved", () => {
  const before = amm.createState("1000", 30);
  const q = amm.makeQuote(before, "A", amm.parseAmount("100"), 50);
  const after = amm.execute(before, q).state;
  assert.equal(after.pool.A, amm.parseAmount("1100"));
  assert.equal(after.pool.B, amm.parseAmount("909.338911"));
  for (const token of ["A", "B"]) {
    assert.equal(
      before.pool[token] + before.wallet[token] + before.other[token],
      after.pool[token] + after.wallet[token] + after.other[token],
    );
  }
  assert.ok(after.pool.A * after.pool.B > before.pool.A * before.pool.B);
  assert.equal(
    before.pool.A,
    amm.parseAmount("1000"),
    "input state is immutable",
  );
});
test("reverse direction is symmetric", () => {
  const s = amm.createState("1000", 30);
  const a = amm.execute(
    s,
    amm.makeQuote(s, "A", amm.parseAmount("100"), 50),
  ).state;
  const b = amm.execute(
    s,
    amm.makeQuote(s, "B", amm.parseAmount("100"), 50),
  ).state;
  assert.equal(a.pool.A, b.pool.B);
  assert.equal(a.pool.B, b.pool.A);
});
test("an intervening trade rejects an outdated minimum without changing state", () => {
  const s = amm.createState("1000", 30);
  const q = amm.makeQuote(s, "A", amm.parseAmount("100"), 50);
  const moved = amm.intervene(s, "A", amm.parseAmount("200")).state;
  const snapshot = JSON.stringify(moved, (_, v) =>
    typeof v === "bigint" ? String(v) : v,
  );
  assert.throws(() => amm.execute(moved, q), /最小接收量/);
  assert.equal(
    JSON.stringify(moved, (_, v) => (typeof v === "bigint" ? String(v) : v)),
    snapshot,
  );
});
test("intervening trader has a real ledger and conserved assets", () => {
  const s = amm.createState("1000", 30);
  const next = amm.intervene(s, "A", amm.parseAmount("200")).state;
  assert.equal(next.other.A, amm.parseAmount("800"));
  for (const token of ["A", "B"])
    assert.equal(
      s.pool[token] + s.other[token],
      next.pool[token] + next.other[token],
    );
});
test("invalid inputs, empty pools and zero-output trades are rejected", () => {
  for (const value of ["0", "-1", "1e3", "NaN", "1.0000001", "", "1,000"])
    assert.throws(() => amm.parseAmount(value));
  assert.equal(amm.parseAmount("0.000001"), 1n);
  assert.equal(amm.formatAmount(90661089n), "90.661089");
  assert.throws(() => amm.quoteOutput(0n, 100n, 1n, 30));
  assert.throws(() => amm.quoteOutput(1000000n, 1n, 1n, 30), /零/);
  const s = amm.createState("1000", 30);
  assert.throws(
    () => amm.makeQuote(s, "A", amm.parseAmount("1001"), 50),
    /余额/,
  );
});
test("deeper pools give more output at the same initial ratio", () => {
  const outputs = ["100", "1000", "10000"].map((size) => {
    const s = amm.createState(size, 30);
    return amm.makeQuote(s, "A", amm.parseAmount("100"), 50).output;
  });
  assert.ok(outputs[0] < outputs[1] && outputs[1] < outputs[2]);
});
