# Day 3 — 区块链怎么防伪（签名 + UTXO + 脚本引擎）

## 运行

```bash
pip install ecdsa
python 01-keys-and-signatures.py
python 02-utxo-model.py
python 03-script-engine.py
```

建议按顺序运行，没有依赖关系。

## 对照 Bitcoin Core 源码

| 脚本 | 概念 | Bitcoin Core 源文件 |
|------|------|---------------------|
| 01-keys-and-signatures.py | ECDSA 密钥生成、签名、验证 | `src/key.h`, `src/pubkey.h` |
| 02-utxo-model.py | UTXO 交易模型、防双花 | `src/primitives/transaction.h` |
| 03-script-engine.py | 解锁脚本、OP_CHECKSIG 执行 | `src/script/script.h`, `src/script/interpreter.h` |

## 三个部分的关系

```
01: 私钥 → 签名，公钥 → 验证
     ↓
02: UTXO = 硬币，花 UTXO 要签名，花完就没（防双花）
     ↓
03: scriptPubKey 锁 UTXO，scriptSig 解锁，引擎执行 OP_CHECKSIG
```

这三层叠在一起就是比特币的防伪体系。
