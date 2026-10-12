# 开发验证

网页本身不需要 npm 依赖。以下额外工具仅用于开发检查。

## 计算与借贷账本

```powershell
node --test tests/amm.test.cjs tests/lp.test.cjs tests/lending.test.cjs tests/chain.test.cjs tests/utxo.test.cjs
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

## LP 验证（2026-10-12）

- 新增 6 项整数模型测试：比例投入、退出、手续费留池、双向套利资金守恒、非法操作不扣款、无费四倍价格约 −20% 的持有差距。
- 浏览器检查完整 LP 流程、仅改变外部价格不修改储备、退出前后价值一致、冻结状态、无费对照、桌面与 390px 四阶段无横向溢出、直接双击运行。
- 用户删除的旧产品入口不恢复；已移除相应跳转测试并清理当前说明。

## 借贷验证（2026-10-12）

- 新增 7 项 JavaScript 测试，完整模型共 20 项；Python 新增共享清算向量检查，共 10 项。
- 现金与抵押分别守恒，债务不重复计入现金；累计借款、健康因子边界、补抵押、还款、资金不足、清算者实际支付和坏账均有检查。
- 网页检查 75 B/C 边界、70 时还款恢复健康、60 时清算坏账 8.571429 B、情景冻结、五阶段窄屏无溢出、直接双击和减少动态效果。
- 全额关闭及固定 5% 奖励是明确教学模型，省略利息、部分清算和真实预言机，不声称完整协议模拟。

## 哈希与选链验证（2026-10-12）

- 新增 7 项模型测试，完整 JavaScript 模型共 27 项。验证标准 SHA-256 向量、修改检测、修复、创世锚点、索引、真实证明、等工作不切换、更多有效工作接受、无效长链拒绝，以及取消和尝试上限不提交半成品。
- 网页检查从修改到修复的校验变化、节点分歧、基准挖矿、重写挖矿、传播等工作分叉、追加有效块后收敛；五步手机无横向溢出、直接双击与减少动态效果。
- 固定难度工作是期望工作单位，不是本次实际尝试次数。未启用证明的阶段不进行传播选链；不模拟交易授权、真实网络与难度调整。

## 签名与 UTXO 验证（2026-10-12）

- 新增 8 项 JavaScript 测试，共 35 项；Python 仍为 10 项。检查真实签名、私钥不可导出、主体全部字段绑定、缺失签名、重哈希篡改、错误所有者、多输入、找零与费用、零费无找零、非法输出和 ID、重复确认与冲突拒绝。
- 浏览器检查未签名、篡改确认失败不扣款、Eve 签名有效但无权限、确认后 Alice 54 / Bob 95 / 费用 1、冲突拒绝后签名仍有效、反向确认顺序、零手续费、五步手机与展开长字段无横向溢出、直接双击和减少动态效果。
- 网页 P-256 与原 Python secp256k1 不同；主体 ID 不含签名，指纹不是 Bitcoin 地址。当前只实现本地确认账本，没有真实网络共识、挖矿打包、持久化与分叉回滚。
