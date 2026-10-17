# 上游代码与第三方素材

根目录 MIT 许可适用于本项目新增代码和文档，不替代上游的版权声明，也不适用于第三方商标或引用材料。

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
- Day 2 的 `blockchain.py` 与 Dockerfile 对本地运行、输入错误和不可达同伴做了局部兼容修复；`requirements.txt` / `Pipfile` 仍保留上游旧版本，现代学习依赖另列在 `requirements-learning.txt`。`verified_network.py` 是本项目新增教学模型，不属于上游原始实现。

## 图片、商标与案例

2026-10-17 清理了两套从未被页面或文档引用的 Bitcoin、Walmart、Maersk、De Beers 旧 JPEG。它们的来源与授权记录不完整，因此不再随当前版本发布。`docs/screenshots/` 是本项目网页的本地截图，用来展示教学界面。

案例中出现的企业名称和商标归各自权利人所有；本项目不主张其权利，也不授予这些标识 MIT 许可。案例材料不意味着相关企业当前仍采用文中描述的系统，使用者应核实时间和来源。

## 新版 DeFi 模型

交换模型按恒定乘积及留池手续费的教学规则编写；并非复制完整协议，也不能替代协议源码或审计。

Solidity 示例使用内部 mapping 余额，而非真实 ERC-20 转账；测试水龙头、严格按比例加入流动性、整数舍入和锁定的最小份额都是明确的教学设定。
