// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Local teaching fixtures only. Balances are claims, not the bank's actual ETH.
abstract contract BankLedger {
    mapping(address => uint256) public balances;
    event Paid(address indexed recipient, uint256 amount);
    function deposit() external payable {
        require(msg.value > 0, "zero deposit");
        balances[msg.sender] += msg.value;
    }
    function withdraw() external virtual;
}

contract VulnerableBank is BankLedger {
    function withdraw() external override {
        uint256 value = balances[msg.sender];
        require(value > 0, "no balance");
        (bool ok, ) = msg.sender.call{value: value}("");
        require(ok, "transfer failed");
        balances[msg.sender] = 0; // Callback has already run while claim was old.
        emit Paid(msg.sender, value);
    }
}

contract SafeBank is BankLedger {
    function withdraw() external override {
        uint256 value = balances[msg.sender];
        require(value > 0, "no balance");       // Checks
        balances[msg.sender] = 0;               // Effects
        (bool ok, ) = msg.sender.call{value: value}(""); // Interactions
        require(ok, "transfer failed"); // Failure rolls back the earlier write.
        emit Paid(msg.sender, value);
    }
}

abstract contract TeachingLock is BankLedger {
    bool public locked;
    modifier nonReentrant() {
        require(!locked, "reentrant call blocked");
        locked = true;
        _;
        locked = false;
        // A revert restores the lock through EVM rollback, not this last line.
    }
}

// Isolates the guard's effect; intentionally leaves the unsafe ordering visible.
// A real protocol must assess every entry point and shared state, not just copy this lock.
contract LockOnlyBank is TeachingLock {
    function withdraw() external override nonReentrant {
        uint256 value = balances[msg.sender];
        require(value > 0, "no balance");
        (bool ok, ) = msg.sender.call{value: value}("");
        require(ok, "transfer failed");
        balances[msg.sender] = 0;
        emit Paid(msg.sender, value);
    }
}

// Retains the previous combined CEI + guard demonstration.
contract SafeBankWithLock is TeachingLock {
    function withdraw() external override nonReentrant {
        uint256 value = balances[msg.sender];
        require(value > 0, "no balance");
        balances[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: value}("");
        require(ok, "transfer failed");
        emit Paid(msg.sender, value);
    }
}

// Deploy only in a local/Remix VM, paired with the above teaching bank.
// Seed and withdraw are separate transactions so a failed withdrawal retains its claim.
contract BoundedReceiver {
    BankLedger public immutable bank;
    address public immutable owner;
    uint256 public receivedCount;
    uint256 public maxPayments;
    bool public catchFailure;
    bool public rejectReceive;
    event InnerFailure();
    modifier onlyOwner() { require(msg.sender == owner, "owner only"); _; }
    constructor(address target) { bank = BankLedger(target); owner = msg.sender; }
    function seed() external payable onlyOwner { bank.deposit{value: msg.value}(); }
    function attack(uint256 limit, bool caught, bool reject) external onlyOwner {
        require(limit >= 1 && limit <= 8, "limit 1..8");
        receivedCount = 0;
        maxPayments = limit;
        catchFailure = caught;
        rejectReceive = reject;
        bank.withdraw();
    }
    receive() external payable {
        require(msg.sender == address(bank), "bank only");
        require(!rejectReceive, "receiver rejects");
        receivedCount++;
        if (receivedCount < maxPayments) {
            if (catchFailure) {
                try bank.withdraw() {} catch { emit InnerFailure(); }
            } else { bank.withdraw(); }
        }
    }
}
