/**
 * 实验：挖矿的运气成分
 * 模拟 1000 次挖矿，看每次需要试多少次 nonce
 */
const SHA256 = require("crypto-js/sha256");

function mineOnce(difficulty) {
  const prefix = "0".repeat(difficulty);
  const randomData = Math.random().toString();
  let nonce = 0;
  while (true) {
    const hash = SHA256(randomData + nonce).toString();
    if (hash.startsWith(prefix)) return nonce;
    nonce++;
  }
}

// 模拟 1000 次挖矿，难度 = 1（要求 1 个 0）
console.log("模拟 1000 次挖矿（难度 1：要求第 1 位是 0）\n");

const results = [];
for (let i = 0; i < 1000; i++) {
  results.push(mineOnce(1));
}

results.sort((a, b) => a - b);

console.log("统计：");
console.log(`  最少次数: ${results[0]} (运气爆棚！)`);
console.log(`  最多次数: ${results[999]} (倒霉蛋)`);
console.log(`  中位数: ${results[500]} (一半人比这个快)`);
console.log(`  平均值: ${Math.round(results.reduce((a, b) => a + b) / 1000)}`);

// 分布
const buckets = { "0-5": 0, "6-10": 0, "11-20": 0, "21-50": 0, "50+": 0 };
results.forEach(n => {
  if (n <= 5) buckets["0-5"]++;
  else if (n <= 10) buckets["6-10"]++;
  else if (n <= 20) buckets["11-20"]++;
  else if (n <= 50) buckets["21-50"]++;
  else buckets["50+"]++;
});

console.log("\n分布：");
for (const [range, count] of Object.entries(buckets)) {
  const bar = "#".repeat(count / 5);
  console.log(`  ${range}次: ${count}人 ${bar}`);
}