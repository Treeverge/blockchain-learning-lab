# Day 2 网页实验：节点、分叉与账本重组

先打开 [本地节点实验](../../03-演示文稿/network-lab.html)，或访问 [在线实验](https://treeverge.github.io/blockchain-learning-lab/03-%E6%BC%94%E7%A4%BA%E6%96%87%E7%A8%BF/network-lab.html)。它把新增哈希与签名模型串起来，无需后台服务或安装 Python 依赖。

默认主线：A / B 收到 X（给 Bob），C 收到 Y（给 Eve）；两份都由 Alice 签名并花同一输入。分别挖块后，两条链各有 16 单位有效工作，等工作传播暂不切换。C 再挖一空块后传播，A / B 撤下 X 的分支并重放 Y，Bob 从 95 回到 50，Eve 变为 45，费用仍为 1。无权花费的三块候选即使证明工作更多，也会拒绝。

本地待确认池策略、交易有效性与选链是分开的检查。重组后，旧分支交易重新校验；有未花费输入的可恢复待确认，与新链冲突的丢弃。确认是当前选中链里的状态，不等于不可逆。

边界：三个节点在同一浏览器里，是手动传播的独立快照，不是真实 P2P。固定难度、P-256 签名、完整交易摘要与费用账户是教学规则，不是完整 Bitcoin 实现。

## 对应的 Python 练习（推荐）

新版 `verified_network.py` 和 `scripts/05-verified-reorg.py` 不启动服务；它们重现网页主线的检查顺序与余额结果。需要 Python 3.10+。Python 复用 Day 3 的 **secp256k1** 签名，而网页使用 **P-256**，两者交易编码、区块哈希和签名不能互换。在本目录执行：

```powershell
python -m pip install -r requirements-learning.txt
python -X utf8 scripts/05-verified-reorg.py
```

在项目根目录执行行为测试：

```powershell
python -X utf8 -m unittest discover -s tests -p "test_day2_source.py"
```

| 学习问题 | 新版网页 / Python 练习 | 保留的上游 `blockchain.py` |
| --- | --- | --- |
| 收到交易 | 节点独立待确认池，接收不扣款，池内冲突先到先留 | `current_transactions` 是本节点待打包列表，无签名或冲突检查 |
| 交易授权与守恒 | 验签、UTXO 所有者、未花费、正额与费用分别校验 | 接收任意 `sender` / `amount`，不检查资产来源 |
| 区块校验 | 链接、哈希、固定 PoW、完整签名摘要和逐块 UTXO 重放 | 检查相邻链接与简化 PoW，未校验交易账本 |
| 分叉选择 | 等有效工作保留原链；更多有效工作才切换 | 比较长度；旧规则不能判断交易有效性 |
| 重组 | 从共同初始 UTXO 重放新链、替换费用；孤立交易重检 | 替换链列表，不重算余额或待处理交易 |

动手试验：先预测 A/C 等工作时是否换链，再让 C 挖空块；核对 Bob 95→50、Eve 0→45、Alice 54、费用仍为 1。接着在练习副本里让 Eve 签 Alice 的输入，即使多挖两块也应被拒绝。最后用 Alice 的另一笔 30 产生独立交易，观察它从被撤下的区块恢复为待确认，而与 Y 冲突的 X 不能恢复。测试分别覆盖这些边界。

## 上游 Flask 示例（历史对照）

上游 `blockchain.py` 可用现代依赖在本机学习接口；已补空 JSON、空链、损坏同伴链、无效节点地址和不可达节点处理，服务器默认只监听 `127.0.0.1`。下面原始 `requirements.txt` 与 `Pipfile` 保留当年的版本，**不建议在当前 Python 上安装**。若要运行，使用上面的 `requirements-learning.txt` 后执行 `python blockchain.py --port 5001`，关闭终端即停止。Dockerfile 已改为 Python 3.12 与现代学习依赖；容器内监听 `0.0.0.0` 才能由宿主机访问。它没有钱包、签名、UTXO 或有效账本选链；不得连真实资产，也不要把它暴露到公网。

以下保留 Daniel van Flymen 上游 README 原文与来源链接作历史资料，其中安装命令反映原始环境；Dockerfile 和服务入口已做上述兼容修复。许可见本目录 LICENSE 与根目录 THIRD_PARTY.md。

# Are you looking for the source code for my book?

Please find it here: https://github.com/dvf/blockchain-book

The book is available on Amazon: https://www.amazon.com/Learn-Blockchain-Building-Understanding-Cryptocurrencies/dp/1484251709

# Learn Blockchains by Building One

[![Build Status](https://travis-ci.org/dvf/blockchain.svg?branch=master)](https://travis-ci.org/dvf/blockchain)

This is the source code for my post on [Building a Blockchain](https://medium.com/p/117428612f46). 

## Installation

1. Make sure [Python 3.6+](https://www.python.org/downloads/) is installed. 
2. Install [pipenv](https://github.com/kennethreitz/pipenv). 

```
$ pip install pipenv 
```
3. Install requirements  
```
$ pipenv install 
``` 

4. Run the server:
    * `$ pipenv run python blockchain.py` 
    * `$ pipenv run python blockchain.py -p 5001`
    * `$ pipenv run python blockchain.py --port 5002`
    
## Docker

Another option for running this blockchain program is to use Docker.  Follow the instructions below to create a local Docker container:

1. Clone this repository
2. Build the docker container

```
$ docker build -t blockchain .
```

3. Run the container

```
$ docker run --rm -p 80:5000 blockchain
```

4. To add more instances, vary the public port number before the colon:

```
$ docker run --rm -p 81:5000 blockchain
$ docker run --rm -p 82:5000 blockchain
$ docker run --rm -p 83:5000 blockchain
```

## Installation (C# Implementation)

1. Install a free copy of Visual Studio IDE (Community Edition):
https://www.visualstudio.com/vs/

2. Once installed, open the solution file (BlockChain.sln) using the File > Open > Project/Solution menu options within Visual Studio.

3. From within the "Solution Explorer", right click the BlockChain.Console project and select the "Set As Startup Project" option.

4. Click the "Start" button, or hit F5 to run. The program executes in a console window, and is controlled via HTTP with the same commands as the Python version.


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

