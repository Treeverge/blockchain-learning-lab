# Day 1：哈希、区块与工作量证明

先打开 `../../03-演示文稿/chain-lab.html`。五步体验：查看哈希输入 → 修改旧记录 → 重算链接 → 比较节点 → 建立工作量基准、重新挖矿与传播候选历史。

新版网页使用原生 Web Crypto SHA-256 和固定的 JSON 数组 `[index, prevHash, data, nonce]`。创世哈希来自共同锚点，区块顺序、内容哈希、链接和证明分别校验。重算能让一份修改过的文本账本自洽；等累计工作的分叉在本教学规则下保留当前链，更多有效工作才切换。

候选账本没有真实交易签名与余额验证，不能由此推导可以伪造真实转账。三个节点是一个浏览器中的独立快照，不是真实 P2P 网络。难度为 1 至 3 位前导零，异步挖矿可停止，每块最多 100000 次尝试，停止不提交半成品。

在仓库根目录运行新版模型测试（Node.js 18+）：

```powershell
node --test tests/chain.test.cjs
```

新版模型见 `../../assets/js/chain.js`。[逐项规则对照](../../docs/day1-legacy-audit.md)列出了上游 `src/lib.js`、扩展脚本和新版网页各自哈希、挖矿及验链的范围。旧版 `hashBlock` 不含 nonce；其挖矿证明另算，所以旧快照里的区块哈希不一定以 `0` 开头。不要将旧对象与新版验链器混用。

下方保留上游介绍与原运行步骤，供阅读历史实现。旧 Babel / Flow / Jest 依赖及九个扩展脚本尚未在本轮逐一运行验收；学习本章优先使用上面的网页与 Node 内置测试器，无需安装旧依赖。

## 保留的上游项目：Simple JS Blockchain

This is based on a [blog post](https://kndrck.co/building-a-minimal-blockchain-in-haskell.html) written by my good friend [Kendrick Tan](https://github.com/kendricktan).

The original post used Haskell (which I am a fan of), but I am nevertheless most comfortable with Javascript. A lot of blog posts about tiny blockchains in Javascript used ES2015 classes and I wanted to see if we could simply use Flow types instead.

### 上游原始运行步骤（历史参考，未在当前环境验收）

1. Clone the repo.
2. Run `yarn` (or `npm install`) to install dependencies.
3. Build the project (to strip the types) using `yarn build` or `npm run build`.
4. Require the library inside the generated `lib/lib.js`.
