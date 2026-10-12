const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../assets/js/chain.js");
test("SHA-256 matches a standard known vector", async () => {
  assert.equal(
    await C.sha256("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
test("editing an old record fails content validation without mutating original", async () => {
  const original = await C.createChain();
  const changed = C.edit(original, 1, "采购款 900");
  assert.equal((await C.inspect(original, original[0].hash, 0)).valid, true);
  const report = await C.inspect(changed, original[0].hash, 0);
  assert.equal(report.rows[1].hashValid, false);
  assert.equal(report.rows[2].ancestryValid, false);
  assert.equal(original[1].data, "工程项目：采购款 100");
});
test("recomputing makes a forged text chain self-consistent, but tied work is not selected", async () => {
  const original = await C.createChain();
  const repaired = await C.repair(C.edit(original, 1, "采购款 900"));
  assert.ok((await C.inspect(repaired, original[0].hash, 0)).valid);
  const result = await C.selectChain(original, repaired, original[0].hash, 0);
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "tie");
});
test("trusted genesis and ordered indices cannot be bypassed", async () => {
  const original = await C.createChain();
  const changed = original.map((b) => ({ ...b }));
  changed[0].data = "替换创世块";
  const rebuilt = await C.repair(changed, 0);
  assert.equal((await C.inspect(rebuilt, original[0].hash, 0)).valid, false);
  const reordered = original.map((b) => ({ ...b }));
  reordered[1].index = 9;
  assert.equal(
    (await C.inspect(await C.repair(reordered), original[0].hash, 0)).valid,
    false,
  );
});
test("mining checks real proofs; repairing alone cannot stand in for mining", async () => {
  const original = await C.createChain();
  const mined = await C.mineChain(original, 2);
  assert.ok((await C.inspect(mined, original[0].hash, 2)).valid);
  const repaired = await C.repair(C.edit(mined, 1, "采购款 900"));
  const report = await C.inspect(repaired, original[0].hash, 2);
  assert.ok(report.rows.every((r) => r.hashValid && r.linkValid));
  assert.equal(report.valid, false);
  const rebuilt = await C.mineChain(repaired, 2);
  assert.equal(
    (await C.selectChain(mined, rebuilt, original[0].hash, 2)).reason,
    "tie",
  );
  const longer = await C.append(rebuilt, "补充记录", 2);
  const verdict = await C.selectChain(mined, longer, original[0].hash, 2);
  assert.equal(verdict.accepted, true);
  assert.ok(verdict.candidateWork > verdict.currentWork);
});
test("invalid longer chains are rejected, difficulty and mining budgets are constrained", async () => {
  const s = await C.createChain();
  const longer = await C.append(s, "补充记录", 0);
  longer[1].data = "无效修改";
  assert.equal(
    (await C.selectChain(s, longer, s[0].hash, 0)).reason,
    "invalid",
  );
  assert.throws(() => C.edit(s, 0, "创世块"));
  assert.throws(() => C.edit(s, 1, ""));
  await assert.rejects(() => C.mineChain(s, 4));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => C.mineChain(s, 2, { signal: controller.signal }),
    /停止/,
  );
  assert.equal(s[1].nonce, 0);
});
test("cancellation during mining and exhausted budgets do not commit partial history", async () => {
  const chain = await C.createChain(),
    snapshot = JSON.stringify(chain),
    controller = new AbortController();
  await assert.rejects(
    () =>
      C.mineChain(chain, 3, {
        signal: controller.signal,
        onProgress: () => controller.abort(),
      }),
    /停止/,
  );
  assert.equal(JSON.stringify(chain), snapshot);
  await assert.rejects(() => C.mineChain(chain, 3, { maxAttempts: 1 }), /上限/);
  assert.equal(JSON.stringify(chain), snapshot);
});
