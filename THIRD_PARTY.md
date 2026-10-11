# 上游代码与第三方素材

根目录 MIT 许可适用于本项目新增代码和文档，不替代上游的版权声明，也不适用于第三方商标、照片或引用材料。

## Day 1 — JavaScript 区块链

- 上游：[adrianmcli/simple-js-blockchain](https://github.com/adrianmcli/simple-js-blockchain)
- 原作者：Adrian Li。
- 2026-10-11 核对：本地 `src/lib.js` 与上游文件内容一致；上游 `package.json` 明确声明 MIT。
- 本地补充 `LICENSE` 与本文件中的作者声明，依据上游已声明的 MIT 许可整理；不把新增的许可证文件称为从上游原样复制。
- 原有 README 和 package.json 作者信息保留；`scripts/` 为资料包中的扩展教学实验，不代表上游原始实现。

## Day 2 — Python 区块链

- 上游：[dvf/blockchain](https://github.com/dvf/blockchain)。
- 原作者：Daniel van Flymen。
- 原 MIT 许可证位于 `04-六天实战源码/day2-python-blockchain/LICENSE`，保留 2017 年版权声明。
- 原有 README 中的上游链接保留；扩展实验脚本与上游主体区分。

## 图片、商标与案例

`assets/picture/` 和 `03-演示文稿/picture/` 包含原资料包中的 Bitcoin、Walmart、Maersk、De Beers 图片或标识。相关商标属于各自权利人；本项目不主张权利，也不授予这些素材 MIT 许可。

这些素材保留用于原有教学案例，其具体图片来源与授权记录尚未整理完整。新版学习首页和交换实验不使用这些素材。案例材料也不意味着相关企业当前仍采用文中描述的系统，使用者应核实时间和来源。

## 新版 DeFi 模型

交换模型按恒定乘积及留池手续费的教学规则编写；并非复制完整协议，也不能替代协议源码或审计。

Solidity 示例使用内部 mapping 余额，而非真实 ERC-20 转账；测试水龙头、严格按比例加入流动性、整数舍入和锁定的最小份额都是明确的教学设定。
