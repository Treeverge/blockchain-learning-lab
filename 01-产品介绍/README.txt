《区块链：从技术到信任》数字资料包 · 使用说明（README）
================================================================

欢迎使用！本资料包是一套「讲稿 + 演示 + 交互 Demo + 六天源码」四位一体的
区块链技术分享与学习套装。全部内容均为本地文件，双击即用，无需联网
（演示文稿字体加载除外）。

一、目录结构
----------------------------------------------------------------
blockchain-digital-pack/
├── 产品介绍.html                  ★ 从这里开始 —— 资料包产品主页
├── 01-产品介绍/                   产品资料（商品卖点与使用说明）
│   ├── 产品介绍与上架文案.txt      商品卖点、内容清单、学习路径（上架可直接引用）
│   └── README.txt                 本文件：目录结构、快速开始、各天使用说明
├── 02-演讲稿/
│   ├── 演讲稿（对外版）.docx       40 分钟逐页口播稿（Word 版，彩色语义区分：
│   │                              红=翻页/停留动作，紫=切换 Demo/返回动作，
│   │                              绿=Step 步骤标题，深蓝=章节标题，
│   │                              深金=台词强调词，黑=要说的话）
│   ├── 演讲稿（对外版）.md         讲稿 Markdown 源文件（可自行编辑）
│   └── 演讲稿（对外版）.html       讲稿网页版（浏览器直接阅读）
├── 03-演示文稿/                   演示 + 三个可交互 Demo + 案例图（同目录互为相对链接）
│   ├── blockchain-presentation.html  主演示文稿（14 个 Section）
│   ├── demo-signature.html        ① 数字签名
│   ├── demo-chain.html            ② 共识机制（PBFT）
│   ├── demo-trace.html            ③ 供应链溯源
│   └── picture/                   演示用案例图（bitcoin / walmart / maersk / debeers）
├── 04-六天实战源码/               六天手写代码（每个 day 的详细用法见下方第三部分）
│   ├── day1-js-blockchain/        JS 手写区块链
│   ├── day2-python-blockchain/    Python 区块链（含 C#/JS 多语言版）
│   ├── day3-signatures-utxo/      签名 + UTXO + 脚本引擎
│   ├── day4-smart-contracts/      以太坊智能合约
│   ├── day5-defi/                 DeFi：AMM / DEX / 借贷
│   └── day6-security/             重入攻击与防御、工具链
└── assets/picture/                商品展示素材（与 03-演示文稿/picture 内容一致）

二、快速开始
----------------------------------------------------------------
1. 看产品主页：双击「产品介绍.html」，所有内容一目了然，点击卡片直达。
2. 做分享：打开 03-演示文稿/blockchain-presentation.html 全屏放映，
   配合 02-演讲稿 逐页讲；讲到 Demo 章节时点击页面内的 Demo 按钮跳转。
3. 动手学：进入 04-六天实战源码，按 Day1 → Day6 顺序跑代码，用法见第三部分。

三、六天实战 · 每个 day 怎么用
----------------------------------------------------------------

【Day 1 · JS 手写区块链】 day1-simple-js-blockchain/
  环境：Node.js（含 npm）
  步骤：
    1) cd 到 day1 目录
    2) npm install          安装依赖（crypto-js / babel / jest）
    3) npm run build        将源码编译到 lib/ 目录（去掉 Flow 类型）
    4) 按编号顺序运行 9 个实验脚本：
       node scripts/01-build-chain.js     构建一条最简单的区块链
       node scripts/02-what-is-hash.js    哈希是什么、有什么用
       node scripts/03-blockhash-factors.js  哪些因素影响区块哈希
       node scripts/04-miners-different.js   不同矿工挖出的哈希不同
       node scripts/05-mining-race.js        模拟挖矿竞赛
       node scripts/06-luck-factor.js        难度与运气因素
       node scripts/07-mining-pool.js        矿池如何分配算力
       node scripts/08-interactive-lab.js    交互式实验（推荐体验）
       node scripts/09-lab-auto-demo.js      全流程自动演示
    5) npm test              运行单元测试（jest）
  说明：01–04 打基础，05–07 理解挖矿与共识，08–09 综合演示。

