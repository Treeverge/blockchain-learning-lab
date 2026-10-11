/**
 * 区块链实验室 —— 自动演示版
 * 模拟用户一步步操作，展示每一步发生了什么
 */
const SHA256 = require("crypto-js/sha256");

function hashBlock(block) {
  const { index, prevHash, txs, nonce } = block;
  const txStr = JSON.stringify(txs);
  return SHA256(index + prevHash + txStr + nonce).toString();
}

function mineBlock(block, difficulty) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  const start = Date.now();
  while (true) {
    const hash = SHA256(
      block.index + block.prevHash + JSON.stringify(block.txs) + nonce
    ).toString();
    if (hash.startsWith(prefix)) {
      return { ...block, nonce, hash, miningTime: Date.now() - start };
    }
    nonce++;
  }
}

function validateChain(chain) {
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) return { valid: false, error: "prevHash 不匹配", block: i };
    if (chain[i].hash !== hashBlock(chain[i])) return { valid: false, error: "hash 被篡改", block: i };
  }
  return { valid: true };
}

function showChain(chain) {
  console.log("\n" + "─".repeat(50));
  chain.forEach((block, i) => {
    console.log(`\n  区块 #${block.index}`);
    console.log(`  ├─ hash:     ${block.hash.substring(0, 16)}...`);
    console.log(`  ├─ prevHash: ${block.prevHash.substring(0, 16)}...`);
    console.log(`  ├─ nonce:    ${block.nonce}`);
    console.log(`  └─ 交易:     ${JSON.stringify(block.txs)}`);
    if (i < chain.length - 1) console.log(`  ↓`);
  });
  const result = validateChain(chain);
  console.log(`\n  验证: ${result.valid ? "✅ 链完整" : "❌ 链断裂! " + result.error}`);
  console.log("─".repeat(50));
}

function sleep(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {}
}

// ============== 开始演示 ==============
let chain = [];
let DIFFICULTY = 1;

console.log("\n╔══════════════════════════════════════╗");
console.log("║      🔬 区块链实验室 — 自动演示     ║");
console.log("╚══════════════════════════════════════╝");

// ===== 步骤 1：挖创世区块 =====
console.log("\n\n【步骤 1】挖创世区块");
console.log("  用户操作: 挖矿 -> Heaven -> Alice -> 100");
console.log("  交易: 从 Heaven（天堂）凭空造 100 币给 Alice");
sleep(500);

const genesis = mineBlock({
  index: 0,
  prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
  txs: [{ from: "Heaven", to: "Alice", amount: 100 }],
  nonce: 0,
  hash: ""
}, DIFFICULTY);
chain.push(genesis);
console.log(`  ✅ 创世区块挖到！nonce=${genesis.nonce}`);
showChain(chain);

// ===== 步骤 2：挖第二个区块 =====
console.log("\n\n【步骤 2】挖第二个区块");
console.log("  用户操作: 挖矿 -> Alice -> Bob -> 50");
console.log("  Alice 转 50 币给 Bob");
sleep(500);

const block1 = mineBlock({
  index: 1,
  prevHash: chain[0].hash,
  txs: [{ from: "Alice", to: "Bob", amount: 50 }],
  nonce: 0,
  hash: ""
}, DIFFICULTY);
chain.push(block1);
console.log(`  ✅ 区块 #1 挖到！nonce=${block1.nonce}`);
showChain(chain);

// ===== 步骤 3：挖第三个区块 =====
console.log("\n\n【步骤 3】挖第三个区块");
console.log("  用户操作: 挖矿 -> Bob -> Charlie -> 20");
console.log("  Bob 转 20 币给 Charlie");
sleep(500);

const block2 = mineBlock({
  index: 2,
  prevHash: chain[1].hash,
  txs: [{ from: "Bob", to: "Charlie", amount: 20 }],
  nonce: 0,
  hash: ""
}, DIFFICULTY);
chain.push(block2);
console.log(`  ✅ 区块 #2 挖到！nonce=${block2.nonce}`);
showChain(chain);

// ===== 步骤 4：篡改实验 =====
console.log("\n\n【步骤 4】篡改攻击！");
console.log("  攻击者悄悄把区块 #1 的交易改了：");
console.log("  原始: Alice -> Bob, 50 币");
console.log("  篡改: Alice -> Bob, 99999 币");
sleep(500);

const hackedChain = chain.map(b => ({
  ...b,
  txs: b.txs.map(t => ({ ...t }))
}));
hackedChain[1].txs[0] = { from: "Alice", to: "Bob", amount: 99999 };

const beforeFix = validateChain(hackedChain);
console.log(`\n  篡改后验证: ${beforeFix.valid ? "✅ 侥幸逃过" : "❌ " + beforeFix.error}`);
console.log(`  原因: 区块 #1 的 hash 变了，区块 #2 的 prevHash 对不上了`);

// ===== 步骤 5：攻击者试图掩盖 =====
console.log("\n\n【步骤 5】攻击者试图掩盖篡改");
console.log("  必须重新挖区块 #1 和区块 #2...");
sleep(500);

for (let i = 1; i < hackedChain.length; i++) {
  const prevHash = hackedChain[i - 1].hash;
  hackedChain[i].prevHash = prevHash;
  console.log(`  ⛏️ 重挖区块 #${i}...`);
  const reMined = mineBlock(hackedChain[i], DIFFICULTY);
  hackedChain[i] = reMined;
  console.log(`     ✅ 挖到！nonce=${reMined.nonce}, 耗时 ${reMined.miningTime}ms`);
}

const afterFix = validateChain(hackedChain);
console.log(`\n  重挖后验证: ${afterFix.valid ? "✅ 链恢复了" : "❌ 仍然断裂"}`);
console.log("  攻击者成功掩盖了篡改！但是...");

// ===== 步骤 6：真相 =====
console.log("\n\n【步骤 6】为什么在真实比特币中这不可能？");
console.log("─".repeat(50));
console.log(`
  1. 刚才我们只重挖了 2 个区块，花了 ${(hackedChain[1].miningTime + hackedChain[2].miningTime)}ms。
     真实比特币中有 80 多万个区块，你需要重挖从篡改点到最新块的全部。

  2. 在你重挖的时候，全网其他矿工还在继续挖新块。
     你的链越来越短，永远追不上。

  3. 要追上的唯一办法：拥有超过全网 51% 的算力。
     这意味着买下全球一半的矿机——成本高达数百亿美元。

  4. 即使你有 51% 算力，大家看到你作恶，比特币价格会暴跌。
     你的矿机瞬间变成废铁。

  结论：篡改区块链 = 理论上可行，经济上自杀。
`);

console.log("╔══════════════════════════════════════╗");
console.log("║      🎉 Day 1 实验全部完成！        ║");
console.log("╚══════════════════════════════════════╝");