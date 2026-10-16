# Day 3 — 区块链怎么防伪（签名 + UTXO + 脚本引擎）

## 先在网页体验

打开 [数字签名与 UTXO 实验](../../03-演示文稿/utxo-lab.html)，或访问 [在线实验](https://treeverge.github.io/blockchain-learning-lab/03-%E6%BC%94%E7%A4%BA%E6%96%87%E7%A8%BF/utxo-lab.html)。无需安装依赖或连接钱包。

1. 查看 Alice、Bob、Eve 的临时公钥与指纹。
2. 使用 Alice 的 70，转给 Bob 45，支付费用 1；观察找零 24。
3. Alice 签名后，改收款人并重算 ID；旧签名失败。改用 Eve 签名则验签有效，但所有者不匹配。
4. 恢复 Alice 原交易并确认：Alice 余额 54，Bob 95，费用账户 1；总量仍为 150。
5. 尝试另一份由 Alice 签署、共享输入的候选：签名仍有效，但输入已花费。也可重置后先确认冲突候选，观察原候选被拒绝。

网页用 Web Crypto 的 ECDSA **P-256** / SHA-256；下方 Python 使用 **secp256k1** / SHA-256。网页指纹、交易编码、主体 ID、签名格式和费用账户都是明确的教学规则，不是 Bitcoin 地址、交易、脚本、coinbase 或完整钱包实现。私钥临时生成且不可导出；页面控制所有角色，不能据此认为它是安全钱包。

签名有效、拥有输入、输入未花费、金额守恒是分别校验的条件。本地 UTXO 账本拒绝重复花费，真实网络仍需要共识确定交易历史。可结合 [哈希与选链实验](../../03-演示文稿/chain-lab.html) 学习。

## 运行

需要 Python 3.8+ 和 `cryptography`。在本目录执行：

```bash
python -m pip install "cryptography>=38,<49"
python -X utf8 01-keys-and-signatures.py
python -X utf8 02-utxo-model.py
python -X utf8 03-script-engine.py
```

三个脚本按顺序观察签名、UTXO 和 P2PKH 栈。它们共用 `day3_core.py`，第三段另用 `script_engine.py`；可以单独运行。项目根目录运行 `python -X utf8 -m unittest discover -s tests -p test_day3_source.py`，验证修改消息、错误密钥、越权、重复输入、金额膨胀和确认后的冲突拒绝。

## 动手验证

1. 运行第 2 段前先预测：输入 70、给 Bob 45、找零 24，费用和最终两人余额是多少？核对输出与 `未花费输出 + 累计费用 = 150`。
2. 在第 2 段复制一份实验，把 `ledger.apply(payment)` 改成先确认 `conflict`，观察谁得到 69、谁被拒绝。两个候选的签名在确认前都有效；节点确认顺序决定本地 UTXO 状态。
3. 在第 1 段把消息中的 Bob 改为 Eve，却沿用旧签名；在第 3 段把锁定公钥哈希换成 Eve 的。分别指出失败发生在“消息签名”还是“锁定公钥”检查。
4. 尝试在第 2 段把找零写成 26。想一想为什么即使 Alice 的签名正确，也必须拒绝创造额外金额。

`day3_core.py` 中的 JSON 消息、交易 ID、初始 UTXO 和 `Ledger.apply` 是可读的教学规则；`script_engine.py` 只演示 P2PKH 的关键栈步骤。真实 Bitcoin 的签名预映像、交易序列化、Script、地址编码、手续费归属、节点传播和共识均更复杂。脚本只创建临时密钥，不应接入真实资产。

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

这三个教学部分分别演示授权、未花费状态与脚本条件。签名能证明对应密钥授权，不能独自证明现实身份或交易已确认。第 2 段先验证全部输入再一次性更新本地 UTXO；真正的跨节点双花裁决还需要共识。
