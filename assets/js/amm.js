(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AMMLab = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const SCALE = 1000000n;
  const BPS = 10000n;
  function parseAmount(value) {
    const text = String(value).trim();
    if (!/^\d+(\.\d{1,6})?$/.test(text))
      throw new Error("请输入正数，最多保留 6 位小数，不使用科学计数法。");
    const [whole, part = ""] = text.split(".");
    const amount = BigInt(whole) * SCALE + BigInt(part.padEnd(6, "0"));
    if (amount <= 0n) throw new Error("金额必须大于零。");
    if (amount > 1000000000000n * SCALE)
      throw new Error("金额超过实验上限（1 万亿）。");
    return amount;
  }
  function formatAmount(amount) {
    const sign = amount < 0n ? "-" : "";
    const n = amount < 0n ? -amount : amount;
    const fraction = String(n % SCALE)
      .padStart(6, "0")
      .replace(/0+$/, "");
    return sign + String(n / SCALE) + (fraction ? "." + fraction : "");
  }
  function checkBps(value, max = 9999) {
    if (!Number.isInteger(value) || value < 0 || value > max)
      throw new Error("无效的费率或容忍度。");
  }
  function quoteOutput(x, y, input, feeBps = 30) {
    checkBps(feeBps);
    if (
      typeof x !== "bigint" ||
      typeof y !== "bigint" ||
      typeof input !== "bigint" ||
      x <= 0n ||
      y <= 0n ||
      input <= 0n
    )
      throw new Error("储备和输入金额必须大于零。");
    const effective = input * (BPS - BigInt(feeBps));
    const output = (effective * y) / (x * BPS + effective);
    if (output <= 0n) throw new Error("输出舍入后为零，请增加输入金额。");
    return output;
  }
  function createState(size = "1000", feeBps = 30) {
    checkBps(feeBps);
    const reserve = parseAmount(size);
    return {
      pool: { A: reserve, B: reserve },
      wallet: { A: 1000n * SCALE, B: 1000n * SCALE },
      other: { A: 1000n * SCALE, B: 1000n * SCALE },
      feeBps,
      revision: 0,
    };
  }
  function pair(direction) {
    if (direction !== "A" && direction !== "B")
      throw new Error("无效的交易方向。");
    return [direction, direction === "A" ? "B" : "A"];
  }
  function makeQuote(state, direction, input, slippageBps = 50) {
    checkBps(slippageBps, 10000);
    const [from, to] = pair(direction);
    if (input > state.wallet[from]) throw new Error("钱包余额不足。");
    const output = quoteOutput(
      state.pool[from],
      state.pool[to],
      input,
      state.feeBps,
    );
    return Object.freeze({
      direction,
      input,
      output,
      minOutput: (output * (BPS - BigInt(slippageBps))) / BPS,
      revision: state.revision,
      feeBps: state.feeBps,
    });
  }
  function trade(state, direction, input, minOutput, actor) {
    const [from, to] = pair(direction);
    if (input <= 0n || input > state[actor][from])
      throw new Error("交易者余额不足或金额无效。");
    const output = quoteOutput(
      state.pool[from],
      state.pool[to],
      input,
      state.feeBps,
    );
    if (output < minOutput)
      throw new Error("当前输出低于最小接收量，交易已拒绝，原交易没有扣款。");
    const next = {
      ...state,
      pool: { ...state.pool },
      wallet: { ...state.wallet },
      other: { ...state.other },
      revision: state.revision + 1,
    };
    next.pool[from] += input;
    next.pool[to] -= output;
    next[actor][from] -= input;
    next[actor][to] += output;
    return {
      state: next,
      output,
      from,
      to,
      input,
      fee: (input * BigInt(state.feeBps)) / BPS,
      actor,
    };
  }
  function execute(state, quote) {
    if (!quote || quote.feeBps !== state.feeBps)
      throw new Error("实验配置已变化，请重新报价。");
    return trade(
      state,
      quote.direction,
      quote.input,
      quote.minOutput,
      "wallet",
    );
  }
  function intervene(state, direction, input) {
    return trade(state, direction, input, 0n, "other");
  }
  return {
    SCALE,
    parseAmount,
    formatAmount,
    quoteOutput,
    createState,
    makeQuote,
    execute,
    intervene,
  };
});
