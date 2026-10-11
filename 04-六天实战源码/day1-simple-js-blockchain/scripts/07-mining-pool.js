/**
 * 模拟：算力巨头 vs 散户矿工
 * 看看谁挖到的块多
 */
const SHA256 = require("crypto-js/sha256");

function mineOnce(blockData, difficulty) {
  const prefix = "0".repeat(difficulty);
  let nonce = 0;
  while (true) {
    const hash = SHA256(blockData + nonce).toString();
    if (hash.startsWith(prefix)) return nonce;
    nonce++;
  }
}

// 模拟 100 个区块的竞争
const TOTAL_BLOCKS = 100;

// 场景：1 个巨头占 30% 算力，1000 个小矿工各占 0.07%
const GIANT_POWER = 0.30;
const SMALL_COUNT = 1000;
const SMALL_POWER_EACH = (1 - GIANT_POWER) / SMALL_COUNT;

// 每个区块：按算力比例随机选赢家
console.log("场景：1 个巨头（30% 算力）vs 1000 个散户（各 0.07%）\n");

let giantWins = 0;
let smallWins = 0;

for (let block = 1; block <= TOTAL_BLOCKS; block++) {
  const roll = Math.random();
  if (roll < GIANT_POWER) {
    giantWins++;
  } else {
    smallWins++;
  }
}

console.log(`挖 ${TOTAL_BLOCKS} 个区块的结果：`);
console.log(`  巨头赢了: ${giantWins} 次 (${(giantWins/TOTAL_BLOCKS*100).toFixed(1)}%)`);
console.log(`  散户赢了: ${smallWins} 次 (${(smallWins/TOTAL_BLOCKS*100).toFixed(1)}%)`);
console.log(`  平均每个散户赢: ${(smallWins/SMALL_COUNT).toFixed(1)} 次`);
console.log(`  散户赢 0 次的人数: 约 ${Math.round(SMALL_COUNT * Math.pow(1 - SMALL_POWER_EACH, TOTAL_BLOCKS))} 人`);

// 矿池模拟
console.log("\n" + "=".repeat(50));
console.log("解决方案：矿池");
console.log("=".repeat(50));

console.log(`
散户一个人挖矿：
  算力 0.07%，挖 100 个块，平均只能赢 0.07 次。
  → 可能 100 个块过去，你颗粒无收。
  → 电费白交了。

散户加入矿池（1000 人凑一起）：
  算力 70%，挖 100 个块，平均赢 70 次。
  → 每次赢 50 个比特币，池子按算力分给 1000 人。
  → 你虽然只分到 0.035 个比特币，但每个块都有稳定收入。
  → 电费能回本。

这就是为什么现在没人自己挖比特币——都加矿池。
`);

// 矿池模拟
console.log("=== 矿池模拟：1000 个散户加入矿池 ===\n");
let poolWins = 0;
for (let block = 1; block <= TOTAL_BLOCKS; block++) {
  if (Math.random() < (1 - GIANT_POWER)) poolWins++;
}
console.log(`矿池（1000 散户）赢了 ${poolWins} 个块`);
console.log(`每个散户分到 ${(poolWins / SMALL_COUNT).toFixed(2)} 个块的奖励`);
console.log(`巨头自己赢了 ${giantWins} 个块`);

console.log("\n结论：");
console.log("1. 单干 → 一年可能颗粒无收（概率极低）");
console.log("2. 加入矿池 → 每个块都有稳定分红（虽然少但稳定）");
console.log("3. 巨头再大，矿池可以联合对抗，维护去中心化");