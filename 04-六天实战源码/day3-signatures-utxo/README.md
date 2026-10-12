# Day 3 — 区块链怎么防伪（签名 + UTXO + 脚本引擎）

## 先在网页体验

打开 [数字签名与 UTXO 实验](../../03-演示文稿/utxo-lab.html)，或访问 [在线实验](https://treeverge.github.io/blockchain-learning-lab/03-%E6%BC%94%E7%A4%BA%E6%96%87%E7%A8%BF/utxo-lab.html)。无需安装依赖或连接钱包。

1. 查看 Alice、Bob、Eve 的临时公钥与指纹。
2. 使用 Alice 的 70，转给 Bob 45，支付费用 1；观察找零 24。
3. Alice 签名后，改收款人并重算 ID；旧签名失败。改用 Eve 签名则验签有效，但所有者不匹配。
4. 恢复 Alice 原交易并确认：Alice 余额 54，Bob 95，费用账户 1；总量仍为 150。
5. 尝试另一份由 Alice 签署、共享输入的候选：签名仍有效，但输入已花费。也可重置后先确认冲突候选，观察原候选被拒绝。

网页用 Web Crypto 的 ECDSA **P-256** / SHA-256；下方 Python 密钥示例使用 **secp256k1**。网页指纹、交易编码、主体 ID、签名格式和费用账户都是明确的教学规则，不是 Bitcoin 地址、交易、脚本、coinbase 或完整钱包实现。私钥临时生成且不可导出；页面控制所有角色，不能据此认为它是安全钱包。

签名有效、拥有输入、输入未花费、金额守恒是分别校验的条件。本地 UTXO 账本拒绝重复花费，真实网络仍需要共识确定交易历史。可结合 [哈希与选链实验](../../03-演示文稿/chain-lab.html) 学习。

## 运行

```bash
pip install ecdsa
python 01-keys-and-signatures.py
python 02-utxo-model.py
python 03-script-engine.py
```

建议按顺序运行，没有依赖关系。

## 对照 Bitcoin Core 源码

| 脚本                      | 概念                       | Bitcoin Core 源文件                               |
| ------------------------- | -------------------------- | ------------------------------------------------- |
| 01-keys-and-signatures.py | ECDSA 密钥生成、签名、验证 | `src/key.h`, `src/pubkey.h`                       |
| 02-utxo-model.py          | UTXO 交易模型、防双花      | `src/primitives/transaction.h`                    |
| 03-script-engine.py       | 解锁脚本、OP_CHECKSIG 执行 | `src/script/script.h`, `src/script/interpreter.h` |

## 三个部分的关系

```
01: 私钥 → 签名，公钥 → 验证
     ↓
02: UTXO = 硬币，花 UTXO 要签名，花完就没（防双花）
     ↓
03: scriptPubKey 锁 UTXO，scriptSig 解锁，引擎执行 OP_CHECKSIG
```

这三个教学部分分别演示授权、未花费状态与脚本条件；真实比特币还需要完整交易校验、节点传播及共识规则。本目录原脚本保留作进一步阅读，尚未完成本轮全面校订。
