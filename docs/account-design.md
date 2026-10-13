# 账户、合约存储与执行回滚

日期：2026-10-13。衔接 UTXO / 节点实验，沿用共享五步工作台的米白底色、蓝色操作、等宽数字。右侧明确分开外部账户 G 余额 / nonce 与 Token 合约的 LAB 余额 / 授权 / counter，避免把代币余额误称为原生账户余额。

选择可测试的浏览器教学执行器，配套本地 Solidity VM 验证真实合约的回滚与授权行为。直接在页面装完整 EVM 会增加依赖与加载成本；只放公式不能观察状态边界。页面无需框架、钱包或后台，允许直接文件打开。

五步：账户 / 代币分层；nonce 顺序、重放与未来 nonce；临时计算与 storage；纳入执行后的回滚 / gas 不足；approve 与 transferFrom。提供账户选择、输入、草稿快照、费用预览及回执。读取 / 临时预览不改变状态；写入和转账通过执行交易。

初始三个模拟外部账户 Alice / Bob / Eve 各有 1 G，nonce 0；费用账户 0。Token 合约固定供应 150 LAB，Alice 100 / Bob 50 / Eve 0，counter 0，授权 0。G 与 LAB 均用 6 位整数精度，仅是教学资产，不称 ETH。发送者身份由页面角色指定，假设身份授权已验证；不实现 Ethereum 签名编码、账户地址、网络交易池或 EVM。

教学执行规则：gasPrice 为 0.000001 G / 单位，gasLimit 默认 70000，内在门槛 21000；各操作定额 transfer 40000、approve 30000、transferFrom 50000、store 35000、transferThenFail 60000。这些定额不是实际 EVM 测量或实时估价，不模拟 EIP-1559、费用销毁 / 小费及退款规则。

交易字段和 nonce 不符、gasLimit 低于内在门槛、原生余额不足以支付最大预算时，执行前拒绝，余额 / nonce / 合约均不变。未来 nonce 只代表本即时执行器还不能执行，不声称真实网络无法暂存它。符合纳入条件后消耗发送者 nonce。成功扣实际定额费用；合约 require 失败回滚业务状态，保留 nonce 与已消耗费用。本简化模型 require 失败使用同操作定额；gasLimit 达内在门槛但低于操作定额则用完整 gasLimit、业务回滚。最大预算与实际费用分别显示，不假装先扣预算再当作额外收费。

transferThenFail 在临时执行副本中先转 LAB、修改 counter 并产生临时日志，再主动失败。回执展示尝试轨迹；最终 LAB、counter、日志恢复，G 费用和 nonce 变化。approve 可设置含 0 的额度；transferFrom 调用者支付 G、从被授权账户扣 LAB，成功减少 allowance。失败不消耗 allowance 或修改 LAB，但纳入后仍消耗 nonce 与费用。总 LAB = 150，账户 G + 费用 = 3。

原 MyToken 修复 \_deployer 初始化与零地址 mint 检查，校订地址、memory / view 与费用的误导性注释，保留原教学实现。新增最小 ExecutionLab Solidity 合约用于 memory 预览、storage 和写后主动回滚；不声称完整 ERC-20 或生产钱包。开发测试使用已有临时 solc / ethers / Ganache，本地 VM 不连接真实网络；检查真实交易回滚后的存储 / 日志 / nonce / 手续费以及 Token 的 mint 权限、授权与代转。

验证先写失败用例，覆盖模型成功、预拒绝、重复 / 未来 nonce、纳入失败、gas 不足、最大预算、storage / memory、授权 / 撤销、逐资产守恒与失败不修改输入。浏览器检查五阶段、实际费用提示、草稿过期、回滚轨迹、授权与代转、手机 / 文件 / 减少动态效果。独立复核后推送，确认 Checks / Pages 与线上实验。
