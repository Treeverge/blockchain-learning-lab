// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal local-VM experiment, not a complete ERC-20 or a production wallet.
contract ExecutionLab {
    mapping(address => uint256) public balanceOf;
    uint256 public counter;
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Stored(uint256 value);

    constructor() { balanceOf[msg.sender] = 100; }

    function previewMemory(uint256 value) external view returns (uint256) {
        uint256[] memory temporary = new uint256[](1);
        temporary[0] = counter;
        temporary[0] = value;
        return temporary[0];
    }

    function store(uint256 value) external {
        counter = value;
        emit Stored(value);
    }

    function transferThenFail(address to, uint256 amount) external {
        require(to != address(0), "zero recipient");
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        counter += 1;
        emit Transfer(msg.sender, to, amount);
        revert("deliberate rollback");
    }
}
