(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./amm.js"));
  else root.LPLab = factory(root.AMMLab);
})(globalThis, function (M) {
  "use strict";
  const S = M.SCALE;
  const BPS = 10000n;
  const ceil = (a, b) => (a + b - 1n) / b;
  function clone(s) {
    return {
      ...s,
      ...Object.fromEntries(
        ["pool", "wallet", "trader", "arbitrage", "market", "feeNumerator"].map(
          (k) => [k, { ...s[k] }],
        ),
      ),
      position: s.position
        ? {
            ...s.position,
            deposited: { ...s.position.deposited },
            received: s.position.received ? { ...s.position.received } : null,
          }
        : null,
    };
  }
  function createState(feeBps = 30) {
    if (![0, 30].includes(feeBps))
      throw new Error("实验费率只能为 0% 或 0.3%。");
    return {
      pool: { A: 1000n * S, B: 1000n * S },
      wallet: { A: 1000n * S, B: 1000n * S },
      trader: { A: 1000n * S, B: 1000n * S },
      arbitrage: { A: 0n, B: 10000n * S },
      market: { A: 100000n * S, B: 100000n * S },
      feeNumerator: { A: 0n, B: 0n },
      totalShares: 1000n * S,
      userShares: 0n,
      feeBps,
      price: S,
      position: null,
      lastArbitrage: null,
      revision: 0,
    };
  }
  function active(s) {
    if (!s.position || s.position.received)
      throw new Error("请先加入流动性；已退出的情景需要重置。");
  }
  function deposit(s, amount) {
    if (s.position)
      throw new Error("本实验每个情景只投入一次，请重置后重新比较。");
    if (
      typeof amount !== "bigint" ||
      amount < S ||
      amount > s.wallet.A ||
      amount > s.wallet.B
    )
      throw new Error("每种资产请投入 1 至 1000 个，且不超过钱包余额。");
    const next = clone(s);
    const shares = (amount * s.totalShares) / s.pool.A;
    next.pool.A += amount;
    next.pool.B += amount;
    next.wallet.A -= amount;
    next.wallet.B -= amount;
    next.userShares = shares;
    next.totalShares += shares;
    next.position = {
      deposited: { A: amount, B: amount },
      received: null,
      originalShares: shares,
      shareTotal: next.totalShares,
    };
    next.revision++;
    return next;
  }
  function swap(s, from, amount) {
    active(s);
    if (
      !["A", "B"].includes(from) ||
      typeof amount !== "bigint" ||
      amount <= 0n ||
      amount > s.trader[from]
    )
      throw new Error("交易方向或金额无效，或交易者余额不足。");
    const to = from === "A" ? "B" : "A";
    const out = M.quoteOutput(s.pool[from], s.pool[to], amount, s.feeBps);
    const next = clone(s);
    next.trader[from] -= amount;
    next.trader[to] += out;
    next.pool[from] += amount;
    next.pool[to] -= out;
    next.feeNumerator[from] += amount * BigInt(s.feeBps);
    next.revision++;
    return next;
  }
  function setPrice(s, price) {
    active(s);
    if (
      typeof price !== "bigint" ||
      ![S / 2n, S, 2n * S, 4n * S].includes(price)
    )
      throw new Error("请选择实验预设价格。");
    const next = clone(s);
    next.price = price;
    next.lastArbitrage = null;
    return next;
  }
  function sqrt(n) {
    if (n < 2n) return n;
    let x = n,
      y = (x + 1n) / 2n;
    while (y < x) {
      x = y;
      y = (x + n / x) / 2n;
    }
    return x;
  }
  function candidate(s, from) {
    const f = BPS - BigInt(s.feeBps);
    const x = s.pool[from],
      y = s.pool[from === "A" ? "B" : "A"];
    // Continuous profit derivative = 0, then round input to atomic units.
    const radicand =
      from === "A"
        ? (f * BPS * x * y * S) / s.price
        : (f * BPS * x * y * s.price) / S;
    const root = sqrt(radicand);
    if (root <= x * BPS) return null;
    let amount = (root - x * BPS) / f;
    const cap =
      from === "A"
        ? [(s.arbitrage.B * S) / s.price, s.market.A].reduce((a, b) =>
            a < b ? a : b,
          )
        : s.arbitrage.B;
    if (amount > cap) amount = cap;
    if (amount <= 0n) return null;
    let output;
    try {
      output = M.quoteOutput(x, y, amount, s.feeBps);
    } catch {
      return null;
    }
    const marketCash =
      from === "A" ? ceil(amount * s.price, S) : (output * s.price) / S;
    const profit = from === "A" ? output - marketCash : marketCash - amount;
    if (profit <= 0n || (from === "B" && marketCash > s.market.B)) return null;
    return { from, amount, output, marketCash, profit };
  }
  function arbitrage(s) {
    active(s);
    const options = [candidate(s, "A"), candidate(s, "B")].filter(Boolean);
    const best = options.sort((a, b) => (a.profit > b.profit ? -1 : 1))[0];
    if (!best)
      throw new Error(
        "当前没有扣除池子手续费后可盈利的套利候选，账本保持不变。",
      );
    const next = clone(s);
    const { from, amount, output, marketCash, profit } = best;
    if (from === "A") {
      next.arbitrage.B += profit;
      next.market.B += marketCash;
      next.market.A -= amount;
      next.pool.A += amount;
      next.pool.B -= output;
    } else {
      next.arbitrage.B += profit;
      next.market.B -= marketCash;
      next.market.A += output;
      next.pool.B += amount;
      next.pool.A -= output;
    }
    next.feeNumerator[from] += amount * BigInt(s.feeBps);
    next.lastArbitrage = best;
    next.revision++;
    return next;
  }
  function claim(s) {
    if (!s.position) return { A: 0n, B: 0n };
    if (s.position.received) return { ...s.position.received };
    return {
      A: (s.pool.A * s.userShares) / s.totalShares,
      B: (s.pool.B * s.userShares) / s.totalShares,
    };
  }
  function comparison(s) {
    if (!s.position) return null;
    const assets = claim(s);
    const held = s.position.deposited;
    const lpValue = (assets.A * s.price) / S + assets.B;
    const holdValue = (held.A * s.price) / S + held.B;
    return { assets, lpValue, holdValue, difference: lpValue - holdValue };
  }
  function withdraw(s) {
    active(s);
    const assets = claim(s);
    const next = clone(s);
    for (const t of ["A", "B"]) {
      next.pool[t] -= assets[t];
      next.wallet[t] += assets[t];
    }
    next.totalShares -= s.userShares;
    next.userShares = 0n;
    next.position.received = assets;
    next.revision++;
    return next;
  }
  return {
    createState,
    deposit,
    swap,
    setPrice,
    arbitrage,
    claim,
    comparison,
    withdraw,
  };
});
