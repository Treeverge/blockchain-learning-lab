// SPDX-License-Identifier: MIT
// ======================================================================
// Day 4 — 第二部分：ERC-20 代币合约
// ======================================================================
//
// 你要理解的核心：这是一个可部署的教学代币合约，不等于完整货币系统。
// 部署代码容易；权限、安全、合规与流通规则不能靠这个例子证明。
//
// Solidity 和 C++ 的对应关系（帮你理解）:
//   contract     ≈  class（类）
//   mapping      ≈  std::unordered_map（哈希表）
//   struct       ≈  struct（结构体）
//   event        ≈  没有直接对应 — 是写入区块链日志的一条记录
//   modifier     ≈  没有直接对应 — 是函数执行前的前置检查
//   require()    ≈  assert() 或 if (!x) throw;
//   msg.sender   ≈  调用者的地址（谁触发这笔交易的）
//   constructor  ≈  构造函数
//
// ERC-20 标准定义了 6 个函数 + 2 个事件:
//   totalSupply()  →  总共发行了多少代币
//   balanceOf()    →  查某个地址的余额
//   transfer()     →  转账
//   approve()      →  授权别人花你的代币
//   allowance()    →  查授权额度
//   transferFrom() →  代替别人转账（需要授权）
//   Transfer       →  转账事件（区块链浏览器监听这个）
//   Approval       →  授权事件
//
// 对比你 Day 3 学的比特币:
//   部分比特币地址编码公钥哈希；另一些编码脚本条件，不是只能收钱。
//   传统以太坊外部账户地址取公钥 Keccak-256 摘要的最后20字节；不是公钥直接截断。
//
// 运行方式: 把这段代码复制到 Remix IDE (https://remix.ethereum.org)
//          编译 → 部署到 Remix VM → 交互测试
// ======================================================================

pragma solidity ^0.8.20;

// IERC20 接口 — 定义了"什么是 ERC-20 代币"
// 类似于 C++ 的纯虚类 (abstract class)
interface IERC20 {
    // 总供应量
    function totalSupply() external view returns (uint256);

    // 查余额 — 类似 unordered_map<address, uint256>[addr]
    function balanceOf(address account) external view returns (uint256);

    // 转账 — 从 msg.sender 转给 to
    function transfer(address to, uint256 amount) external returns (bool);

    // 查授权额度 — owner 授权给 spender 多少钱
    function allowance(address owner, address spender) external view returns (uint256);

    // 授权 — 你允许 spender 花你 amount 个代币
    function approve(address spender, uint256 amount) external returns (bool);

    // 代转 — spender 代替 owner 转给 to
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // 事件 — 记录到链上日志，区块链浏览器（如 Etherscan）靠这个追踪交易
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}


