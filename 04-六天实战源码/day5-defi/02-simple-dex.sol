// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice 教学用内部余额账本，不是真实 ERC-20 DEX，不用于真实资产。
/// 每个代币使用 6 位小数；100 A = 100000000 最小单位。
contract SimpleDEX {
    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public totalShares;
    uint256 public mintedA;
    uint256 public mintedB;
    uint256 public constant MAX_SUPPLY = 1e24;
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    mapping(address => uint256) public balanceA;
    mapping(address => uint256) public balanceB;
    mapping(address => uint256) public lpShares;

    event Swap(address indexed trader, bool aToB, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed provider, uint256 a, uint256 b, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 a, uint256 b, uint256 shares);

    function faucetA(uint256 amount) external {
        require(amount > 0 && amount <= MAX_SUPPLY - mintedA, "faucet limit");
        mintedA += amount;
        balanceA[msg.sender] += amount;
    }
    function faucetB(uint256 amount) external {
        require(amount > 0 && amount <= MAX_SUPPLY - mintedB, "faucet limit");
        mintedB += amount;
        balanceB[msg.sender] += amount;
    }
    function k() external view returns (uint256) { return reserveA * reserveB; }

    // 纯报价方便用同一组测试向量核对 Python、JS 和 Solidity。
    function quoteOutput(uint256 x, uint256 y, uint256 amountIn, uint256 feeBps) public pure returns (uint256 out) {
        require(x > 0 && y > 0 && amountIn > 0, "empty pool or zero input");
        require(x <= MAX_SUPPLY && y <= MAX_SUPPLY && amountIn <= MAX_SUPPLY && feeBps < 10000, "quote limit");
        uint256 effective = amountIn * (10000 - feeBps);
        out = effective * y / (x * 10000 + effective);
        require(out > 0, "zero output");
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external returns (uint256 shares) {
        require(amountA > 0 && amountB > 0, "zero amount");
        require(balanceA[msg.sender] >= amountA && balanceB[msg.sender] >= amountB, "insufficient balance");
        if (totalShares == 0) {
            uint256 root = sqrt(amountA * amountB);
            require(root > MINIMUM_LIQUIDITY, "initial liquidity too small");
            totalShares = MINIMUM_LIQUIDITY;
            lpShares[address(0)] = MINIMUM_LIQUIDITY;
            shares = root - MINIMUM_LIQUIDITY;
        } else {
            // 本教学版要求严格按比例投入，不自动找零；真实路由器通常处理多余输入。
            require(amountA * reserveB == amountB * reserveA, "deposit proportionally");
            shares = amountA * totalShares / reserveA;
            uint256 sharesB = amountB * totalShares / reserveB;
            if (sharesB < shares) shares = sharesB;
        }
        require(shares > 0, "zero shares");
        balanceA[msg.sender] -= amountA;
        balanceB[msg.sender] -= amountB;
        reserveA += amountA;
        reserveB += amountB;
        lpShares[msg.sender] += shares;
        totalShares += shares;
        emit LiquidityAdded(msg.sender, amountA, amountB, shares);
    }

    function removeLiquidity(uint256 shares) external returns (uint256 amountA, uint256 amountB) {
        require(shares > 0 && shares <= lpShares[msg.sender], "invalid shares");
        amountA = shares * reserveA / totalShares;
        amountB = shares * reserveB / totalShares;
        require(amountA > 0 && amountB > 0, "zero withdrawal");
        lpShares[msg.sender] -= shares;
        totalShares -= shares;
        reserveA -= amountA;
        reserveB -= amountB;
        balanceA[msg.sender] += amountA;
        balanceB[msg.sender] += amountB;
        emit LiquidityRemoved(msg.sender, amountA, amountB, shares);
    }

    function swapAtoB(uint256 amountIn, uint256 minOut) external returns (uint256 out) {
        require(balanceA[msg.sender] >= amountIn, "insufficient A");
        out = quoteOutput(reserveA, reserveB, amountIn, 30);
        require(out >= minOut, "below minimum output");
        balanceA[msg.sender] -= amountIn;
        balanceB[msg.sender] += out;
        reserveA += amountIn; // 完整输入入池，手续费留在储备中。
        reserveB -= out;
        emit Swap(msg.sender, true, amountIn, out);
    }
    function swapBtoA(uint256 amountIn, uint256 minOut) external returns (uint256 out) {
        require(balanceB[msg.sender] >= amountIn, "insufficient B");
        out = quoteOutput(reserveB, reserveA, amountIn, 30);
        require(out >= minOut, "below minimum output");
        balanceB[msg.sender] -= amountIn;
        balanceA[msg.sender] += out;
        reserveB += amountIn;
        reserveA -= out;
        emit Swap(msg.sender, false, amountIn, out);
    }
    function getAmountBOut(uint256 amountIn) external view returns (uint256) {
        return quoteOutput(reserveA, reserveB, amountIn, 30);
    }
    function getPrice() external view returns (uint256) {
        require(reserveA > 0, "empty pool");
        return reserveB * 1e18 / reserveA;
    }
    function sqrt(uint256 value) private pure returns (uint256 result) {
        if (value == 0) return 0;
        result = value;
        uint256 next = (value + 1) / 2;
        while (next < result) { result = next; next = (value / next + next) / 2; }
    }
}

// Remix VM 操作：faucetA(10000000000)、faucetB(10000000000)
// addLiquidity(1000000000, 1000000000)
// getAmountBOut(100000000) => 90661089（90.661089 B）
// swapAtoB(100000000, 90207758)；minOut 采用 0.5% 容忍度。
// 查询 lpShares，再 removeLiquidity 部分份额，观察留池手续费如何体现。
// quoteOutput 可核对 tests/amm-vectors.json；无需连接钱包或测试网。
