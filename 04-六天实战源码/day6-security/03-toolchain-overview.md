# Day 6 - 工具链 & 部署概览

## 一、开发工具链演进

```
Remix (浏览器IDE)     →  学习用, 前几天你一直在用
  ↓
Hardhat (JS/TS)       →  业界主流, 配合 npm 生态
  ↓
Foundry (Rust/Solidity)→  新锐, 测试直接用 Solidity 写, 更快
```

Hardhat 能做什么（C++ 类比）：
- `npx hardhat compile` -> 编译 Solidity（像 g++）
- `npx hardhat test` -> 跑测试（像 Google Test）
- `npx hardhat node` -> 启动本地链（像本地启动一个数据库）
- `npx hardhat deploy` -> 部署脚本（像 CI/CD pipeline）

## 二、测试网部署

真实链上部署要花真钱（Gas = ETH = $）。所以先用测试网，免费领测试币。

流程：
1. 在 MetaMask（浏览器钱包插件）添加 Sepolia 测试网
2. 去 faucet（水龙头）网站领取测试 ETH（免费）
3. 用 Hardhat 或 Remix 部署合约到 Sepolia
4. 在 Etherscan（区块浏览器）上查看你的合约

## 三、常见漏洞清单

| 漏洞 | 原理 | 防护 |
|------|------|------|
| 重入攻击 | 转账触发回调，趁账本没改反复提款 | Checks-Effects-Interactions |
| 整数溢出 | 数值超过 uint256 上限绕回 | Solidity 0.8+ 自动检查 |
| 权限漏洞 | 关键函数没做权限检查 | require(msg.sender == owner) |
| 前跑/MEV | 矿工看到你的交易后抢先执行 | 用 Flashbots/私有交易池 |
| 预言机操纵 | 闪电贷操纵价格源 | 用时间加权平均价(TWAP) |

## 四、架构全景图

```
Layer 1 (以太坊主网)
  ├── ERC-20 代币 (USDT, USDC, UNI...)
  ├── DeFi 协议 (Uniswap, Aave, MakerDAO...)
  ├── 预言机 (Chainlink - 给合约喂外部数据)
  └── Layer 2 (扩容方案)
        ├── Rollup (Arbitrum, Optimism - 把计算移到链下)
        └── 更低 Gas, 更快速度
```

## 五、六天学习回顾

| 天 | 主题 | 核心收获 |
|----|------|---------|
| 1 | 区块链基础 | 区块=数据结构, 哈希=指纹, PoW=挖矿 |
| 2 | 交易/共识 | 交易池, P2P 网络, 最长链共识 |
| 3 | 签名/UTXO | 私钥签名, 公钥验证, UTXO 模型, 脚本引擎 |
| 4 | 智能合约 | 账户模型, ERC-20, Gas, Solidity |
| 5 | DeFi | AMM(x*y=k), 借贷, 清算, 闪电贷 |
| 6 | 安全 | 重入攻击, Checks-Effects-Interactions, 工具链 |
