const { test } = require("node:test"),
  assert = require("node:assert/strict");
const A = require("../assets/js/account.js"),
  M = require("../assets/js/amm.js"),
  u = M.parseAmount;
const transfer = (s, extra = {}) =>
  A.draft(s, {
    from: "Alice",
    kind: "transfer",
    to: "Bob",
    amount: u("10"),
    ...extra,
  });
test("native accounts and token storage are separate; transfer charges actual gas, not maximum budget", () => {
  const s = A.createState(),
    tx = transfer(s),
    r = A.execute(s, tx);
  assert.equal(tx.gasLimit, 70000);
  assert.equal(r.receipt.gasUsed, 40000);
  assert.equal(r.receipt.fee, u("0.04"));
  assert.equal(r.receipt.maxBudget, u("0.07"));
  assert.equal(r.receipt.status, "success");
  assert.equal(r.state.accounts.Alice.G, u("0.96"));
  assert.equal(r.state.accounts.Alice.nonce, 1);
  assert.equal(r.state.token.balances.Alice, u("90"));
  assert.equal(r.state.token.balances.Bob, u("60"));
  assert.equal(s.token.balances.Alice, u("100"));
});
test("replayed, future nonce and invalid intrinsic limit reject without fees or mutation", () => {
  const s = A.createState(),
    tx = transfer(s),
    next = A.execute(s, tx).state;
  for (const bad of [
    tx,
    transfer(next, { nonce: 2 }),
    transfer(next, { gasLimit: 20000 }),
  ]) {
    const r = A.execute(next, bad);
    assert.equal(r.receipt.status, "rejected");
    assert.deepEqual(r.state, next);
    assert.equal(r.receipt.fee, 0n);
  }
});
test("two drafts sharing a nonce cannot both execute", () => {
  const s = A.createState(),
    x = transfer(s),
    y = transfer(s, { to: "Eve" }),
    first = A.execute(s, x),
    second = A.execute(first.state, y);
  assert.equal(second.receipt.status, "rejected");
  assert.equal(second.state.token.balances.Eve, 0n);
  assert.equal(second.state.fees, u("0.04"));
});
test("writes and attempted events roll back after deliberate failure; included nonce and fee remain", () => {
  const s = A.createState(),
    r = A.execute(
      s,
      A.draft(s, {
        from: "Alice",
        kind: "transferThenFail",
        to: "Bob",
        amount: u("10"),
      }),
    );
  assert.equal(r.receipt.status, "reverted");
  assert.equal(r.state.accounts.Alice.nonce, 1);
  assert.equal(r.state.accounts.Alice.G, u("0.94"));
  assert.deepEqual(r.state.token, s.token);
  assert.equal(r.state.events.length, 0);
  assert.ok(r.receipt.trace.some((t) => t.includes("临时")));
  assert.equal(r.receipt.logs.length, 0);
});
test("insufficient LAB is an included contract failure, while missing native gas budget rejects before execution", () => {
  const s = A.createState(),
    r = A.execute(s, transfer(s, { amount: u("999") }));
  assert.equal(r.receipt.status, "reverted");
  assert.equal(r.state.accounts.Alice.nonce, 1);
  assert.equal(r.state.fees, u("0.04"));
  assert.deepEqual(r.state.token, s.token);
  const noGas = A.execute(s, transfer(s, { gasPrice: u("1") }));
  assert.equal(noGas.receipt.status, "rejected");
  assert.deepEqual(noGas.state, s);
});
test("out of gas charges the limit and restores business state", () => {
  const s = A.createState(),
    r = A.execute(s, transfer(s, { gasLimit: 30000 }));
  assert.equal(r.receipt.status, "out-of-gas");
  assert.equal(r.receipt.gasUsed, 30000);
  assert.equal(r.receipt.fee, u("0.03"));
  assert.deepEqual(r.state.token, s.token);
  assert.equal(r.state.accounts.Alice.nonce, 1);
});
test("temporary read calculation does not persist; submitted storage update does", () => {
  const s = A.createState(),
    read = A.previewMemory(s, 9);
  assert.equal(read.temporary, 9);
  assert.equal(read.stored, 0);
  assert.equal(s.token.counter, 0);
  const r = A.execute(s, A.draft(s, { from: "Bob", kind: "store", value: 9 }));
  assert.equal(r.receipt.status, "success");
  assert.equal(r.state.token.counter, 9);
  assert.equal(s.token.counter, 0);
});
test("approval transfers no tokens; spender pays native fee and consumes owner allowance", () => {
  let s = A.createState();
  s = A.execute(
    s,
    A.draft(s, {
      from: "Alice",
      kind: "approve",
      spender: "Eve",
      amount: u("20"),
    }),
  ).state;
  assert.equal(s.token.balances.Alice, u("100"));
  assert.equal(A.allowance(s, "Alice", "Eve"), u("20"));
  const r = A.execute(
    s,
    A.draft(s, {
      from: "Eve",
      kind: "transferFrom",
      owner: "Alice",
      to: "Bob",
      amount: u("15"),
    }),
  );
  assert.equal(r.receipt.status, "success");
  assert.equal(A.allowance(r.state, "Alice", "Eve"), u("5"));
  assert.equal(r.state.accounts.Eve.G, u("0.95"));
  assert.equal(r.state.token.balances.Alice, u("85"));
  assert.equal(r.state.token.balances.Bob, u("65"));
  const fail = A.execute(
    r.state,
    A.draft(r.state, {
      from: "Eve",
      kind: "transferFrom",
      owner: "Alice",
      to: "Bob",
      amount: u("15"),
    }),
  );
  assert.equal(fail.receipt.status, "reverted");
  assert.deepEqual(fail.state.token, r.state.token);
  assert.equal(fail.state.accounts.Eve.nonce, 2);
});
test("revocation, self transfers and all execution outcomes conserve each asset", () => {
  let s = A.createState();
  for (const make of [
    (s) => transfer(s, { to: "Alice" }),
    (s) =>
      A.draft(s, {
        from: "Alice",
        kind: "approve",
        spender: "Eve",
        amount: 0n,
      }),
    (s) => transfer(s, { amount: u("999") }),
    (s) => transfer(s, { gasLimit: 30000 }),
  ]) {
    s = A.execute(s, make(s)).state;
    const t = A.totals(s);
    assert.equal(t.G, u("3"));
    assert.equal(t.LAB, u("150"));
    assert.equal(t.LAB, s.token.supply);
  }
  assert.equal(A.allowance(s, "Alice", "Eve"), 0n);
  assert.equal(s.token.balances.Alice, u("100"));
});
