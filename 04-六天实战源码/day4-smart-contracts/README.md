# Day 4：账户、代币与合约执行

先打开 [账户与合约网页](../../03-演示文稿/account-lab.html)，或访问 [在线实验](https://treeverge.github.io/blockchain-learning-lab/03-%E6%BC%94%E7%A4%BA%E6%96%87%E7%A8%BF/account-lab.html)。不用钱包、后台服务或安装 Solidity。

五步：原生 G 与 Token 合约的 LAB 分层余额 → nonce 与草稿重放 → memory 临时返回 / storage 写入 → 纳入后的回滚与费用 → approve / transferFrom。

网页是教学执行器，G / LAB 采用6位精度，发送者身份视作已验证。执行费使用明确的固定定额，不是 EVM 估价；不包含 Ethereum 签名、地址编码、交易池、EIP-1559 或真实资产。未来 nonce 在本即时执行器还不能执行，真实网络可能先暂存它。

## 本地文件

| 文件                    | 内容与边界                                                                     |
| ----------------------- | ------------------------------------------------------------------------------ |
| `01-utxo-vs-account.py` | 零依赖账本对比：同一笔45单位付款、UTXO重复花费拒绝与账户nonce重放拒绝             |
| `02-my-token.sol`       | 18位精度的教学Token，包含转账、授权、受部署者控制的mint与自助burn              |
| `03-storage-demo.sol`   | memory / storage / calldata、数组与事件；已校订费用与持久性的注释              |
| `04-execution-lab.sol`  | 最小回滚实验；memory返回、storage写入、先修改余额 / counter / 日志再主动revert |

MyToken 的构造函数已修复 `_deployer` 初始化，否则 solc 0.8.20 无法编译；mint 增加零地址检查。这是教学代码，不是经过安全审计的发行方案。

## 先运行 Python 对比

在项目根目录执行：

```powershell
python -X utf8 "04-六天实战源码/day4-smart-contracts/01-utxo-vs-account.py"
python -X utf8 -m unittest discover -s tests -p "test_day4_source.py"
```

两种账本都从 Alice 100、Bob 50 开始；Alice 付45后变为55与95。UTXO模型消费整枚70单位输出，生成45单位收款与25单位找零；账户模型直接更新余额，Alice 的nonce从0到1。再次引用旧输出或旧nonce都被拒绝，失败后状态不变。试着在源码副本里把付款改成71，先预测哪条校验会拦截。

这里的所有者只是可信字符串，没有验证私钥；单位不代表真实BTC/ETH，费用设为零，也未模拟脚本、合约存储、交易池、共识或重组。UTXO可附带脚本花费条件，不能概括为“只能记余额”；账户是否拥有通用可变存储，取决于账户与合约执行模型。更多真实签名与双花校验见[Day 3](../day3-signatures-utxo/README.md)，账户纳入后失败的nonce、Gas和回滚见本章网页与 `04-execution-lab.sol`。可对照[Bitcoin交易开发指南](https://developer.bitcoin.org/devguide/transactions.html)和[Ethereum账户说明](https://ethereum.org/en/developers/docs/accounts/)。

## 在 Remix VM 运行

1. 在 [Remix](https://remix.ethereum.org) 新建 Solidity 文件，粘贴所需合约。用 Solidity 0.8.20 编译，选择本地 Remix VM 环境。
2. 部署 MyToken 时可用 `Learning Token`、`LAB`、`150`。初始供应属于部署者；最小单位为 `10^18`，与网页6位精度不同。
3. 先用部署者 approve 给另一个VM账户，再切换到获准账户 transferFrom。核对 allowance 和 balanceOf；非部署者 mint 应拒绝。
4. 单独部署 ExecutionLab，调用 `previewMemory(9)`，counter 仍为0；提交 `store(9)` 后 counter 变9。
5. 用部署者调用 `transferThenFail(另一VM地址, 10)`。它应失败，counter 与 balanceOf 不变，日志不提交；核对失败交易的 nonce 和 Gas。

链外 `eth_call` 执行计算但不提交状态或链上交易费用。memory 读写也消耗执行 Gas；view 函数在链上被其他合约调用时同样计入 Gas。不要把“链外读取不提交费用”解释为“函数执行没有成本”。参照 [Solidity 0.8.20 数据位置](https://docs.soliditylang.org/en/v0.8.20/types.html#data-location) 与 [Ethereum 账户说明](https://ethereum.org/en/developers/docs/accounts/)。

## 开发验证

网页的9项模型检查不需要npm依赖：

```powershell
node --test tests/account.test.cjs
```

本地 VM 验证在项目根目录运行，依赖安装在临时目录：

```powershell
$accountTools = Join-Path $env:TEMP 'blockchain-account-validation'
npm.cmd install --prefix $accountTools --no-audit --no-fund solc@0.8.20 ethers@6.13.4 ganache@7.9.2
$env:NODE_PATH = Join-Path $accountTools 'node_modules'
node tests/account-solidity-check.cjs
```

VM检查三个Solidity文件编译，并核对真实回滚后的余额 / counter / 日志、发送者nonce与手续费，以及Token的mint权限和授权消耗。不会连接真实网络。网页定额和实际VM Gas不要求相同；双方验证的是状态边界。
