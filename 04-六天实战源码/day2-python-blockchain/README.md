# Day 2 网页实验：节点、分叉与账本重组

先打开 [本地节点实验](../../03-演示文稿/network-lab.html)，或访问 [在线实验](https://treeverge.github.io/blockchain-learning-lab/03-%E6%BC%94%E7%A4%BA%E6%96%87%E7%A8%BF/network-lab.html)。它把新增哈希与签名模型串起来，无需后台服务或安装 Python 依赖。

默认主线：A / B 收到 X（给 Bob），C 收到 Y（给 Eve）；两份都由 Alice 签名并花同一输入。分别挖块后，两条链各有 16 单位有效工作，等工作传播暂不切换。C 再挖一空块后传播，A / B 撤下 X 的分支并重放 Y，Bob 从 95 回到 50，Eve 变为 45，费用仍为 1。无权花费的三块候选即使证明工作更多，也会拒绝。

本地待确认池策略、交易有效性与选链是分开的检查。重组后，旧分支交易重新校验；有未花费输入的可恢复待确认，与新链冲突的丢弃。确认是当前选中链里的状态，不等于不可逆。

边界：三个节点在同一浏览器里，是手动传播的独立快照，不是真实 P2P。固定难度、P-256 签名、完整交易摘要与费用账户是教学规则，不是完整 Bitcoin 实现。旧 Python 源码依赖及规则尚未完成本轮全面校订，不能据此声称它与新网页实现相同。

以下保留 Daniel van Flymen 上游 README 与原有来源链接。许可见本目录 LICENSE 与根目录 THIRD_PARTY.md。

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

