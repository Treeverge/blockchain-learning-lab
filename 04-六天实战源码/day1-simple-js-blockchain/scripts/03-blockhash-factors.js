/**
 * 当前区块的哈希由什么决定？
 */
const SHA256 = require("crypto-js/sha256");

function hashBlock(block) {
  const { index, prevHash, txs } = block;
  const txStr = JSON.stringify(txs);
  return SHA256(index + prevHash + txStr).toString();
}

// 基准区块
const base = {
  index: 100,
  prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
  txs: [{ from: "Alice", to: "Bob", amount: 50 }]
};

const baseHash = hashBlock(base);

console.log("当前区块哈希 = SHA256(index + prevHash + 交易列表)\n");
console.log("=".repeat(60));

// 分解演示
console.log(`\n拼起来的内容:`);
console.log(`  index     = ${base.index}`);
console.log(`  prevHash  = ${base.prevHash.substring(0, 10)}...`);
console.log(`  txs       = ${JSON.stringify(base.txs)}`);
console.log(`\n  SHA256(  ${base.index}${base.prevHash.substring(0, 10)}...${JSON.stringify(base.txs)}  )`);
console.log(`  = ${baseHash}`);

// 改 index
console.log("\n" + "=".repeat(60));
console.log("改 index (100 → 101)");
console.log("-".repeat(40));
const changedIndex = { ...base, index: 101 };
const hash1 = hashBlock(changedIndex);
console.log(`原值: ${baseHash.substring(0, 32)}...`);
console.log(`新值: ${hash1.substring(0, 32)}...`);
console.log(`相同? ${baseHash === hash1 ? "一样" : "完全不同!"}`);

// 改 prevHash
console.log("\n改 prevHash (只改一位)");
console.log("-".repeat(40));
const changedPrev = { ...base, prevHash: "1000000000000000000000000000000000000000000000000000000000000000" };
const hash2 = hashBlock(changedPrev);
console.log(`原值: ${baseHash.substring(0, 32)}...`);
console.log(`新值: ${hash2.substring(0, 32)}...`);
console.log(`相同? ${baseHash === hash2 ? "一样" : "完全不同!"}`);

// 改交易
console.log("\n改交易 (金额 50 → 51)");
console.log("-".repeat(40));
const changedTx = { ...base, txs: [{ from: "Alice", to: "Bob", amount: 51 }] };
const hash3 = hashBlock(changedTx);
console.log(`原值: ${baseHash.substring(0, 32)}...`);
console.log(`新值: ${hash3.substring(0, 32)}...`);
console.log(`相同? ${baseHash === hash3 ? "一样" : "完全不同!"}`);

// 改收款地址 (coinbase 地址不同)
console.log("\n改 coinbase 收款地址 (矿工A → 矿工B)");
console.log("-".repeat(40));
const changedAddr = { ...base, txs: [{ from: "Heaven", to: "矿工A", amount: 50 }] };
const changedAddr2 = { ...base, txs: [{ from: "Heaven", to: "矿工B", amount: 50 }] };
const hashA = hashBlock(changedAddr);
const hashB = hashBlock(changedAddr2);
console.log(`矿工A: ${hashA.substring(0, 32)}...`);
console.log(`矿工B: ${hashB.substring(0, 32)}...`);
console.log(`相同? ${hashA === hashB ? "一样" : "完全不同!"}`);

// 总结
console.log("\n" + "=".repeat(60));
console.log("总结：当前区块哈希由 3 个因素决定");
console.log("=".repeat(60));
console.log(`
  1. index    — 第几号区块
  2. prevHash — 上一个区块的哈希
  3. txs      — 这个区块里包含的交易列表

  其中 prevHash 全网一致（因为上一块已经定了）
  但 txs 每个矿工不同（coinbase 收款地址是自己的）
  → 所以 blockHash 每个人都不一样
  → 每个人在挖自己的题
`);