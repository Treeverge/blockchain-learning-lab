# 开发验证

网页本身不需要 npm 依赖。以下额外工具仅用于开发检查。

## 计算与借贷账本

```powershell
node --test tests/amm.test.cjs
python -X utf8 -m unittest discover -s tests -p "test_*.py"
```

测试向量放在 `tests/amm-vectors.json`。浏览器模型、Python 与 Solidity 使用同一组精确整数结果。

检查资金守恒、双向交换、不同池深、非法金额、失败不改变账本、抢先交易的独立钱包、重复借款累加、还款返还抵押以及抵押不足时的坏账。

## 浏览器

在临时目录安装工具，不改变网页依赖：

```powershell
$qaTools = Join-Path $env:TEMP 'blockchain-defi-validation'
npm.cmd install --prefix $qaTools --no-audit --no-fund playwright solc@0.8.20 ethers@6.13.4 ganache@7.9.2
$env:NODE_PATH = Join-Path $qaTools 'node_modules'
npx.cmd --prefix $qaTools playwright install chromium
node tests/browser-check.cjs
node tests/solidity-check.cjs
```

如已安装 Chrome，可设置 `$env:CHROME_PATH` 为 Chrome 可执行文件的绝对路径，浏览器测试将使用它而不下载 Chromium。`CHROME_PATH` 只供开发脚本使用，网页不需要。

浏览器脚本会创建并关闭临时 HTTP 服务和独立浏览器，检查桌面与 390px 窄屏下的六步流程、交易、错误状态、手续费切换、抢先交易、解释题和横向溢出。也检查 `file://` 直接打开能正确报价。截图保存到 `docs/screenshots`。

## Solidity

`tests/solidity-check.cjs` 用 solc 0.8.20 编译，并在本地 Ganache VM 中部署合约，检查共享报价向量、手续费留池、最小输出、投入比例、LP 退出和资产守恒。不会连接真实网络或真实钱包。

Node.js 24 下 Ganache 的原生 µWS 扩展可能不可用，工具会退回 JavaScript 实现；应以最终测试退出码判断结果。

## 本轮验证记录（2026-10-11）

- JavaScript 交换模型测试：7 项通过。
- Python AMM 与借贷测试：9 项通过。
- Solidity：旧版手续费守恒用例失败，修正版通过同一回归检查及其他合约检查。
- 桌面与手机浏览器检查：通过；已查看截图。额外模拟脚本延迟，确认初始化完成前按钮保持禁用。
- 其他五个章节没有在本轮全面验证，不宣称其全部运行正常。
