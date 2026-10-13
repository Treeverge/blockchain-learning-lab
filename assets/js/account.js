(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AccountLab = factory();
})(globalThis, function () {
  "use strict";
  const names = ["Alice", "Bob", "Eve"],
    costs = {
      transfer: 40000,
      approve: 30000,
      transferFrom: 50000,
      store: 35000,
      transferThenFail: 60000,
    },
    intrinsic = 21000;
  const person = (name) => {
    if (!names.includes(name)) throw new Error("请选择实验中的账户。");
  };
  const integer = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 1000000000;
  function copy(s) {
    return {
      accounts: Object.fromEntries(names.map((n) => [n, { ...s.accounts[n] }])),
      token: {
        ...s.token,
        balances: { ...s.token.balances },
        allowances: Object.fromEntries(
          names.map((n) => [n, { ...s.token.allowances[n] }]),
        ),
      },
      fees: s.fees,
      events: s.events.map((e) => ({ ...e })),
    };
  }
  function createState() {
    return {
      accounts: Object.fromEntries(
        names.map((n) => [n, { G: 1000000n, nonce: 0 }]),
      ),
      token: {
        supply: 150000000n,
        balances: { Alice: 100000000n, Bob: 50000000n, Eve: 0n },
        allowances: Object.fromEntries(
          names.map((n) => [n, Object.fromEntries(names.map((m) => [m, 0n]))]),
        ),
        counter: 0,
      },
      fees: 0n,
      events: [],
    };
  }
  function draft(s, fields) {
    person(fields.from);
    return {
      ...fields,
      nonce: fields.nonce ?? s.accounts[fields.from].nonce,
      gasLimit: fields.gasLimit ?? 70000,
      gasPrice: fields.gasPrice ?? 1n,
    };
  }
  function allowance(s, owner, spender) {
    person(owner);
    person(spender);
    return s.token.allowances[owner][spender];
  }
  function previewMemory(s, value) {
    if (!integer(value)) throw new Error("临时数值必须是 0 至 10 亿的整数。");
    return { temporary: value, stored: s.token.counter };
  }
  function execute(s, tx) {
    const receipt = {
      status: "rejected",
      included: false,
      gasUsed: 0,
      fee: 0n,
      maxBudget: 0n,
      reason: "",
      trace: [],
      logs: [],
    };
    try {
      if (!tx || !Object.hasOwn(costs, tx.kind))
        throw new Error("操作类型无效。");
      person(tx.from);
      if (
        !integer(tx.nonce) ||
        !integer(tx.gasLimit) ||
        typeof tx.gasPrice !== "bigint" ||
        tx.gasPrice <= 0n
      )
        throw new Error("nonce、执行上限或单价无效。");
      receipt.maxBudget = BigInt(tx.gasLimit) * tx.gasPrice;
      if (tx.kind === "store") {
        if (!integer(tx.value))
          throw new Error("存储数值必须是 0 至 10 亿的整数。");
      } else {
        if (
          typeof tx.amount !== "bigint" ||
          tx.amount < 0n ||
          (tx.kind !== "approve" && tx.amount === 0n)
        )
          throw new Error("数量无效；只有授权允许设为 0。");
        if (tx.kind === "approve") person(tx.spender);
        else person(tx.to);
        if (tx.kind === "transferFrom") person(tx.owner);
      }
      if (tx.nonce !== s.accounts[tx.from].nonce)
        throw new Error(
          tx.nonce < s.accounts[tx.from].nonce
            ? "nonce 已使用，当前执行拒绝重放。"
            : "nonce 尚未轮到，当前不能执行；真实网络可能先暂存。",
        );
      if (tx.gasLimit < intrinsic)
        throw new Error("执行上限低于本模型内在门槛 21000，纳入前拒绝。");
      if (s.accounts[tx.from].G < receipt.maxBudget)
        throw new Error("原生 G 余额不足以支付最大执行预算，纳入前拒绝。");
    } catch (e) {
      receipt.reason = e.message;
      return { state: copy(s), receipt };
    }
    const settled = copy(s),
      needed = costs[tx.kind];
    receipt.included = true;
    receipt.gasUsed = Math.min(tx.gasLimit, needed);
    receipt.fee = BigInt(receipt.gasUsed) * tx.gasPrice;
    settled.accounts[tx.from].G -= receipt.fee;
    settled.accounts[tx.from].nonce++;
    settled.fees += receipt.fee;
    if (tx.gasLimit < needed) {
      receipt.status = "out-of-gas";
      receipt.reason =
        "执行量超过 gasLimit：业务状态回滚，上限内费用与 nonce 已消耗。";
      receipt.trace.push("执行上限耗尽；业务结果不提交。");
      return { state: settled, receipt };
    }
    const scratch = copy(settled),
      logs = [];
    const move = (from, to, amount) => {
      if (scratch.token.balances[from] < amount)
        throw new Error("LAB 余额不足，合约检查失败。");
      scratch.token.balances[from] -= amount;
      scratch.token.balances[to] += amount;
      logs.push({ event: "Transfer", from, to, amount });
      receipt.trace.push(
        `临时写入：${from} → ${to}，${amount} 最小单位 LAB；临时 Transfer 日志。`,
      );
    };
    try {
      if (tx.kind === "approve") {
        scratch.token.allowances[tx.from][tx.spender] = tx.amount;
        logs.push({
          event: "Approval",
          from: tx.from,
          to: tx.spender,
          amount: tx.amount,
        });
        receipt.trace.push("临时写入授权额度，不转移 LAB。");
      } else if (tx.kind === "store") {
        scratch.token.counter = tx.value;
        logs.push({ event: "Stored", value: tx.value });
        receipt.trace.push(`临时写入 counter = ${tx.value}。`);
      } else if (tx.kind === "transferFrom") {
        if (allowance(scratch, tx.owner, tx.from) < tx.amount)
          throw new Error("授权额度不足，合约检查失败。");
        scratch.token.allowances[tx.owner][tx.from] -= tx.amount;
        move(tx.owner, tx.to, tx.amount);
      } else {
        move(tx.from, tx.to, tx.amount);
        if (tx.kind === "transferThenFail") {
          scratch.token.counter++;
          receipt.trace.push(`临时写入 counter = ${scratch.token.counter}。`);
          throw new Error("主动回滚：转账、counter 与日志全部撤销。");
        }
      }
      receipt.status = "success";
      receipt.reason = "执行成功，业务状态与日志已提交。";
      receipt.logs = logs;
      scratch.events.push(...logs);
      receipt.trace.push("执行成功，提交业务结果。");
      return { state: scratch, receipt };
    } catch (e) {
      receipt.status = "reverted";
      receipt.reason = e.message;
      receipt.trace.push(
        "业务回滚；临时日志不进入回执，已消耗费用与 nonce 保留。",
      );
      return { state: settled, receipt };
    }
  }
  const totals = (s) => ({
    G: names.reduce((sum, n) => sum + s.accounts[n].G, s.fees),
    LAB: names.reduce((sum, n) => sum + s.token.balances[n], 0n),
  });
  return {
    createState,
    draft,
    execute,
    allowance,
    previewMemory,
    totals,
    costs,
    intrinsic,
  };
});