【Day 2 · Python 区块链（多语言版）】 day2-python-blockchain/
  环境：Python 3.8+（含 pip）
  步骤：
    1) cd 到 day2 目录
    2) pip install -r requirements.txt   安装依赖（flask / requests 等）
    3) python blockchain.py   启动一条完整区块链（自带 REST API）
       - 可开多个终端实例，彼此注册节点，体验共识、挖矿、分叉
    4) 4 个专项实验脚本：
       python scripts/01-basic-experiment.py     基础实验：区块/交易/挖矿
       python scripts/02-consensus-experiment.py 共识实验：最长链规则
       python scripts/03-fork-experiment.py      分叉实验：双花与分叉收敛
       python scripts/04-mempool-demo.py         内存池演示
    5) 测试：python -m pytest tests/（或 pytest）
  其他语言版本（同一套链逻辑）：
    - C# 版：用 Visual Studio 打开 BlockChain.sln 运行
    - JS 版：cd js && npm install && node index.js
    - 容器化：目录内提供 Dockerfile，可 docker build 一键起环境

【Day 3 · 签名 + UTXO + 脚本引擎】 day3-signatures-utxo/
  环境：Python 3.8+；先安装依赖：pip install ecdsa
  运行（建议按顺序，脚本间无依赖可单独跑）：
    python 01-keys-and-signatures.py   密钥对生成与数字签名/验签
    python 01b-mini-demo.py            签名迷你演示
    python 02-utxo-model.py            UTXO 交易模型（类比比特币）
    python 03-script-engine.py         脚本引擎：验证签名脚本
  产出：理解"私钥签名、公钥验证、UTXO 记账"三大底层机制。

【Day 4 · 以太坊与智能合约】 day4-smart-contracts/
  环境：Python 3.8+；Solidity 用在线 Remix IDE（无需本地安装）
  运行：
    1) python 01-utxo-vs-account.py   UTXO 与账户模型对比（本地直接跑）
    2) 打开 https://remix.ethereum.org（浏览器在线 IDE）
    3) 新建文件，把 02-my-token.sol（ERC-20 代币合约）粘贴进去
    4) 编译（Compile）→ 部署（Deploy 到虚拟测试网）→ 调用 mint/transfer 等函数
    5) 用同样方式部署 03-storage-demo.sol，测试 storage/memory/calldata
       三种数据位置的 gas 消耗差异
  产出：亲手发行一个 ERC-20 代币并理解合约存储模型。

【Day 5 · DeFi 去中心化金融】 day5-defi/
  环境：Python 3.8+；Solidity 用 Remix IDE
  运行：
    1) python 01-amm-demo.py       AMM 自动做市商原理（x*y=k，含滑点演示）
    2) python 03-lending-demo.py   借贷 + 清算 + 闪电贷模拟
    3) 把 02-simple-dex.sol 复制到 Remix 部署，体验链上 DEX 交易
  产出：搞懂 AMM、DEX、借贷清算与闪电贷的机制。

【Day 6 · 工程实践与安全】 day6-security/
  环境：Python 3.8+；Solidity 用 Remix IDE
  运行：
    1) python 01-reentrancy-attack.py   完整模拟重入攻击（含资金流失过程）
    2) 打开 02-reentrancy-sol.sol：文件内含【有漏洞版】与【修复版】两个合约，
       分别部署到 Remix 对比攻击效果，理解 checks-effects-interactions 修复法
    3) 阅读 03-toolchain-overview.md    工具链/测试网/部署流程概览
  产出：掌握智能合约最常见的重入攻击与防御。

四、学习路径
----------------------------------------------------------------
- 3 小时快速通道（认知 + 分享）：演示文稿 → 三个 Demo → 讲稿
- 6 天实战通道（动手）：按 Day1 → Day6 顺序，每天 1–2 小时跑完代码

五、版权说明
----------------------------------------------------------------
Day 3–Day 6 为原创内容；Day 1/Day 2 基于 MIT 协议开源项目，各目录内已保留
原始 LICENSE 与来源链接，允许自由使用与再分发。企业案例（沃尔玛、马士基、
戴比尔斯等）仅作教学引用。

----------------------------------------------------------------
*有问题可随时联系作者获取支持。*
