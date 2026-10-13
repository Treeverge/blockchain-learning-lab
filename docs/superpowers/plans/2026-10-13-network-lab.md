# 节点与分叉实验实施计划

**Goal:** 将真实交易授权、独立节点、分叉选择和 UTXO 重组串成一个可对账的网页实验。

**Architecture:** `network.js` 组合现有 `chain.js` 与 `utxo.js`，负责交易接收、挖矿、完整验证、选链和重放；`network-lab.js` 负责五步教学与显示。原两章保持独立，入口互相连接。

**Tech Stack:** 静态 HTML / 共享 CSS、Web Crypto、BigInt、Node test、开发用 Playwright。沿用本会话全权执行的授权，设计见 `docs/network-design.md`。

## 模型

- [x] 写 `tests/network.test.cjs` 的 9 个行为测试：独立节点 / 接收不扣款、池内冲突、挖矿后单节点更新、等工作与节点数量、重放对账、无权签名长链、完整签名承诺、孤立交易恢复、取消不提交。
- [x] 运行新增测试，确认缺少模型时失败。
- [x] 新建 `assets/js/network.js`，复用真实 SHA / ECDSA。固定难度 1；创世承诺初始状态；完整交易 witness 承诺；最多 8 块。
- [x] 运行全部 JavaScript 与 Python 测试，确认原实验没有回归。

## 页面

- [x] 新建 `03-演示文稿/network-lab.html`、`assets/js/network-lab.js`，在共享 `assets/css/lab.css` 追加作用域样式。
- [x] 五步控件：自由传播；默认分叉与单节点挖矿；C → A / B 等工作传播；C 增空块后传播；无效长链挑战。
- [x] 显示节点高度 / 有效工作 / 待确认 / 当前链收款人，选中节点的区块与 UTXO、重组撤下 / 接入 / 丢弃报告和操作记录。
- [x] 初始化禁用控件，异步任务锁定、可取消挖矿、失败提示与减少动态效果。
- [x] 扩展 `tests/browser-check.cjs`：默认主线、余额与费用、同工作不切换、重组后 X 的输入拒绝、无效长链、文件 / 手机 / 动态效果；检查截图并修复视觉问题。

## 入口与发布

- [x] 修改 `index.html` Day 2 入口、原 Day 2 README 前言、两章互相链接、根 README、项目说明、`docs/verification.md` 与 CI。
- [x] 独立代码复核，处理实际问题；运行检查与链接扫描。

发布验收要求（推送后按实际结果核对）：

- 对应提交的自动模型检查与 Pages 部署均成功。
- 在线默认五步与手机布局通过，报告结果及真实网络边界。
