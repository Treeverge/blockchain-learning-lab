# Day 6 · 重入与安全边界

先打开 [重入网页实验](../../03-演示文稿/security-lab.html)，再用源码复核。网页可双击，不需要服务器或钱包。

这章解释三个问题：外部调用为什么让接收者获得控制权？提前改账与重入锁分别在哪一步起作用？内层失败是否会让整个提款回滚？

## 同一份资金样例

存款已在先前完成：Alice 3 G、Bob 2 G、攻击合约1 G，银行实际持有6 G。G为网页/Python虚拟整数单位；本地 Solidity VM使用3/2/1 ETH，但没有真实资产。

| 实现 / 回调策略       | 本次最终结果            | 银行实际资金 | 攻击合约收到 | 剩余债权 / 缺口 |
| --------------------- | ----------------------- | ------------ | ------------ | --------------- |
| 正常Alice提款3        | 成功                    | 3            | 0            | 3 / 0           |
| 漏洞，最多接收6次     | 成功                    | 0            | 6            | 5 / 5           |
| CEI，捕获内层失败     | 成功                    | 5            | 1            | 5 / 0           |
| 独立锁，捕获内层失败  | 成功                    | 5            | 1            | 5 / 0           |
| CEI或锁，向外传播失败 | 整笔提款回滚            | 6            | 0            | 6 / 0           |
| 漏洞，尝试7次，不捕获 | 第7次资金不足，整体回滚 | 6            | 0            | 6 / 0           |
| 任一实现，接收者拒收  | 整笔提款回滚            | 6            | 0            | 6 / 0           |

银行现金 + 接收者持有金额始终等于6。用户债权表示银行的偿付义务，不应重复算作资产。攻击合约收到6，其中自身存款1、其他用户资金5；不能把收到金额全部叫作“净赚”。

## 文件与验证

| 文件                                      | 用途与范围                                                                                          |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `01-reentrancy-attack.py`                 | 标准库有界执行器，包含实际现金、债权、回调与分层回滚；修正旧版可凭空重复付款的问题                  |
| `02-reentrancy-sol.sol`                   | VulnerableBank、SafeBank（CEI）、LockOnlyBank、SafeBankWithLock（CEI加锁）与可部署的BoundedReceiver |
| `03-toolchain-overview.md`                | 本地工具选择与学习路线，不要求真实链部署                                                            |
| `../../assets/js/security.js`             | 与Python共享整数样例的网页模型                                                                      |
| `../../tests/security-solidity-check.cjs` | solc 0.8.20编译、隔离Ganache VM验证真实重入、失败传播、日志回滚和费用                               |

```powershell
python -X utf8 "04-六天实战源码/day6-security/01-reentrancy-attack.py"
python -X utf8 -m unittest discover -s tests -p "test_*.py"
node --test tests/security.test.cjs
```

本地VM需要开发依赖，网页运行不需要安装它们。可将依赖安装到临时目录：

```powershell
$securityDeps = Join-Path $env:TEMP 'blockchain-security-validation'
npm install --prefix $securityDeps --no-audit --no-fund solc@0.8.20 ethers@6.13.4 ganache@7.9.2
$env:NODE_PATH = Join-Path $securityDeps 'node_modules'
node tests/security-solidity-check.cjs
```

测试只部署到本进程的本地VM。Node24可能提示µWS原生扩展不可用并退回JS，按测试最终退出码判断；CI使用Node22执行同样测试。

## 在 Remix VM 手动复核

选择编译器0.8.20和Remix本地VM，粘贴Solidity文件。

1. 部署VulnerableBank。账户A以3 ether、账户B以2 ether分别调用deposit。
2. 用账户A部署BoundedReceiver，构造参数为银行地址。以1 ether调用seed，作为另一笔独立交易。
3. 调用attack(6, true, false)，不要附带value。接收合约余额变成6 ether，银行变成0；银行仍记有A债权3和B债权2。
4. 对SafeBank、LockOnlyBank重新部署一套相同初态，再运行相同attack；接收合约只能得到1。
5. 重新建立初态，调用attack(6, false, false)，安全版本整笔提款回滚；调用attack(6, true, true)，主动拒收也回滚。先前seed形成的1债权保留。
6. 在漏洞版本新初态调用attack(7, false, false)，第7次现金不足导致此前6次临时支付全部恢复；换成捕获失败则前6次可以提交。

BoundedReceiver仅允许部署者seed/attack，并把收到的钱留在实验合约中便于对账；未提供资产转出接口。它是本地实验夹具。

## 安全边界

- 网页/Python不模拟Gas、nonce、交易签名或EVM。VM失败交易仍扣执行费并增加发送者nonce；合约业务余额、存储和事件恢复。
- 网页锁版本故意保留先转账后改账，以隔离锁的效果；实际工程需结合状态顺序、所有入口和成熟库审查。保留的SafeBankWithLock展示组合。
- 外部调用成功返回不等于整笔交易已提交。后续失败仍可撤销前面的转账。逐帧状态是临时快照，最终账本另列。
- 重入不只来自原生币转账，也可能跨函数、跨合约；本实验没有覆盖全部变体，不能据此声称一个协议已通过安全审计。

依据：[Solidity 0.8.20 安全考虑：重入](https://docs.soliditylang.org/en/v0.8.20/security-considerations.html#reentrancy)、[Checks-Effects-Interactions](https://docs.soliditylang.org/en/v0.8.20/security-considerations.html#use-the-checks-effects-interactions-pattern)。
