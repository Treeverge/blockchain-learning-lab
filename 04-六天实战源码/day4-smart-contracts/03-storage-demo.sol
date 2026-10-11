// SPDX-License-Identifier: MIT
// ======================================================================
// Day 4 — 第三部分：理解 Solidity 的存储模型
// ======================================================================
//
// 以太坊和比特币最大的不同之一：合约有"存储空间"
//
// 在比特币里：
//   你只能记录"谁有多少钱"（UTXO 集合）
//   你想存别的东西？做不到。脚本只能做简单的条件判断。
//
// 在以太坊里：
//   合约有自己的存储空间，像一个文件系统，能存任意数据
//   这就是"世界计算机"的含义 — 不光是转钱，还能跑程序、存数据
//
// C++ 程序员的直觉：
//   你的 C++ 程序跑在内存里，关了程序数据就没了
//   智能合约跑在区块链上，数据永久存在，全网的节点都帮你存着
//
//   所以存储很贵！写 1 个 256 位整数 ≈ 20000 Gas（约 $0.01~$0.10）
//   读存储免费（本地节点直接读，不需要发交易）
//
// ======================================================================
// Solidity 的三种数据位置：
// ======================================================================
//
//   storage  — 链上永久存储，修改要花 Gas
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
    // storage 变量 — 声明在合约层级，永久存在链上
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
    // 读 storage（不花 Gas，只读）
    // 注意: view 标记 — 不修改链上数据
    // ==============================================================

    function getCounter() external view returns (uint256) {
        return counter;            // 读 storage → 免费
    }

    function getNumbers() external view returns (uint256[] memory) {
        return numbers;            // 把 storage 数组复制到 memory 返回
        //   ↑ 这个 memory 分配只在函数执行期间存在
    }

    function getNumberCount() external view returns (uint256) {
        return numbers.length;     // 读数组长度 → 免费
    }

    function getUser(address addr) external view returns (User memory) {
        return users[addr];        // 复制 struct 到 memory → 免费（读部分）
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
        // → 调用这个函数不需要发交易！免费！
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
    //       getNumbers → call → 不花 Gas
    //
    // 关键理解:
    //   - 任何改变 storage 的操作 → 必须发交易 → 花 Gas → 全网节点都执行
    //   - 任何只读的操作 → 不发交易 → 不花 Gas → 你的本地节点直接返回结果
    //
    //   这和比特币完全不同：
    //     比特币: 你想知道余额 → 自己扫 UTXO 集合算
    //     以太坊: 你想知道余额 → 调用 balanceOf() 函数 → 节点直接告诉你
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
