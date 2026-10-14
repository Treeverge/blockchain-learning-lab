(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SecurityLab = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const names = ["Alice", "Bob", "Attacker"];
  function createState() {
    return {
      cash: 6n,
      claims: { Alice: 3n, Bob: 2n, Attacker: 1n },
      wallets: { Alice: 0n, Bob: 0n, Attacker: 0n },
      locked: false,
    };
  }
  function clone(s) {
    return {
      cash: s.cash,
      claims: { ...s.claims },
      wallets: { ...s.wallets },
      locked: s.locked,
    };
  }
  function totals(s) {
    const claims = names.reduce((v, n) => v + s.claims[n], 0n),
      assets = s.cash + names.reduce((v, n) => v + s.wallets[n], 0n);
    return { claims, assets, gap: claims > s.cash ? claims - s.cash : 0n };
  }
  function run(input, options = {}) {
    const {
      mode = "vulnerable",
      caller = "Attacker",
      maxPayouts = 6,
      catchFailure = true,
      receiverReject = false,
    } = options;
    if (
      !["vulnerable", "cei", "lock"].includes(mode) ||
      !names.includes(caller) ||
      !Number.isInteger(maxPayouts) ||
      maxPayouts < 1 ||
      maxPayouts > 8 ||
      typeof catchFailure !== "boolean" ||
      typeof receiverReject !== "boolean"
    )
      throw new Error("请选择有效场景；最多接收次数为1至8的整数。");
    if (
      typeof input.cash !== "bigint" ||
      input.cash < 0n ||
      typeof input.locked !== "boolean" ||
      names.some(
        (n) =>
          typeof input.claims[n] !== "bigint" ||
          input.claims[n] < 0n ||
          typeof input.wallets[n] !== "bigint" ||
          input.wallets[n] < 0n,
      )
    )
      throw new Error("账本格式不正确。");
    let state = clone(input),
      logs = [],
      payments = 0;
    const trace = [];
    const mark = (kind, text, depth) =>
      trace.push({ kind, text, depth, state: clone(state) });
    function withdraw(depth) {
      const before = clone(state),
        priorLogs = logs.length,
        priorPayments = payments;
      mark("enter", `${caller}进入 withdraw；读取债权。`, depth);
      try {
        if (mode === "lock") {
          if (state.locked) throw new Error("重入锁已占用");
          state.locked = true;
          mark("lock", "加锁：本次退出前不允许再次进入。", depth);
        }
        const value = state.claims[caller];
        if (value === 0n) throw new Error("债权已为0");
        if (mode === "cei") {
          state.claims[caller] = 0n;
          mark("effects", "先清零债权，再进行外部调用。", depth);
        }
        if (state.cash < value) throw new Error("银行实际资金不足");
        state.cash -= value;
        state.wallets[caller] += value;
        payments++;
        mark(
          "transfer",
          `转出 ${value} G；进入接收合约前，此转账仍可回滚。`,
          depth,
        );
        mark(
          "callback",
          caller === "Attacker"
            ? "Attacker.receive 获得控制权。"
            : "普通接收者，不尝试重入。",
          depth,
        );
        if (receiverReject) throw new Error("接收合约主动拒收");
        if (caller === "Attacker" && payments < maxPayouts) {
          mark("reenter", "回调再次调用 withdraw。", depth);
          try {
            withdraw(depth + 1);
          } catch (error) {
            if (!catchFailure)
              throw new Error("内层失败向外传播：" + error.message);
            mark(
              "caught",
              "回调捕获内层失败，继续正常返回：" + error.message,
              depth,
            );
          }
        }
        mark("return", "外部调用成功返回。", depth);
        if (mode !== "cei") {
          state.claims[caller] = 0n;
          mark("effects", "外部调用返回后，才清零债权。", depth);
        }
        if (mode === "lock") {
          state.locked = false;
          mark("unlock", "释放重入锁。", depth);
        }
        logs.push({ caller, value });
        mark("exit", "本层 withdraw 完成。", depth);
      } catch (error) {
        state = before;
        logs.length = priorLogs;
        payments = priorPayments;
        mark("rollback", "本层及其后代状态恢复：" + error.message, depth);
        throw error;
      }
    }
    mark("start", "初始快照：存款此前已完成，本次只执行提款。", 0);
    let success = true,
      reason = "提款提交成功";
    try {
      withdraw(1);
    } catch (error) {
      success = false;
      reason = error.message;
    }
    mark(
      "final",
      success
        ? "最终提交成功分支。"
        : "最终提款失败，恢复提款前状态；先前存款保留。",
      0,
    );
    return { state: clone(state), trace, logs, success, reason, payments };
  }
  return { createState, clone, totals, run };
});
