/**
 * Day 1 实验：区块链核心概念
 * 本文件是对 lib.js 的纯 JS 版本（去掉 Flow 类型），加上演示和实验
 */

const SHA256 = require("crypto-js/sha256");

// ============================================
// 第一步：定义区块结构
// ============================================
function createBlock(index, txs, prevHash) {
  return {
    index: index,
    txs: txs,            // 交易列表
    hash: "",            // 本区块哈希，挖矿后填入
    prevHash: prevHash,  // 上一个区块的哈希
    nonce: 0             // 挖矿答案
  };
}

// ============================================
// 第二步：创建创世区块（第一块）
// ============================================
const genesisBlock = createBlock(0, [
  { from: "Heaven", to: "Alice", amount: 100 }
], "000000000000000000000000000000000");

// ============================================
// 第三步：哈希函数 — 把区块内容变成"指纹"
// ============================================
function hashBlock(block) {
  const { index, prevHash, txs } = block;
  const txStr = JSON.stringify(txs);
  return SHA256(index + prevHash + txStr).toString();
}

// ============================================
// 第四步：挖矿 — 暴力试 nonce，直到哈希满足条件
// ============================================
function mineBlock(block, difficulty) {
  // difficulty: 要求哈希值前面几个字符是 "0"
  // 例如 difficulty=1 要求第1位是 "0"
  //      difficulty=2 要求前2位是 "00"
  const prefix = "0".repeat(difficulty);

  const blockHash = hashBlock(block);
  const prevHash = block.prevHash;

  let nonce = 0;
  let startTime = Date.now();

  while (true) {
    const proof = SHA256(blockHash + nonce + prevHash).toString();
    if (proof.startsWith(prefix)) {
      const elapsed = Date.now() - startTime;
      return {
        ...block,
        hash: blockHash,
        nonce: nonce,
        proofOfWork: proof,
        miningTime: elapsed
      };
    }
    nonce++;
  }
}

// ============================================
// 第五步：验证区块链 — 检查链是否被篡改
// ============================================
function validateChain(chain) {
  for (let i = 1; i < chain.length; i++) {
    const current = chain[i];
    const previous = chain[i - 1];

    // 检查1：当前区块的 prevHash 是否等于上一个区块的 hash
    if (current.prevHash !== previous.hash) {
      return {
        valid: false,
        error: `区块 ${i} 的 prevHash 不匹配！`,
        block: i
      };
    }

    // 检查2：当前区块的 hash 是否真的是它内容的哈希
    if (current.hash !== hashBlock(current)) {
      return {
        valid: false,
        error: `区块 ${i} 的 hash 被篡改！`,
        block: i
      };
    }
  }
  return { valid: true };
}

// ============================================
// 实验 0：搭建一条区块链
// ============================================
console.log("=".repeat(60));
console.log("实验 0：搭建一条区块链");
console.log("=".repeat(60));

// 挖创世区块
const block0 = mineBlock(genesisBlock, 1);
console.log("\n创世区块 (Block 0):");
console.log(`  哈希: ${block0.hash}`);
console.log(`  nonce: ${block0.nonce}`);
console.log(`  挖矿耗时: ${block0.miningTime}ms`);
console.log(`  交易: Heaven -> Alice, 100 币`);

// 创建区块1：Alice 转给 Bob 50 币
const block1 = createBlock(1, [
  { from: "Alice", to: "Bob", amount: 50 },
  { from: "Alice", to: "Charlie", amount: 30 }
], block0.hash);

const minedBlock1 = mineBlock(block1, 1);
console.log(`\n区块 1:`);
console.log(`  哈希: ${minedBlock1.hash}`);
console.log(`  prevHash: ${minedBlock1.prevHash}`);
console.log(`  nonce: ${minedBlock1.nonce}`);
console.log(`  挖矿耗时: ${minedBlock1.miningTime}ms`);
console.log(`  交易: Alice -> Bob 50, Alice -> Charlie 30`);

// 创建区块2：Bob 转给 Charlie 20 币
const block2 = createBlock(2, [
  { from: "Bob", to: "Charlie", amount: 20 }
], minedBlock1.hash);

const minedBlock2 = mineBlock(block2, 1);
console.log(`\n区块 2:`);
console.log(`  哈希: ${minedBlock2.hash}`);
console.log(`  prevHash: ${minedBlock2.prevHash}`);
console.log(`  nonce: ${minedBlock2.nonce}`);
console.log(`  挖矿耗时: ${minedBlock2.miningTime}ms`);

const chain = [block0, minedBlock1, minedBlock2];

// 验证链
const result = validateChain(chain);
console.log(`\n链验证结果: ${result.valid ? "✅ 有效" : "❌ " + result.error}`);

// 打印完整链
console.log("\n完整区块链:");
console.log("-".repeat(60));
chain.forEach((block, i) => {
  console.log(`区块 ${block.index}:`);
  console.log(`  hash: ${block.hash.substring(0, 20)}...`);
  console.log(`  prevHash: ${block.prevHash.substring(0, 20)}...`);
  console.log(`  nonce: ${block.nonce}, 交易数: ${block.txs.length}`);
  console.log(`  ↓`);
});

// ============================================
// 实验 1：改 PoW 难度，观察挖矿时间
// ============================================
console.log("\n" + "=".repeat(60));
console.log("实验 1：不同 PoW 难度下挖矿时间对比");
console.log("=".repeat(60));

const testBlock = createBlock(99, [
  { from: "Test", to: "Test2", amount: 1 }
], "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");

console.log("\n难度 | 要求前缀 | 挖矿时间 | nonce 值");
console.log("-".repeat(50));

for (let difficulty = 1; difficulty <= 4; difficulty++) {
  const mined = mineBlock(testBlock, difficulty);
  console.log(
    `  ${difficulty}   | ${"0".repeat(difficulty).padEnd(9)}` +
    `| ${mined.miningTime.toString().padEnd(8)}ms` +
    `| ${mined.nonce}`
  );
}

// ============================================
// 实验 2：篡改交易数据，看链如何断裂
// ============================================
console.log("\n" + "=".repeat(60));
console.log("实验 2：篡改交易数据");
console.log("=".repeat(60));

// 把链拷贝一份，然后篡改
const hackedChain = chain.map(b => ({ ...b, txs: [...b.txs] }));

// 把区块1里的交易改了：Alice 本来转了 50，改成 10000
console.log("\n原始交易 (区块1):", JSON.stringify(chain[1].txs));
console.log("篡改后交易 (区块1): Alice -> Bob 10000 币");

hackedChain[1].txs[0] = { from: "Alice", to: "Bob", amount: 10000 };

const hackedResult = validateChain(hackedChain);
console.log(`\n篡改后链验证结果: ${hackedResult.valid ? "✅ 有效" : "❌ " + hackedResult.error}`);
console.log("原因: 改了交易数据 → 区块1的 hash 变了 → 区块2的 prevHash 对不上了");

// 如果攻击者想掩盖，需要重新挖区块1和区块2
console.log("\n如果攻击者想掩盖篡改，需要:");
console.log("  1. 重新挖区块1 (找到新的 nonce)");
console.log("  2. 重新挖区块2 (因为 prevHash 变了)");
console.log("  3. 一直挖到最新区块...");
console.log("  → 在真实比特币中，这需要超过全网 50% 的算力，几乎不可能");

console.log("\n" + "=".repeat(60));
console.log("Day 1 实验完成！");
console.log("=".repeat(60));