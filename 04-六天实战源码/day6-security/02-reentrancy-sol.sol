// SPDX-License-Identifier: MIT
// ======================================================================
// Day 6 - 合约安全：重入攻击的 Solidity 版本
// ======================================================================
//
// 这份代码展示有漏洞和修复后的两个版本
// 可以在 Remix 里部署对比
//
// ======================================================================

pragma solidity ^0.8.20;

// ================================================================
// 有漏洞的银行
// ================================================================
contract VulnerableBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // ⚠️ 有重入漏洞！
    function withdraw() external {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "no balance");

        // ❌ 先转账，后改账本 -> 致命错误
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "transfer failed");

        // 这行要等到 call 结束才执行
        // 但 call 会触发对方的 receive()/fallback()
        // 对方可以在那里再调用 withdraw()!
        balances[msg.sender] = 0;
    }
}


// ================================================================
// 修复版：Checks-Effects-Interactions
// ================================================================
contract SafeBank {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    // ✅ 修复：先改账本，后转账
    function withdraw() external {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "no balance");          // Checks

        balances[msg.sender] = 0;                     // Effects (先改账!)

        (bool success, ) = msg.sender.call{value: balance}("");  // Interactions
        require(success, "transfer failed");
    }
}


// ================================================================
// 修复版2：用锁 (OpenZeppelin ReentrancyGuard 原理)
// ================================================================
contract SafeBankWithLock {
    mapping(address => uint256) public balances;
    bool private locked;

    // modifier 就像一个"前置检查+后置清理"的包装器
    // C++ 类比: 像 RAII 构造时加锁, 析构时解锁
    modifier nonReentrant() {
        require(!locked, "reentrant call blocked");
        locked = true;    // 加锁
        _;                 // ← 这里代表函数本身的代码
        locked = false;    // 解锁
    }

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external nonReentrant {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "no balance");

        balances[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: balance}("");
        require(success, "transfer failed");
    }
}

// ================================================================
// 在 Remix 里怎么测试:
// ======================================================================
//
// 1. 部署 VulnerableBank
// 2. 用 Account A 存 10 ETH (deposit, value=10 ether)
// 3. 用 Account B 存 10 ETH
// 4. 正常提款: A 调用 withdraw() -> 拿回 10 ETH, 没问题
//
// 要看到漏洞效果，需要部署一个攻击合约：
//   contract Attacker {
//       VulnerableBank bank;
//       constructor(address _bank) { bank = VulnerableBank(payable(_bank)); }
//
//       function attack() external payable {
//           bank.deposit{value: msg.value}();  // 先存钱
//           bank.withdraw();                    // 然后提款
//       }
//
//       // 银行转账时会触发这个
//       receive() external payable {
//           if (address(bank).balance >= 1 ether) {
//               bank.withdraw();  // ← 递归调用! 再提一次!
//           }
//       }
//   }
//
// 部署 Attacker, 传入 VulnerableBank 地址
// 调用 attack(), value = 1 ether
// -> 攻击者存 1 ETH, 但通过递归把银行里所有钱都偷走
//
// 然后换 SafeBank 重复上面的步骤 -> 攻击失败
// ======================================================================
