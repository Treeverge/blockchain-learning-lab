// SPDX-License-Identifier: MIT
// ======================================================================
// Day 4 — 第三部分：理解 Solidity 的存储模型
// ======================================================================
//
// 以太坊和比特币最大的不同之一：合约有"存储空间"
//
// 在比特币里：
//   UTXO 包含金额与花费条件；交易也可作数据承诺。
//   这些机制不能直接等同于本例的通用可变合约存储。
//
// 在以太坊里：
//   合约有自己的存储空间，像一个文件系统，能存任意数据
//   这就是"世界计算机"的含义 — 不光是转钱，还能跑程序、存数据
//
// C++ 程序员的直觉：
//   你的 C++ 程序跑在内存里，关了程序数据就没了
//   智能合约的状态在节点接受的链上持久保存，后续交易与链重组仍可能改变它
//
//   存储成本受旧值、新值、访问状态与协议规则影响，不固定换算成美元
//   链外eth_call不提交交易费用；链上执行时读取存储也消耗Gas
//
// ======================================================================
// Solidity 的三种数据位置：
// ======================================================================
//
//   storage  — 跨调用的持久状态，读写在链上执行时消耗 Gas
//              ≈ C++ 里写文件到磁盘，但每个全节点都存一份
//
//   memory   — 函数执行期间的临时内存，函数结束就释放
//              ≈ C++ 的栈变量 / 局部数组
//
//   calldata — 函数参数用的只读内存，比 memory 更省 Gas
//              ≈ C++ 的 const & 参数
//
// ======================================================================
// 这个合约让你在 Remix 里对比三种数据位置的行为
// ======================================================================

pragma solidity ^0.8.20;

contract StorageDemo {
    // ==============================================================
    // storage 变量 — 声明在合约层级，跨调用持久保存
    // ==============================================================

    // 简单类型
    uint256 public counter;        // 一个整数，初始值 0
    address public owner;          // 合约部署者的地址
    bool public isActive;          // 开关状态

    // 数组 — 动态大小
    uint256[] public numbers;      // 相当于 C++ 的 vector<uint256>

    // mapping — 哈希表
    mapping(address => uint256) public balances;  // 每个地址的余额

    // struct — 自定义类型
    struct User {
        string name;
        uint256 score;
        bool registered;
    }
    mapping(address => User) public users;  // 每个地址一个 User

    // ==============================================================
    // constructor — 初始化 storage 变量
    // ==============================================================
    constructor() {
        owner = msg.sender;
        isActive = true;
    }

    // ==============================================================
    // 写 storage（发交易，花 Gas）
    // ==============================================================

    function incrementCounter() external {
        counter += 1;               // 修改 storage → 花 Gas
    }

    function addNumber(uint256 n) external {
        numbers.push(n);            // 往数组里加元素 → 花 Gas
    }

    function setBalance(address addr, uint256 amount) external {
        balances[addr] = amount;    // 修改 mapping → 花 Gas
    }

    function registerUser(string calldata name, uint256 score) external {
        // 注意: calldata 用于函数参数（只读），省 Gas
        User storage user = users[msg.sender];  // user 是 storage 引用
        user.name = name;           // 修改 storage → 花 Gas
        user.score = score;         // 修改 storage → 花 Gas
        user.registered = true;     // 修改 storage → 花 Gas
    }

    // ==============================================================
    // 读 storage（不修改状态；链外调用不提交交易费用）
    // 注意: view 标记 — 不修改链上数据
    // ==============================================================

    function getCounter() external view returns (uint256) {
        return counter;            // 链上执行时读取仍计入 Gas
    }

    function getNumbers() external view returns (uint256[] memory) {
        return numbers;            // 把 storage 数组复制到 memory 返回
        //   ↑ 这个 memory 分配只在函数执行期间存在
    }

    function getNumberCount() external view returns (uint256) {
        return numbers.length;     // 不修改数组
    }

    function getUser(address addr) external view returns (User memory) {
        return users[addr];        // 复制 struct 到 memory；链上执行仍计入 Gas
        //                              但返回 memory 会复制数据
    }

    // ==============================================================
    // memory vs storage 的区别演示
    // ==============================================================

    function demoMemoryVsStorage() external view returns (uint256) {
        // memory: 函数内的临时变量，不能修改链上数据
        uint256[] memory tempArray = new uint256[](3);
        tempArray[0] = 10;
        tempArray[1] = 20;
        tempArray[2] = 30;
        return tempArray[0] + tempArray[1] + tempArray[2];  // 60

        // 这整个函数是 view（只读），因为 tempArray 在 memory 里
        // 没有修改任何 storage 变量
        // → 可用链外eth_call观察结果，不提交状态或交易费用
    }

    // 对比：这个函数会修改 storage
    function demoStorageModification(uint256 n) external {
        numbers.push(n);  // 改了 storage → 要发交易 → 花 Gas

        // 如果你通过 Remix 的 call 按钮调用这个，Remix 会提示：
        // "This function changes the state, it will cost gas"
    }

    // ==============================================================
    // 批量操作演示 — 为什么 storage 操作要省着用
    // ==============================================================

    function batchUpdate(uint256[] calldata values) external {
        // calldata: 参数只读，最省 Gas
        // 相当于 C++ 的 void foo(const vector<uint256>& values)

        for (uint256 i = 0; i < values.length; i++) {
            numbers.push(values[i]);

            // 每次 push 都写一次 storage → 都花 Gas
            // 如果你传 100 个值，这个循环会花很多 Gas！
            // 这就是为什么 Solidity 程序员要优化循环
        }
    }

    // ==============================================================
    // Gas 消耗对比
    // ==============================================================
    //
    // 在 Remix 里部署后，试试看:
    //
    //   1. 点 incrementCounter（橙色按钮 = 发交易）
    //       终端会显示: "transaction cost: ~43000 gas"
    //
    //   2. 点 getCounter（蓝色按钮 = call，不发交易）
    //       终端会显示: "call" → 没有 gas cost
    //
    //   3. 对比 addNumber(42) 和 getNumbers():
    //       addNumber → 发交易 → 花 Gas
    //       getNumbers → 链外call → 不提交交易费用；执行本身仍计量Gas
    //
    // 关键理解:
    //   - 任何改变 storage 的操作 → 必须发交易 → 花 Gas → 全网节点都执行
    //   - 链外读取可不发交易；只读函数若在链上被调用，仍消耗Gas
    //
    //   查询余额的来源也不同：
    //     比特币: 钱包从可花费 UTXO 集合计算地址相关余额
    //     以太坊: 原生 ETH 余额属于账户状态；代币余额可由代币合约的 balanceOf() 查询
    // ==============================================================

    // ==============================================================
    // events — 日志（花 Gas，但比 storage 便宜得多）
    // ==============================================================

    event NumberAdded(address indexed adder, uint256 value);
    event UserRegistered(address indexed user, string name, uint256 score);

    function addNumberWithEvent(uint256 n) external {
        numbers.push(n);
        emit NumberAdded(msg.sender, n);  // 写日志 → 花 Gas，但便宜

        // events 存在交易收据里，不在 storage 里
        // 区块链浏览器（Etherscan）能读到 events
        // 但合约代码不能读取自己的 events → events 是对外的
    }

    function registerWithEvent(string calldata name, uint256 score) external {
        users[msg.sender] = User(name, score, true);
        emit UserRegistered(msg.sender, name, score);
    }
}
