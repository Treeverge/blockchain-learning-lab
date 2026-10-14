const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const C = require("../assets/js/curriculum.js");
const M = require("../assets/js/amm.js"),
  LP = require("../assets/js/lp.js"),
  L = require("../assets/js/lending.js"),
  S = require("../assets/js/security.js");
const correct = (s, id = "hash") => {
  let next = s;
  for (const q of C.lesson(id).questions)
    next = C.answer(next, id, q.id, q.correct);
  return next;
};
test("eight learning stops follow dependencies and link to real experiments, sources and tests", () => {
  assert.deepEqual(
    C.lessons.map((l) => l.id),
    [
      "hash",
      "utxo",
      "network",
      "account",
      "exchange",
      "lp",
      "lending",
      "security",
    ],
  );
  const ids = new Set();
  for (const l of C.lessons) {
    assert.equal(l.questions.length, 2);
    assert.equal(l.rubric.length, 3);
    assert.ok(l.prompt && l.challenge.task);
    for (const q of l.questions) {
      assert.ok(!ids.has(q.id));
      ids.add(q.id);
      assert.equal(q.choices.length, 3);
      assert.ok(q.correct >= 0 && q.correct < 3 && q.explanation);
    }
    for (const p of [l.href, l.source, l.test])
      assert.ok(fs.existsSync(path.join(__dirname, "..", p)), p);
  }
});
test("correct questions alone do not claim self-review completion", () => {
  const s = correct(C.createState());
  assert.equal(C.score(s, "hash"), 2);
  assert.equal(C.canConfirm(s, "hash"), false);
  assert.throws(() => C.confirm(s, "hash"));
  assert.equal(C.summary(s).completed, 0);
});
test("nonempty explanation and two correct choices allow explicit self-review", () => {
  const s = C.explain(
    correct(C.createState()),
    "hash",
    "重算只能证明本地链接自洽，不能证明事实真实。",
  );
  assert.equal(C.canConfirm(s, "hash"), true);
  const r = C.confirm(s, "hash");
  assert.equal(C.summary(r).completed, 1);
  assert.equal(s.records.hash.reviewed, false);
  assert.equal(r.records.hash.reviewed, true);
});
test("changing any answer or explanation revokes the previous self-review", () => {
  const s = C.confirm(
    C.explain(correct(C.createState()), "hash", "已对照三条标准解释。"),
    "hash",
  );
  const q = C.lesson("hash").questions[0];
  assert.equal(
    C.answer(s, "hash", q.id, (q.correct + 1) % 3).records.hash.reviewed,
    false,
  );
  assert.equal(C.explain(s, "hash", "重新解释").records.hash.reviewed, false);
  assert.equal(s.records.hash.reviewed, true);
});
test("missing, wrong and whitespace-only responses remain pending", () => {
  let s = C.createState();
  const q = C.lesson("hash").questions[0];
  s = C.answer(s, "hash", q.id, (q.correct + 1) % 3);
  s = C.explain(s, "hash", "  \n ");
  assert.equal(C.score(s, "hash"), 0);
  assert.equal(C.canConfirm(s, "hash"), false);
  assert.equal(C.summary(s).next, "hash");
});
test("clearing one stop preserves other records and resumes the first unfinished one", () => {
  let s = C.createState();
  for (const id of ["hash", "utxo"])
    s = C.confirm(C.explain(correct(s, id), id, "我的解释"), id);
  const r = C.clear(s, "hash");
  assert.equal(r.records.hash.note, "");
  assert.equal(r.records.utxo.reviewed, true);
  assert.equal(C.summary(r).next, "hash");
  assert.equal(C.summary(s).next, "network");
});
test("serialized progress is validated rather than trusting completion flags", () => {
  const s = C.confirm(
    C.explain(correct(C.createState()), "hash", "解释"),
    "hash",
  );
  assert.deepEqual(C.decode(JSON.stringify(s)), s);
  const fake = C.createState();
  fake.records.hash.reviewed = true;
  assert.equal(C.decode(JSON.stringify(fake)).records.hash.reviewed, false);
  const dirty = JSON.parse(JSON.stringify(s));
  dirty.extra = "<script>";
  dirty.records.hash.extra = "ignore";
  assert.deepEqual(C.decode(JSON.stringify(dirty)), s);
  for (const raw of ["{", "null", "[]", '{"version":2,"records":{}}'])
    assert.throws(() => C.decode(raw));
  const malformed = C.createState();
  malformed.records.hash.note = 123;
  assert.throws(() => C.decode(JSON.stringify(malformed)));
});
test("invalid selections, unknown stop IDs and oversized notes are rejected without mutation", () => {
  const s = C.createState();
  for (const call of [
    () => C.answer(s, "hash", "missing", 0),
    () => C.answer(s, "hash", C.lesson("hash").questions[0].id, 9),
    () => C.explain(s, "missing", "x"),
    () => C.explain(s, "hash", "x".repeat(6001)),
    () => C.explain(s, "hash", 9),
  ])
    assert.throws(call);
  assert.deepEqual(s, C.createState());
});
test("Markdown export separates automatic checks from self-review and safely quotes notes", () => {
  const s = C.explain(
    correct(C.createState()),
    "hash",
    "<script>\n```\n# 我的笔记",
  );
  const output = C.exportMarkdown(s);
  assert.match(output, /选择题：2 \/ 2/);
  assert.match(output, /未确认自检/);
  assert.match(output, /> ```/);
  assert.match(output, /> # 我的笔记/);
  assert.match(output, /不是掌握认证/);
  for (const l of C.lessons) assert.ok(output.includes(l.title));
});
test("numerical lesson scenarios and source challenges agree with executable models", () => {
  const u = M.parseAmount;
  assert.equal(
    M.quoteOutput(u("1000"), u("1000"), u("100"), 0),
    u("90.909090"),
  );
  const fixture = LP.deposit(LP.createState(0), u("100"));
  assert.throws(() => LP.setPrice(fixture, u("0.25")), /预设/);
  // Challenge extends the UI price allowlist in a copy. Verify its arithmetic independently.
  fixture.price = u("0.25");
  const lp = LP.comparison(LP.arbitrage(fixture));
  assert.equal(lp.holdValue, u("125"));
  assert.ok(lp.lpValue >= u("99.999") && lp.lpValue <= u("100.001"));
  let loan = L.borrow(
    L.pledge(L.provide(L.createState(), u("10000")), u("3")),
    u("180"),
  );
  assert.equal(L.metrics(L.setPrice(loan, u("75"))).liquidatable, false);
  loan = L.repay(L.setPrice(loan, u("60")), u("100"));
  assert.equal(loan.debt, u("80"));
  assert.equal(L.metrics(loan).health, u("1.8"));
  assert.equal(loan.collateral, u("3"));
  assert.equal(loan.closed, false);
  const state = S.createState();
  state.cash = 7n;
  state.claims.Alice = 4n;
  const committed = S.run(state, { maxPayouts: 7 });
  assert.equal(committed.state.wallets.Attacker, 7n);
  assert.equal(S.totals(committed.state).gap, 6n);
  assert.deepEqual(
    S.run(state, { maxPayouts: 8, catchFailure: false }).state,
    state,
  );
});
