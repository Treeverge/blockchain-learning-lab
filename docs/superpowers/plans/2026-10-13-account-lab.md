# 账户与合约执行实施记录

**Goal:** 将账户顺序、合约业务状态与执行费用拆开验证，衔接已完成的 UTXO 与分叉实验。

**Architecture:** `account.js` 独立教学执行器，`account-lab.js` 五步网页交互；原 MyToken 修复和新增 ExecutionLab 由独立本地 VM 脚本验证。沿用共享样式与静态部署。

**Tech Stack:** HTML / CSS / BigInt、Node test、Playwright；开发用 solc 0.8.20 / ethers 6.13.4 / Ganache 7.9.2。设计见 `docs/account-design.md`。

- [x] 写9项模型测试并观察缺少模块时失败，再实现执行器。
- [x] 本地VM复现MyToken未初始化immutable编译错误，修复构造函数与零地址mint检查。
- [x] 验证真实合约memory / storage、回滚状态和日志、nonce与手续费。
- [x] 五步工作台分开原生余额与Token映射，固定草稿、回执轨迹、审批与代转。
- [x] 浏览器检查桌面 / 手机、文件、减少动态效果、各种失败边界与状态守恒。
- [x] 更新章节说明 / 入口 / CI / 验证记录，并检查链接。
- [x] 独立复核并处理实际问题，运行最终验证。

发布验收：对应提交的模型 / VM检查与Pages部署成功；线上五步和手机检查通过。新增网页使用教学定额，不声称完整EVM或真实钱包。
