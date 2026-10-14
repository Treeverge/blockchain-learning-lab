const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../assets/js/security.js");
test("honest withdrawal settles a claim without creating money", () => {
  const s = S.createState(),
    r = S.run(s, { caller: "Alice" });
  assert.equal(r.success, true);
  assert.equal(r.state.cash, 3n);
  assert.equal(r.state.wallets.Alice, 3n);
  assert.equal(r.state.claims.Alice, 0n);
  assert.equal(S.totals(r.state).gap, 0n);
  assert.deepEqual(s, S.createState());
});
test("vulnerable callbacks consume actual cash and leave unpaid claims", () => {
  const r = S.run(S.createState());
  assert.equal(r.success, true);
  assert.equal(r.state.cash, 0n);
  assert.equal(r.state.wallets.Attacker, 6n);
  assert.equal(r.state.claims.Attacker, 0n);
  assert.equal(S.totals(r.state).claims, 5n);
  assert.equal(S.totals(r.state).gap, 5n);
  assert.equal(S.totals(r.state).assets, 6n);
});
test("CEI and lock each stop repeated payout when inner failure is caught", () => {
  for (const mode of ["cei", "lock"]) {
    const r = S.run(S.createState(), { mode });
    assert.equal(r.success, true);
    assert.equal(r.state.cash, 5n);
    assert.equal(r.state.wallets.Attacker, 1n);
    assert.equal(r.state.claims.Attacker, 0n);
    assert.equal(r.state.locked, false);
    assert.equal(S.totals(r.state).gap, 0n);
    assert.ok(r.trace.some((t) => t.kind === "caught"));
  }
});
test("unhandled safe-bank callback failure rolls back the entire withdrawal", () => {
  for (const mode of ["cei", "lock"]) {
    const s = S.createState(),
      r = S.run(s, { mode, catchFailure: false });
    assert.equal(r.success, false);
    assert.deepEqual(r.state, s);
    assert.deepEqual(r.logs, []);
    assert.ok(r.trace.some((t) => t.state.wallets.Attacker === 1n));
  }
});
test("bounded payouts and failing seventh payout have distinct commit results", () => {
  for (let maxPayouts = 1; maxPayouts <= 8; maxPayouts++)
    for (const catchFailure of [true, false]) {
      const s = S.createState(),
        r = S.run(s, { maxPayouts, catchFailure });
      const success = maxPayouts <= 6 || catchFailure;
      assert.equal(r.success, success);
      assert.equal(
        r.state.wallets.Attacker,
        success ? BigInt(Math.min(maxPayouts, 6)) : 0n,
      );
      assert.equal(S.totals(r.state).assets, 6n);
      assert.ok(r.state.cash >= 0n);
      if (!success) assert.deepEqual(r.state, s);
    }
});
test("receiver rejection restores transfer, effects, lock and event logs", () => {
  for (const mode of ["vulnerable", "cei", "lock"]) {
    const s = S.createState(),
      r = S.run(s, { mode, receiverReject: true });
    assert.equal(r.success, false);
    assert.deepEqual(r.state, s);
    assert.deepEqual(r.logs, []);
  }
});
test("insolvent bank cannot pay an honest depositor and cannot invent cash", () => {
  const drained = S.run(S.createState()).state;
  const r = S.run(drained, { caller: "Alice" });
  assert.equal(r.success, false);
  assert.deepEqual(r.state, drained);
  assert.equal(r.state.claims.Alice, 3n);
  assert.equal(S.totals(r.state).gap, 5n);
});
test("CEI zeroes the claim before callback while lock keeps it behind a gate", () => {
  const cei = S.run(S.createState(), { mode: "cei" }),
    lock = S.run(S.createState(), { mode: "lock" });
  const a = cei.trace.find((t) => t.kind === "callback"),
    b = lock.trace.find((t) => t.kind === "callback");
  assert.equal(a.state.claims.Attacker, 0n);
  assert.equal(a.state.locked, false);
  assert.equal(b.state.claims.Attacker, 1n);
  assert.equal(b.state.locked, true);
  for (const r of [cei, lock])
    for (const t of r.trace) assert.equal(S.totals(t.state).assets, 6n);
});
test("trace snapshots and returned result do not alias the input or each other", () => {
  const s = S.createState(),
    r = S.run(s);
  r.trace[0].state.cash = 99n;
  r.state.wallets.Alice = 99n;
  assert.deepEqual(s, S.createState());
  assert.equal(r.trace[1].state.cash, 6n);
});
test("invalid model parameters fail without changing the input", () => {
  const s = S.createState();
  for (const opt of [
    { mode: "unknown" },
    { caller: "Mallory" },
    { maxPayouts: 0 },
    { maxPayouts: 9 },
    { maxPayouts: 1.5 },
    { catchFailure: "yes" },
    { receiverReject: 1 },
  ])
    assert.throws(() => S.run(s, opt));
  assert.deepEqual(s, S.createState());
});
