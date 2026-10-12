const { test } = require("node:test");
const assert = require("node:assert/strict");
const M = require("../assets/js/amm.js");
const U = require("../assets/js/utxo.js");
const u = M.parseAmount;
async function transfer(lab, refs = ["seed-alice-70:0"]) {
  return U.createTransfer(
    lab.state,
    lab.people.Alice.id,
    lab.people.Bob.id,
    refs,
    u("45"),
    u("1"),
  );
}
test("ephemeral keys cannot export private material; real signatures verify", async () => {
  const lab = await U.createLab();
  assert.equal(lab.people.Alice.privateKey.extractable, false);
  const tx = await U.sign(await transfer(lab), lab.people.Alice);
  const report = await U.verify(lab.state, tx);
  assert.ok(report.valid);
  assert.ok(report.signatureValid && report.ownershipValid);
  assert.equal(tx.outputs[1].amount, u("24"));
});
test("changing recipient and recomputing id cannot preserve an old signature", async () => {
  const lab = await U.createLab(),
    signed = await U.sign(await transfer(lab), lab.people.Alice);
  const changed = U.cloneTx(signed);
  changed.outputs[0].owner = lab.people.Eve.id;
  const rebuilt = await U.rehash(changed),
    r = await U.verify(lab.state, rebuilt);
  assert.ok(r.hashValid && r.amountsValid && r.ownershipValid);
  assert.equal(r.signatureValid, false);
  assert.equal(r.valid, false);
  await assert.rejects(() => U.apply(lab.state, rebuilt), /签名/);
});
test("a valid signature by another person is not authorization", async () => {
  const lab = await U.createLab(),
    tx = await U.sign(await transfer(lab), lab.people.Eve);
  const r = await U.verify(lab.state, tx);
  assert.equal(r.signatureValid, true);
  assert.equal(r.ownershipValid, false);
  assert.equal(r.valid, false);
  await assert.rejects(() => U.apply(lab.state, tx), /所有者/);
});
test("UTXO consumption, change and fee accounting conserve assets", async () => {
  const lab = await U.createLab(),
    before = lab.state,
    tx = await U.sign(await transfer(lab), lab.people.Alice),
    next = await U.apply(before, tx);
  assert.equal(U.total(before), U.total(next));
  assert.equal(next.fees, u("1"));
  assert.ok(!next.utxos.some((v) => v.ref === "seed-alice-70:0"));
  assert.equal(U.balance(next, lab.people.Alice.id), u("54"));
  assert.equal(U.balance(next, lab.people.Bob.id), u("95"));
  assert.equal(before.utxos.length, 3);
});
test("two authorized candidates can conflict; only one can consume an input", async () => {
  const lab = await U.createLab(),
    first = await U.sign(await transfer(lab), lab.people.Alice);
  const second = await U.sign(
    await U.createTransfer(
      lab.state,
      lab.people.Alice.id,
      lab.people.Eve.id,
      first.inputs,
      u("45"),
      u("1"),
    ),
    lab.people.Alice,
  );
  assert.ok((await U.verify(lab.state, first)).valid);
  assert.ok((await U.verify(lab.state, second)).valid);
  const confirmed = await U.apply(lab.state, first),
    snapshot = JSON.stringify(confirmed, (_, v) =>
      typeof v === "bigint" ? String(v) : v,
    );
  const r = await U.verify(confirmed, second);
  assert.equal(r.inputsValid, false);
  assert.equal(r.signatureValid, true);
  await assert.rejects(() => U.apply(confirmed, second), /已花费/);
  await assert.rejects(() => U.apply(confirmed, first), /已花费|重复/);
  assert.equal(
    JSON.stringify(confirmed, (_, v) =>
      typeof v === "bigint" ? String(v) : v,
    ),
    snapshot,
  );
});
test("multiple inputs are signed together; repeated inputs and excess outputs fail", async () => {
  const lab = await U.createLab();
  const tx = await U.sign(
    await transfer(lab, ["seed-alice-30:0", "seed-alice-70:0"]),
    lab.people.Alice,
  );
  assert.equal(tx.outputs[1].amount, u("54"));
  assert.ok((await U.verify(lab.state, tx)).valid);
  await assert.rejects(
    () => transfer(lab, ["seed-alice-70:0", "seed-alice-70:0"]),
    /重复/,
  );
  await assert.rejects(
    () =>
      U.createTransfer(
        lab.state,
        lab.people.Alice.id,
        lab.people.Bob.id,
        ["seed-alice-30:0"],
        u("45"),
        0n,
      ),
    /不足/,
  );
  const changed = U.cloneTx(tx);
  changed.outputs[0].amount = u("200");
  const r = await U.verify(lab.state, await U.sign(changed, lab.people.Alice));
  assert.equal(r.amountsValid, false);
  assert.equal(r.valid, false);
});
test("inputs, output amounts and fee are all bound by the signature", async () => {
  const lab = await U.createLab(),
    signed = await U.sign(await transfer(lab), lab.people.Alice);
  for (const change of [
    (t) => (t.inputs[0] = "seed-alice-30:0"),
    (t) => {
      t.outputs[0].amount += 1n;
      t.outputs[1].amount -= 1n;
    },
    (t) => {
      t.fee += 1n;
      t.outputs[1].amount -= 1n;
    },
  ]) {
    const changed = U.cloneTx(signed);
    change(changed);
    const r = await U.verify(lab.state, await U.rehash(changed));
    assert.ok(r.hashValid);
    assert.equal(r.signatureValid, false);
  }
});
test("missing witnesses, malformed outputs, old IDs and zero-fee transactions are checked", async () => {
  const lab = await U.createLab(),
    unsigned = await transfer(lab);
  assert.equal((await U.verify(lab.state, unsigned)).signatureValid, false);
  const signed = await U.sign(unsigned, lab.people.Alice),
    changed = U.cloneTx(signed);
  changed.fee += 1n;
  assert.equal((await U.verify(lab.state, changed)).hashValid, false);
  changed.outputs[0].amount = 0n;
  assert.equal((await U.verify(lab.state, changed)).valid, false);
  const noFee = await U.sign(
    await U.createTransfer(
      lab.state,
      lab.people.Alice.id,
      lab.people.Bob.id,
      ["seed-alice-70:0"],
      u("70"),
      0n,
    ),
    lab.people.Alice,
  );
  assert.equal(noFee.outputs.length, 1);
  assert.equal(U.total(await U.apply(lab.state, noFee)), u("150"));
  await assert.rejects(() =>
    require("node:crypto").webcrypto.subtle.exportKey(
      "pkcs8",
      lab.people.Alice.privateKey,
    ),
  );
});
