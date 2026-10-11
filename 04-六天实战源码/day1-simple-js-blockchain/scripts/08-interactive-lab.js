/**
 * 区块链实验室 —— 交互式小实验
 * 你可以一步步操作，亲眼看到链的变化
 */
const SHA256 = require("crypto-js/sha256");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => rl.question(question, resolve));
}

// ============== 区块链核心 ==============
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

// ============== 区块链状态 ==============
let chain = [];
let DIFFICULTY = 1;

function showChain() {
  console.log("\n" + "█".repeat(50));
  console.log("📦 当前区块链");
  console.log("█".repeat(50));
  if (chain.length === 0) {
    console.log("  (链是空的，还没有区块)");
    return;
  }
  chain.forEach((block, i) => {
    console.log(`\n  区块 #${block.index}`);
    console.log(`  ├─ hash:     ${block.hash.substring(0, 20)}...`);
    console.log(`  ├─ prevHash: ${block.prevHash.substring(0, 20)}...`);
    console.log(`  ├─ nonce:    ${block.nonce}`);
    console.log(`  └─ 交易:     ${JSON.stringify(block.txs)}`);
    if (i < chain.length - 1) {
      console.log(`  │`);
      console.log(`  ↓`);
    }
  });
  console.log("\n  验证: " + (validateChain(chain).valid ? "✅ 链完整" : "❌ 链断裂!"));
}

function validateChain(chain) {
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i - 1].hash) return { valid: false, error: "prevHash 不匹配" };
    if (chain[i].hash !== hashBlock(chain[i])) return { valid: false, error: "hash 被篡改" };
  }
  return { valid: true };
}

async function main() {
  console.log("\n🔬 区块链实验室");
  console.log("=".repeat(50));
  console.log("你可以：挖矿 | 篡改 | 难度 | 查看 | 退出");
  console.log("=".repeat(50));

  while (true) {
    const cmd = (await ask("\n👉 输入命令: ")).trim().toLowerCase();

    if (cmd === "退出") {
      console.log("实验结束！");
      break;
    }

    if (cmd === "查看") {
      showChain();
      continue;
    }

    if (cmd.startsWith("难度")) {
      const n = parseInt(cmd.split(" ")[1]) || 1;
      DIFFICULTY = Math.max(1, Math.min(5, n));
      console.log(`✅ 难度设为 ${DIFFICULTY}（要求哈希前 ${DIFFICULTY} 位是 0）`);
      continue;
    }

    if (cmd === "挖矿") {
      const prevHash = chain.length > 0
        ? chain[chain.length - 1].hash
        : "0000000000000000000000000000000000000000000000000000000000000000";

      const index = chain.length;

      // 让用户输入交易
      const from = await ask("  付款人: ");
      const to = await ask("  收款人: ");
      const amount = parseInt(await ask("  金额: "));

      const block = {
        index,
        prevHash,
        txs: [{ from, to, amount }],
        nonce: 0,
        hash: ""
      };

      console.log(`\n  ⛏️ 开始挖矿（难度 ${DIFFICULTY}）...`);
      const mined = mineBlock(block, DIFFICULTY);
      console.log(`  ✅ 挖到了！nonce=${mined.nonce}, 耗时 ${mined.miningTime}ms`);
      chain.push(mined);
      showChain();
      continue;
    }

    if (cmd === "篡改") {
      if (chain.length === 0) {
        console.log("链是空的，先挖几个块再来篡改吧");
        continue;
      }
      showChain();
      const blockIdx = parseInt(await ask("  要篡改第几号区块? "));
      if (blockIdx < 0 || blockIdx >= chain.length) {
        console.log("没有这个区块");
        continue;
      }
      const newAmount = parseInt(await ask("  改成多少金额? "));

      // 篡改
      const hacked = chain.map(b => {
        const copy = { ...b, txs: b.txs.map(t => ({ ...t })) };
        if (copy.index === blockIdx) {
          copy.txs[0].amount = newAmount;
        }
        return copy;
      });

      const result = validateChain(hacked);
      console.log(`\n  ${result.valid ? "✅ 链还是完整的" : "❌ " + result.error}`);
      if (!result.valid) {
        console.log("\n  💡 想掩盖篡改？需要重新挖从篡改位置开始的所有区块。");
        const redo = await ask("  要试试重新挖吗？(y/n) ");
        if (redo === "y") {
          console.log("  ⛏️ 重新挖被篡改的区块...");
          for (let i = blockIdx; i < hacked.length; i++) {
            const prevHash = i > 0 ? hacked[i - 1].hash : "0000000000000000000000000000000000000000000000000000000000000000";
            hacked[i].prevHash = prevHash;
            console.log(`  ⛏️ 重挖区块 #${i}...`);
            const reMined = mineBlock(hacked[i], DIFFICULTY);
            hacked[i] = reMined;
            console.log(`     ✅ nonce=${reMined.nonce}, 耗时 ${reMined.miningTime}ms`);
          }
          console.log(`\n  🔄 篡改后的链替换了原链！`);
          chain = hacked;
          console.log("  💡 在真实比特币中，你需要比全网其他人更快地挖完所有后续区块");
          console.log("     这几乎不可能——这就是区块链不可篡改的原因。");
          showChain();
        }
      }
      continue;
    }

    console.log("命令: 挖矿 | 篡改 | 难度 <1-5> | 查看 | 退出");
  }

  rl.close();
}

main();