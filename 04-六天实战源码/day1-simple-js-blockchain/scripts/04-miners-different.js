/**
 * 验证：不同矿工挖的区块内容不同
 */
const SHA256 = require("crypto-js/sha256");

function hashBlock(block) {
  const { index, prevHash, txs } = block;
  const txStr = JSON.stringify(txs);
  return SHA256(index + prevHash + txStr).toString();
}

// 两个矿工，挖同一个高度的区块
// 但 coinbase 收款地址不同，选择的交易也不同

const prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

const blockA = {
  index: 100,
  prevHash: prevHash,
  txs: [
    { type: "coinbase", to: "矿工A的地址", amount: 3.125 },
    { from: "Alice", to: "Bob", amount: 0.5 }
  ]
};

const blockB = {
  index: 100,
  prevHash: prevHash,
  txs: [
    { type: "coinbase", to: "矿工B的地址", amount: 3.125 },  // ← 地址不同
    { from: "Alice", to: "Bob", amount: 0.5 }
  ]
};

const hashA = hashBlock(blockA);
const hashB = hashBlock(blockB);

console.log("矿工 A 的区块哈希:");
console.log("  " + hashA);
console.log("\n矿工 B 的区块哈希:");
console.log("  " + hashB);
console.log("\n两个哈希相同吗？ " + (hashA === hashB ? "相同" : "完全不同！"));

// 哪怕只差一个字符，哈希也完全不同
console.log("\n=== 关键结论 ===");
console.log("每个矿工的 coinbase 收款地址不同");
console.log("→ 区块内容不同 → blockHash 不同");
console.log("→ 每个人在算完全不同的 nonce");
console.log("→ 不会出现 '两个人同时找到同一个 nonce' 的情况");
console.log("→ 每个人都是独立竞赛，各算各的");