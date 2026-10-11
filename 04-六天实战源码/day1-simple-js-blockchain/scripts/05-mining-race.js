/**
 * 模拟：多矿工竞争挖矿，有人先找到后其他人怎么办
 */
const SHA256 = require("crypto-js/sha256");

function mine(blockHash, startNonce, difficulty) {
  const prefix = "0".repeat(difficulty);
  let nonce = startNonce;
  while (true) {
    const hash = SHA256(blockHash + nonce).toString();
    if (hash.startsWith(prefix)) return { nonce, hash };
    nonce++;
  }
}

// 用同一个区块，三个矿工同时开始挖
const blockHash = "block100";
const DIFFICULTY = 2; // 要求前 2 位是 0

console.log("=== 三个矿工同时开始挖区块 #100 ===\n");
console.log("难度：要求哈希前 2 位是 00\n");

// 矿工 A 从 0 开始，B 从 1000 开始，C 从 2000 开始
// （真实情况是各自从 0 开始，但 nonce 空间很大，实际不会撞）
const start = Date.now();
const resultA = mine(blockHash, 0, DIFFICULTY);
const timeA = Date.now() - start;

const startB = Date.now();
const resultB = mine(blockHash, 1000, DIFFICULTY);
const timeB = Date.now() - startB;

const startC = Date.now();
const resultC = mine(blockHash, 2000, DIFFICULTY);
const timeC = Date.now() - startC;

console.log("结果：");
console.log(`  矿工 A: nonce=${resultA.nonce}, 耗时 ${timeA}ms`);
console.log(`  矿工 B: nonce=${resultB.nonce}, 耗时 ${timeB}ms`);
console.log(`  矿工 C: nonce=${resultC.nonce}, 耗时 ${timeC}ms`);

const winner = [
  { name: "A", time: timeA },
  { name: "B", time: timeB },
  { name: "C", time: timeC },
].sort((a, b) => a.time - b.time)[0];

console.log(`\n>>> 矿工 ${winner.name} 赢了！`);
console.log(`>>> 矿工 ${winner.name} 广播区块 #100，全网接收`);
console.log(`>>> 其他人立刻停止，之前算的全白费了`);
console.log(`>>> 所有人立刻开始抢区块 #101\n`);

// 现在所有矿工开始挖区块 #101
const block101Hash = resultA.hash; // 新区块的 prevHash = 区块 #100 的 hash
console.log("=== 所有人开始抢区块 #101 ===\n");
console.log(`区块 #101 的 prevHash = ${block101Hash.substring(0, 20)}...\n`);

const startD = Date.now();
const resultD = mine(block101Hash, 0, DIFFICULTY);
console.log(`有人挖到了！nonce=${resultD.nonce}, 耗时 ${Date.now() - startD}ms`);
console.log(`\n>>> 广播区块 #101，循环继续...`);
console.log(`>>> 这就是比特币每 10 分钟出一个块的节奏`);