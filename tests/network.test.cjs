const { test } = require("node:test");
const assert = require("node:assert/strict");
const N = require("../assets/js/network.js"),
  U = require("../assets/js/utxo.js"),
  C = require("../assets/js/chain.js");
const u = require("../assets/js/amm.js").parseAmount;
const snapshot = (n) =>
  JSON.stringify(n, (_, v) => (typeof v === "bigint" ? String(v) : v));
async function forks() {
  let n = await N.createNetwork();
  for (const [node, tx] of [
    ["A", "X"],
    ["B", "X"],
    ["C", "Y"],
  ])
    n = (await N.receive(n, node, n.candidates[tx])).network;
  n = await N.mine(n, "A");
  n = await N.mine(n, "C");
  n = (await N.deliver(n, "A", "B")).network;
  return n;
}
test("nodes share a genesis but keep independent ledgers; pending transactions move no money", async () => {
  const n = await N.createNetwork();
  assert.notEqual(n.nodes.A.ledger, n.nodes.B.ledger);
  assert.ok((await U.verify(n.initial, n.candidates.X)).valid);
  assert.ok((await U.verify(n.initial, n.candidates.Y)).valid);
  const next = (await N.receive(n, "A", n.candidates.X)).network;
  assert.equal(next.nodes.A.pending.length, 1);
  assert.equal(next.nodes.B.pending.length, 0);
  assert.equal(U.balance(next.nodes.A.ledger, n.people.Bob.id), u("50"));
  assert.equal(n.nodes.A.pending.length, 0);
});
test("local first-received conflict policy is separate from cryptographic validity", async () => {
  let n = await N.createNetwork();
  n = (await N.receive(n, "A", n.candidates.X)).network;
  const r = await N.receive(n, "A", n.candidates.Y);
  assert.equal(r.accepted, false);
  assert.equal(r.reason, "pending-conflict");
  assert.equal(r.report.valid, true);
  assert.equal(r.network.nodes.A.pending.length, 1);
  assert.equal(r.network.nodes.A.ledger.fees, 0n);
});
test("real proof confirms only the miner ledger and preserves the input network", async () => {
  let n = await N.createNetwork();
  n = (await N.receive(n, "A", n.candidates.X)).network;
  const before = snapshot(n);
  const next = await N.mine(n, "A");
  assert.equal(snapshot(n), before);
  assert.ok((await N.replay(next, next.nodes.A.chain)).valid);
  assert.ok(next.nodes.A.chain[1].hash.startsWith("0"));
  assert.equal(U.balance(next.nodes.A.ledger, n.people.Bob.id), u("95"));
  assert.equal(next.nodes.A.ledger.fees, u("1"));
  assert.equal(next.nodes.B.chain.length, 1);
  assert.equal(next.nodes.A.pending.length, 0);
});
test("equal work retains different histories even when two nodes have one branch", async () => {
  const n = await forks();
  const r = await N.deliver(n, "C", "A");
  assert.equal(r.accepted, false);
  assert.equal(r.reason, "tie");
  assert.equal(
    r.network.nodes.A.chain.at(-1).hash,
    n.nodes.B.chain.at(-1).hash,
  );
  assert.notEqual(
    r.network.nodes.A.chain.at(-1).hash,
    n.nodes.C.chain.at(-1).hash,
  );
  assert.equal(r.currentWork, 16n);
  assert.equal(r.candidateWork, 16n);
});
test("more valid work rolls back old outputs and fees then replays the new branch", async () => {
  let n = await forks();
  n = await N.mine(n, "C");
  const r = await N.deliver(n, "C", "A");
  assert.ok(r.accepted);
  const ledger = r.network.nodes.A.ledger;
  assert.equal(U.balance(ledger, n.people.Bob.id), u("50"));
  assert.equal(U.balance(ledger, n.people.Eve.id), u("45"));
  assert.equal(U.balance(ledger, n.people.Alice.id), u("54"));
  assert.equal(ledger.fees, u("1"));
  assert.equal(U.total(ledger), u("150"));
  assert.ok(
    !ledger.utxos.some((c) => c.ref.startsWith(n.candidates.X.id + ":")),
  );
  assert.equal(r.reorg.detached, 1);
  assert.equal(r.reorg.attached, 2);
  assert.equal(r.reorg.dropped[0].id, n.candidates.X.id);
  assert.equal(r.reorg.dropped[0].signatureValid, true);
});
test("a longer chain with real proofs cannot override transaction ownership checks", async () => {
  let n = await forks();
  n = await N.mine(n, "C");
  n = (await N.deliver(n, "C", "A")).network;
  const bad = await N.makeInvalidChain(n);
  assert.ok((await C.inspect(bad, n.anchor, 1)).valid);
  const report = await N.replay(n, bad);
  assert.equal(report.valid, false);
  assert.equal(report.proofWork, 48n);
  assert.equal(report.work, 0n);
  assert.match(report.reason, /所有者/);
  const before = snapshot(n.nodes.A),
    r = await N.adopt(n, "A", bad, "外部");
  assert.equal(r.accepted, false);
  assert.equal(r.reason, "invalid");
  assert.equal(snapshot(r.network.nodes.A), before);
});
test("block commitment binds witnesses even when teaching body ID is unchanged", async () => {
  const n = await forks(),
    chain = N.cloneChain(n.nodes.A.chain);
  chain[1].transaction = await U.sign(n.candidates.X, n.people.Eve);
  assert.equal(chain[1].transaction.id, n.candidates.X.id);
  assert.ok((await C.inspect(chain, n.anchor, 1)).valid);
  const r = await N.replay(n, chain);
  assert.equal(r.valid, false);
  assert.match(r.reason, /摘要/);
});
test("valid orphan transactions return to pending; conflicting ones are dropped", async () => {
  let n = await forks();
  const z = await U.sign(
    await U.createTransfer(
      n.initial,
      n.people.Alice.id,
      n.people.Bob.id,
      ["seed-alice-30:0"],
      u("10"),
      u("1"),
    ),
    n.people.Alice,
  );
  n = (await N.receive(n, "A", z)).network;
  n = await N.mine(n, "A");
  n = await N.mine(n, "C");
  n = await N.mine(n, "C");
  const r = await N.deliver(n, "C", "A");
  assert.ok(r.accepted);
  assert.equal(r.reorg.restored.length, 1);
  assert.equal(r.reorg.restored[0], z.id);
  assert.equal(r.network.nodes.A.pending[0].id, z.id);
  assert.equal(r.network.nodes.A.ledger.fees, u("1"));
  const next = await N.mine(r.network, "A");
  assert.equal(next.nodes.A.ledger.fees, u("2"));
  assert.equal(U.balance(next.nodes.A.ledger, n.people.Bob.id), u("60"));
  assert.equal(U.total(next.nodes.A.ledger), u("150"));
});
test("cancelled mining never commits partial nodes and unknown nodes are rejected", async () => {
  const n = await N.createNetwork(),
    before = snapshot(n),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    () => N.mine(n, "A", { signal: controller.signal }),
    /停止/,
  );
  assert.equal(snapshot(n), before);
  await assert.rejects(() => N.receive(n, "D", n.candidates.X), /节点/);
});
