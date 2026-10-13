// Optional local VM verification; dependencies live outside the project.
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const solc = require("solc"),
  { ethers } = require("ethers"),
  ganache = require("ganache");
(async () => {
  const root = path.resolve(
    __dirname,
    "..",
    "04-六天实战源码",
    "day4-smart-contracts",
  );
  const sources = Object.fromEntries(
    ["02-my-token.sol", "03-storage-demo.sol", "04-execution-lab.sol"].map(
      (name) => [
        name,
        { content: fs.readFileSync(path.join(root, name), "utf8") },
      ],
    ),
  );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources,
        settings: {
          outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
        },
      }),
    ),
  );
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  assert.deepEqual(
    errors,
    [],
    errors.map((e) => e.formattedMessage).join("\n"),
  );
  const chain = ganache.provider({
    logging: { quiet: true },
    wallet: { deterministic: true },
  });
  try {
    const provider = new ethers.BrowserProvider(chain);
    provider.pollingInterval = 100;
    const alice = await provider.getSigner(0),
      bob = await provider.getSigner(1),
      eve = await provider.getSigner(2),
      addr = await alice.getAddress(),
      baddr = await bob.getAddress(),
      eaddr = await eve.getAddress();
    const deploy = async (file, name, args = []) => {
      const c = output.contracts[file][name];
      const contract = await new ethers.ContractFactory(
        c.abi,
        c.evm.bytecode.object,
        alice,
      ).deploy(...args);
      await contract.waitForDeployment();
      return contract;
    };
    const sent = async (p) => (await p).wait();
    const token = await deploy("02-my-token.sol", "MyToken", [
      "Learning Token",
      "LAB",
      150,
    ]);
    await sent(token.mint(baddr, 20n));
    assert.equal(await token.balanceOf(baddr), 20n);
    await assert.rejects(token.connect(eve).mint.staticCall(eaddr, 1n));
    await assert.rejects(token.mint.staticCall(ethers.ZeroAddress, 1n));
    await sent(token.approve(eaddr, 20n));
    await sent(token.connect(eve).transferFrom(addr, baddr, 15n));
    assert.equal(await token.allowance(addr, eaddr), 5n);
    await assert.rejects(
      token.connect(eve).transferFrom.staticCall(addr, baddr, 15n),
    );
    const storage = await deploy("03-storage-demo.sol", "StorageDemo");
    const count = await storage.getNumberCount(),
      originalNumbers = Array.from(await storage.getNumbers());
    assert.equal(await storage.demoMemoryVsStorage(), 60n);
    assert.equal(await storage.getNumberCount(), count);
    await sent(storage.demoStorageModification(9));
    assert.equal(await storage.getNumberCount(), count + 1n);
    assert.deepEqual(Array.from(await storage.getNumbers()), [
      ...originalNumbers,
      9n,
    ]);
    const lab = await deploy("04-execution-lab.sol", "ExecutionLab");
    assert.equal(await lab.previewMemory(9), 9n);
    assert.equal(await lab.counter(), 0n);
    await sent(lab.store(9));
    assert.equal(await lab.counter(), 9n);
    const before = {
      counter: await lab.counter(),
      tokens: await lab.balanceOf(addr),
      other: await lab.balanceOf(baddr),
      nonce: await chain.request({
        method: "eth_getTransactionCount",
        params: [addr, "latest"],
      }),
      balance: BigInt(
        await chain.request({
          method: "eth_getBalance",
          params: [addr, "latest"],
        }),
      ),
    };
    const tx = await lab.transferThenFail(baddr, 10n, { gasLimit: 200000 });
    let receipt;
    try {
      await tx.wait();
      assert.fail("transaction must revert");
    } catch (e) {
      receipt = e.receipt;
      assert.ok(receipt && receipt.status === 0);
    }
    assert.equal(await lab.counter(), before.counter);
    assert.equal(await lab.balanceOf(addr), before.tokens);
    assert.equal(await lab.balanceOf(baddr), before.other);
    assert.equal(receipt.logs.length, 0);
    const afterBalance = BigInt(
      await chain.request({
        method: "eth_getBalance",
        params: [addr, "latest"],
      }),
    );
    assert.equal(
      before.balance - afterBalance,
      receipt.gasUsed * receipt.gasPrice,
    );
    assert.equal(
      BigInt(
        await chain.request({
          method: "eth_getTransactionCount",
          params: [addr, "latest"],
        }),
      ),
      BigInt(before.nonce) + 1n,
    );
    console.log(
      "Local Solidity VM passed: deployer mint permissions, allowance, memory/storage, reverted writes/logs with real nonce and fee accounting.",
    );
  } finally {
    await chain.disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