// ================================================================
// MyToken — 实现核心 ERC-20 接口的可部署教学代币
// ================================================================
contract MyToken is IERC20 {
    // --- 状态变量（链上存储） ----------------------------------------
    // 这些变量存在合约的存储空间里，永久保存，修改需要消耗 Gas

    // 代币名称 — 比如 "My Token"
    string public name;

    // 代币符号 — 比如 "MTK"（交易对里显示的东西）
    string public symbol;

    // 小数位数 — 此代币选择18位；ERC-20代币也可以选择其他精度
    // 1 个代币 = 10^18 个最小单位
    uint8 public decimals;

    // 总供应量（最小单位） — 比如发了 1000 个代币就是 1000 * 10^18
    uint256 private _totalSupply;

    // 每个地址的余额 — 相当于 unordered_map<address, uint256>
    // mapping 的 key 是 address（20 字节），value 是 uint256（32 字节）
    mapping(address => uint256) private _balances;

    // 授权额度 — 一个二维映射
    // _allowances[owner][spender] = spender 能代 owner 花的金额
    // 相当于 unordered_map<address, unordered_map<address, uint256>>
    mapping(address => mapping(address => uint256)) private _allowances;

    // --- 构造函数 ----------------------------------------------------
    // 部署时执行一次，类似 C++ 构造函数
    // 部署合约的人（msg.sender）获得所有初始代币
    constructor(string memory _name, string memory _symbol, uint256 initialSupply) {
        _deployer = msg.sender;
        name = _name;
        symbol = _symbol;
        decimals = 18;  // 1 个代币 = 10^18 最小单位

        // 初始供应量 = initialSupply * 10^18（转成最小单位）
        _totalSupply = initialSupply * (10 ** uint256(decimals));

        // 把所有代币发给部署者
        _balances[msg.sender] = _totalSupply;

        // 发出 Transfer 事件（从零地址 → 部署者 = 铸币）
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    // --- ERC-20 标准函数 ----------------------------------------------

    // totalSupply() — 返回总供应量
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    // balanceOf(account) — 查某地址余额
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    // transfer(to, amount) — 转账
    // 这是最常用的函数：从你的地址转给别人的地址
    function transfer(address to, uint256 amount) external override returns (bool) {
        // require 相当于 C++ 的 assert，不满足就回滚整个交易
        require(to != address(0), "ERC20: cannot transfer to zero address");
        require(_balances[msg.sender] >= amount, "ERC20: insufficient balance");

        // 原子操作：同时更新两个余额，要么全成功，要么全回滚
        _balances[msg.sender] -= amount;
        _balances[to] += amount;

        // 发出事件通知
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    // allowance(owner, spender) — 查授权额度
    function allowance(address owner, address spender)
        external view override returns (uint256)
    {
        return _allowances[owner][spender];
    }

    // approve(spender, amount) — 授权
    // "我允许 spender 替我花 amount 个代币"
    function approve(address spender, uint256 amount) external override returns (bool) {
        require(spender != address(0), "ERC20: cannot approve zero address");

        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    // transferFrom(from, to, amount) — 代转
    // spender(msg.sender) 代替 from 转给 to
    // 前提：from 已经用 approve() 授权给 spender 足够额度
    function transferFrom(address from, address to, uint256 amount)
        external override returns (bool)
    {
        require(from != address(0), "ERC20: transfer from zero address");
        require(to != address(0), "ERC20: transfer to zero address");
        require(_balances[from] >= amount, "ERC20: insufficient balance");

        // 检查授权额度是否够
        uint256 currentAllowance = _allowances[from][msg.sender];
        require(currentAllowance >= amount, "ERC20: insufficient allowance");

        // 扣余额
        _balances[from] -= amount;
        _balances[to] += amount;

        // 减授权额度（防止被滥用）
        _allowances[from][msg.sender] = currentAllowance - amount;

        emit Transfer(from, to, amount);
        return true;
    }

    // --- 额外功能（非 ERC-20 标准，但常用） ---------------------------

    // 记住部署者地址（mint 的权限控制）
    address private immutable _deployer;

    // mint — 铸造新代币（只有合约部署者能调用）
    // 这就是"印钱"功能
    function mint(address to, uint256 amount) external {
        // 限制：只有部署者能铸币
        // 真实项目中这里会用 OpenZeppelin 的 Ownable 或 access control
        require(msg.sender == _deployer, "ERC20: only deployer can mint");
        require(to != address(0), "ERC20: cannot mint to zero address");

        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // burn — 销毁代币（你自己销毁自己的）
    function burn(uint256 amount) external {
        require(_balances[msg.sender] >= amount, "ERC20: insufficient balance");

        _balances[msg.sender] -= amount;
        _totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }
}


// ================================================================
// 怎么在 Remix 里跑这个合约？
// ================================================================
//
// 1. 打开 https://remix.ethereum.org
// 2. 左边 File Explorer → 新建 MyToken.sol → 粘贴这份代码
// 3. 左边 Solidity Compiler (绿色 S) → 选 0.8.20+ → Compile
// 4. 左边 Deploy & Run (以太坊图标):
//      Environment: "Remix VM (Shanghai)"（模拟链，不上真实网络）
//      Account: 选一个测试地址（每个有 100 ETH 测试币）
// 5. Deploy 旁边填参数: _name="MyToken", _symbol="MTK", initialSupply=1000
// 6. 点 Deploy（橙色按钮）
//
// 部署后在 "Deployed Contracts" 下面你会看到:
//   - balanceOf — 输入你的地址，查余额 → 应该显示 1000000000000000000000
//     （1000 * 10^18，因为 decimals=18）
//   - transfer — 输入另一个地址和金额（注意最小单位），点 transact
//   - 再用 balanceOf 查 → 余额变了！
//
// 试着:
//   1. 部署合约，查余额
//   2. transfer 给另一个 Remix 地址 100 * 10^18（100 个代币）
//   3. 查对方余额
//   4. approve 授权 → transferFrom 代转
//
// ================================================================
// C++ 程序员视角的关键概念
// ================================================================
//
// 1. storage vs memory:
//    在 Solidity 里，数据存在两个地方：
//      storage  → 链上永久存储（类似写入数据库），修改花 Gas
//      memory   → 仅在本次执行期间存在；读写与扩展内存仍消耗 Gas
//    对比 C++: storage ≈ 写入磁盘的文件, memory ≈ 栈上的局部变量
//
// 2. Gas:
//    执行指令消耗 Gas；存储费用随旧值、新值、访问状态和协议规则变化，不能固定估价。
//
// 3. msg.sender:
//    谁触发这笔交易的。这是一个全局变量，你不需要声明。
//    对比比特币: msg.sender ≈ 用公钥做签名的那个"人"
//
// 4. 不可变 (immutable):
//    类似 C++ 的 const，但能在构造函数里赋值一次，之后永远不能改。
//    immutable 变量不占用 storage，Gas 更便宜。
//
// 5. view / pure:
//    view    → 不修改状态；链外 eth_call 不提交交易费用，合约内调用仍消耗 Gas
//    pure    → 连读都不读，纯计算
//    没标记 → 会修改链上数据，调用要花 Gas + 发交易
//
// 6. 交易 vs 调用:
//    写操作（transfer, approve 等）→ 需要发交易 → 花 Gas → 等矿工确认
//    链外读取（balanceOf等）→ 通常用eth_call，不提交状态；服务提供者也可能有访问配额
//
//    这和比特币的差别很大：
//      比特币交易消费输出并创建输出，可包含脚本条件。
//      以太坊交易可转移原生资产、部署合约或调用代码，不是全部都调用函数。
// ================================================================
