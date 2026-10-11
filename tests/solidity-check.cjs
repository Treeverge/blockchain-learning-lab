// Optional developer verification: solc 0.8.20, ethers 6, ganache 7.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const solc = require("solc");
const { ethers } = require("ethers");
const ganache = require("ganache");

(async () => {
  const sourcePath =
    process.env.CONTRACT_SOURCE_OVERRIDE ||
    path.join(__dirname, "../04-六天实战源码/day5-defi/02-simple-dex.sol");
  const source = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
  const result = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: { "SimpleDEX.sol": { content: source } },
        settings: {
          optimizer: { enabled: true, runs: 200 },
          outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
        },
      }),
    ),
  );
  const errors = (result.errors || []).filter((e) => e.severity === "error");
  assert.deepEqual(
    errors,
    [],
    errors.map((e) => e.formattedMessage).join("\n"),
  );
  const built = result.contracts["SimpleDEX.sol"].SimpleDEX;
  const chain = ganache.provider({
    logging: { quiet: true },
    wallet: { deterministic: true },
  });
  try {
    const provider = new ethers.BrowserProvider(chain);
    provider.pollingInterval = 100;
    const alice = await provider.getSigner(0);
    const bob = await provider.getSigner(1);
    const dex = await new ethers.ContractFactory(
      built.abi,
      built.evm.bytecode.object,
      alice,
    ).deploy();
    await dex.waitForDeployment();
    const sent = async (promise) => (await promise).wait();
    await sent(dex.faucetA(10000000000n));
    await sent(dex.faucetB(10000000000n));
    await sent(dex.addLiquidity(1000000000n, 1000000000n));
    const walletBefore = await dex.balanceA(await alice.getAddress());
    const swapInputs = built.abi.find((f) => f.name === "swapAtoB").inputs
      .length;
    await sent(
      swapInputs === 1 ? dex.swapAtoB(100000000n) : dex.swapAtoB(100000000n, 0),
    );
    assert.equal(
      await dex.reserveA(),
      1100000000n,
      "full input must stay in pool, including fee",
    );
    assert.equal(
      await dex.balanceA(await alice.getAddress()),
      walletBefore - 100000000n,
    );
    assert.equal(await dex.reserveB(), 909338911n);
    console.log(
      "Solidity regression passed: fee retention and exact swap output.",
    );
    for (const v of require("./amm-vectors.json"))
      assert.equal(
        (await dex.quoteOutput(v.x, v.y, v.input, v.feeBps)).toString(),
        v.output,
      );
    const snapshot = [
      await dex.reserveA(),
      await dex.reserveB(),
      await dex.balanceA(await alice.getAddress()),
    ];
    await assert.rejects(dex.swapAtoB.staticCall(100000000n, 100000000n));
    assert.deepEqual(
      [
        await dex.reserveA(),
        await dex.reserveB(),
        await dex.balanceA(await alice.getAddress()),
      ],
      snapshot,
    );
    const second = dex.connect(bob);
    await sent(second.faucetA(1000000000n));
    await sent(second.faucetB(1000000000n));
    await assert.rejects(second.addLiquidity.staticCall(100000000n, 1n));
    const shares = await dex.lpShares(await alice.getAddress());
    const oldA = await dex.balanceA(await alice.getAddress());
    await sent(dex.removeLiquidity(shares / 2n));
    assert.ok((await dex.balanceA(await alice.getAddress())) > oldA);
    assert.equal(
      (await dex.balanceA(await alice.getAddress())) +
        (await dex.balanceA(await bob.getAddress())) +
        (await dex.reserveA()),
      await dex.mintedA(),
    );
    assert.equal(
      (await dex.balanceB(await alice.getAddress())) +
        (await dex.balanceB(await bob.getAddress())) +
        (await dex.reserveB()),
      await dex.mintedB(),
    );
    assert.ok((await dex.lpShares(ethers.ZeroAddress)) > 0n);
    console.log(
      "Solidity QA passed: compiler 0.8.20, shared vectors, minimum output rejection, LP ratio, withdrawal and asset conservation.",
    );
  } finally {
    await chain.disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
