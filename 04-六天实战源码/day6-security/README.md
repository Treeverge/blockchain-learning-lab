# Day 6: 工程实践 & 安全

## 目录

| 文件 | 内容 | 你做什么 |
|------|------|----------|
| `01-reentrancy-attack.py` | 重入攻击完整模拟 | `python 01-reentrancy-attack.py` |
| `02-reentrancy-sol.sol` | Solidity 有漏洞版 + 修复版 | Remix 部署对比 |
| `03-toolchain-overview.md` | 工具链/测试网/部署 概览 | 阅读了解 |

## 核心概念

**重入攻击**: 合约转账时会触发对方代码，对方可以"趁账本还没改"反复提款
**Checks-Effects-Interactions**: 先检查、先改账、最后才跟外部交互 - 最基本的安全模式
**部署不可改**: 合约上链后无法修改，有 bug 就只能重新部署新的，旧的钱可能永远锁死
