// Local VM only. Dependency versions are pinned in CI, outside the checkout.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const solc = require("solc"),
  ganache = require("ganache"),
  { ethers } = require("ethers");
(async () => {
  const filename = "02-reentrancy-sol.sol",
    content = fs.readFileSync(
      path.join(__dirname, "../04-六天实战源码/day6-security", filename),
      "utf8",
    );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { [filename]: { content } },
        settings: {
          outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
        },
      }),
    ),
  );
  assert.deepEqual(
    (output.errors || []).filter((e) => e.severity === "error"),
    [],
  );
  const contracts = output.contracts[filename];
  assert.ok(contracts.BoundedReceiver, "missing executable bounded receiver");
  const chain = ganache.provider({
    logging: { quiet: true },
    wallet: { deterministic: true },
  });
  try {
    const provider = new ethers.BrowserProvider(chain);
    provider.pollingInterval = 50;
    const alice = await provider.getSigner(0),
      bob = await provider.getSigner(1),
      addr = await alice.getAddress();
    const one = ethers.parseEther("1"),
      total = one * 6n;
    const send = async (p) => (await p).wait();
    const balance = async (address) =>
      BigInt(
        await chain.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        }),
      );
    const deploy = async (name, args = []) => {
      const c = contracts[name],
        v = await new ethers.ContractFactory(
          c.abi,
          c.evm.bytecode.object,
          alice,
        ).deploy(...args);
      await v.waitForDeployment();
      return v;
    };
    const fixture = async (name) => {
      const bank = await deploy(name),
        receiver = await deploy("BoundedReceiver", [await bank.getAddress()]);
      await send(bank.deposit({ value: one * 3n }));
      await send(bank.connect(bob).deposit({ value: one * 2n }));
      await send(receiver.seed({ value: one }));
      assert.equal(await balance(await bank.getAddress()), total);
      return { bank, receiver };
    };
    for (const name of [
      "VulnerableBank",
      "SafeBank",
      "LockOnlyBank",
      "SafeBankWithLock",
    ]) {
      const { bank, receiver } = await fixture(name),
        raddr = await receiver.getAddress(),
        baddr = await bank.getAddress();
      const r = await send(
        receiver.attack(6, true, false, { gasLimit: 3000000 }),
      );
      assert.equal(r.status, 1);
      const paid = name === "VulnerableBank" ? total : one;
      assert.equal(await balance(raddr), paid);
      assert.equal(await balance(baddr), total - paid);
      assert.equal(await bank.balances(raddr), 0n);
      assert.equal(await bank.balances(addr), one * 3n);
      assert.equal((await balance(raddr)) + (await balance(baddr)), total);
      if (name === "VulnerableBank")
        await assert.rejects(bank.withdraw.staticCall());
      else {
        await send(bank.withdraw());
        assert.equal(await bank.balances(addr), 0n);
      }
      // Freshly reject a receive, proving transfer/claim/events/lock rollback.
      const f = await fixture(name),
        faddr = await f.receiver.getAddress(),
        fbaddr = await f.bank.getAddress();
      const beforeNative = await balance(addr),
        beforeNonce = BigInt(
          await chain.request({
            method: "eth_getTransactionCount",
            params: [addr, "latest"],
          }),
        );
      const tx = await f.receiver.attack(6, true, true, { gasLimit: 3000000 });
      let receipt;
      try {
        await tx.wait();
        assert.fail("must reject");
      } catch (e) {
        receipt = e.receipt;
        assert.ok(receipt && receipt.status === 0);
      }
      assert.equal(receipt.logs.length, 0);
      assert.equal(await balance(faddr), 0n);
      assert.equal(await balance(fbaddr), total);
      assert.equal(await f.bank.balances(faddr), one);
      assert.equal(await f.receiver.receivedCount(), 0n);
      assert.equal(
        beforeNative - (await balance(addr)),
        receipt.gasUsed * receipt.gasPrice,
      );
      assert.equal(
        BigInt(
          await chain.request({
            method: "eth_getTransactionCount",
            params: [addr, "latest"],
          }),
        ),
        beforeNonce + 1n,
      );
      await send(f.receiver.attack(1, true, false, { gasLimit: 3000000 })); // lock released by rollback
      assert.equal(await balance(faddr), one);
      const bubble = await fixture(name);
      if (name !== "VulnerableBank") {
        await assert.rejects(
          bubble.receiver.attack.staticCall(6, false, false),
        );
        const t = await bubble.receiver.attack(6, false, false, {
          gasLimit: 3000000,
        });
        await assert.rejects(t.wait());
        assert.equal(await balance(await bubble.bank.getAddress()), total);
        assert.equal(
          await bubble.bank.balances(await bubble.receiver.getAddress()),
          one,
        );
        assert.equal(await balance(await bubble.receiver.getAddress()), 0n);
      } else {
        // Without catching, attempting payout seven unwinds all six transient payments.
        const t = await bubble.receiver.attack(7, false, false, {
          gasLimit: 3000000,
        });
        await assert.rejects(t.wait());
        assert.equal(await balance(await bubble.bank.getAddress()), total);
        assert.equal(await balance(await bubble.receiver.getAddress()), 0n);
        await send(
          bubble.receiver.attack(8, true, false, { gasLimit: 3000000 }),
        );
        assert.equal(await balance(await bubble.receiver.getAddress()), total);
      }
    }
    console.log(
      "Local security VM passed: real reentrancy, CEI, lock-only and combined guard, cash conservation, caught/bubbling failures, rejected receive rollback, event/nonce/fees and lock recovery.",
    );
  } finally {
    await chain.disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
