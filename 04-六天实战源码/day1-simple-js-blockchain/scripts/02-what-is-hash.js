/**
 * 哈希是什么？—— 交互式演示
 */
const SHA256 = require("crypto-js/sha256");

console.log("=".repeat(60));
console.log("哈希（Hash）是什么？");
console.log("=".repeat(60));

console.log(`
一句话：哈希 = 把任意内容"压缩"成一个固定长度的乱码（指纹）。

就像你的指纹一样：
  - 你是独一无二的 → 你的指纹独一无二
  - 哪怕你和你双胞胎兄弟只差一点点 → 指纹完全不同
  - 给你一个指纹 → 你没法反推出这个人的长相
\n`);

// ==========================================
// 特性 1：固定长度，无论输入多长
// ==========================================
console.log("特性 1：固定长度输出");
console.log("-".repeat(40));

const short = SHA256("hi").toString();
const long = SHA256("这是一段非常非常非常非常非常非常非常非常非常长的文字" +
  "这是一段非常非常非常非常非常非常非常非常非常长的文字" +
  "这是一段非常非常非常非常非常非常非常非常非常长的文字").toString();

console.log(`输入 "hi" (2 个字符) → ${short}`);
console.log(`    长度: ${short.length} 个字符`);
console.log(`\n输入 一段很长的文字 (150 个字符) → ${long}`);
console.log(`    长度: ${long.length} 个字符`);
console.log(`\n无论输入多长，输出永远是 64 个字符！`);

// ==========================================
// 特性 2：输入差一点点，输出天差地别
// ==========================================
console.log("\n特性 2：输入差一点，输出全变了（雪崩效应）");
console.log("-".repeat(40));

const h1 = SHA256("blockchain").toString();
const h2 = SHA256("Blockchain").toString();  // 只改了大写 B
const h3 = SHA256("blockchaiN").toString();  // 只改了最后的 n

console.log(`SHA256("blockchain")  = ${h1.substring(0, 32)}...`);
console.log(`SHA256("Blockchain")  = ${h2.substring(0, 32)}...`);
console.log(`SHA256("blockchaiN")  = ${h3.substring(0, 32)}...`);

// 数一下有多少位不同
let diff = 0;
for (let i = 0; i < h1.length; i++) {
  if (h1[i] !== h2[i]) diff++;
}
console.log(`\n只改了一个字母的大小写 → 64 位中有 ${diff} 位完全不同！`);

// ==========================================
// 特性 3：不可逆
// ==========================================
console.log("\n特性 3：不可逆（单向函数）");
console.log("-".repeat(40));
console.log(`
给你一个哈希值:  ${h1.substring(0, 16)}...
你能反推出我输入的是什么吗？

不能。因为：
  - 无数种输入可能产生同一个哈希（虽然概率极低）
  - 没有数学公式可以倒推
  - 只能暴力猜：把每个可能的输入都试一遍

这就是为什么矿工只能"暴力试 nonce"，不能直接算出来。
`);

// ==========================================
// 特性 4：确定性
// ==========================================
console.log("特性 4：确定性（同样输入，永远同样输出）");
console.log("-".repeat(40));

const h4a = SHA256("hello").toString();
const h4b = SHA256("hello").toString();
const h4c = SHA256("hello").toString();

console.log(`第 1 次算 SHA256("hello") = ${h4a.substring(0, 32)}...`);
console.log(`第 2 次算 SHA256("hello") = ${h4b.substring(0, 32)}...`);
console.log(`第 3 次算 SHA256("hello") = ${h4c.substring(0, 32)}...`);
console.log(`\n算 100 次也是同一个结果，这叫做"确定性"。`);
console.log(`所以你可以用哈希来验证数据有没有被改过。`);

// ==========================================
// 总结
// ==========================================
console.log("\n" + "=".repeat(60));
console.log("哈希在区块链里的作用");
console.log("=".repeat(60));
console.log(`
1. 区块指纹：SHA256(区块内容) → 每个区块的身份证
2. 链式连接：prevHash 存上一个区块的指纹 → 改一改全链断
3. 工作量证明：SHA256(内容 + nonce) 必须以前 N 位是 0 → 挖矿就是找 nonce
4. 交易 ID：SHA256(交易内容) → 每笔交易的唯一编号

一句话：哈希 = 区块链的"胶水"，把所有东西粘在一起。
`);