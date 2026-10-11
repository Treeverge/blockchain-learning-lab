# Day 4: 以太坊 & 智能合约

## 目录

| 文件 | 内容 | 你做什么 |
|------|------|----------|
| `01-utxo-vs-account.py` | UTXO vs 账户模型对比 | `python 01-utxo-vs-account.py` 跑一遍 |
| `02-my-token.sol` | ERC-20 代币合约完整代码 | 复制到 Remix IDE 部署 |
| `03-storage-demo.sol` | 存储 vs 内存 vs 调用数据 | 在 Remix 里交互测试 |

## Remix IDE 使用步骤

1. 打开 https://remix.ethereum.org
2. 左侧 File Explorer → 新建文件 `MyToken.sol`
3. 粘贴 `02-my-token.sol` 的内容
4. 左侧 Solidity Compiler (绿色 S 图标) → 编译 (Ctrl+S)
5. 左侧 Deploy & Run (以太坊图标) → Environment 选 "Remix VM (Shanghai)"
6. 点 Deploy 部署
7. 在 Deployed Contracts 里交互: mint, transfer, balanceOf
