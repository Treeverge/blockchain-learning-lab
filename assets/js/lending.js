(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./amm.js"));
  else root.LendingLab = factory(root.AMMLab);
})(globalThis, function (M) {
  "use strict";
  const S = M.SCALE;
  function createState() {
    return {
      price: 100n * S,
      poolCash: 0n,
      collateral: 0n,
      debt: 0n,
      deposits: 0n,
      badDebt: 0n,
      closed: false,
      revision: 0,
      settlement: null,
      wallets: {
        lender: { B: 10000n * S, C: 0n },
        borrower: { B: 0n, C: 4n * S },
        liquidator: { B: 1000n * S, C: 0n },
      },
    };
  }
  function clone(s) {
    return {
      ...s,
      wallets: Object.fromEntries(
        Object.entries(s.wallets).map(([k, v]) => [k, { ...v }]),
      ),
      settlement: s.settlement ? { ...s.settlement } : null,
    };
  }
  function open(s) {
    if (s.closed) throw new Error("本情景已结束，请重置后重新比较。");
  }
  function positive(amount) {
    if (typeof amount !== "bigint" || amount <= 0n)
      throw new Error("金额必须为正整数最小单位。");
  }
  function totals(s) {
    return {
      B:
        s.poolCash + Object.values(s.wallets).reduce((sum, w) => sum + w.B, 0n),
      C:
        s.collateral +
        Object.values(s.wallets).reduce((sum, w) => sum + w.C, 0n),
    };
  }
  function metrics(s) {
    const value = (s.collateral * s.price) / S;
    const maxBorrow = (s.collateral * s.price * 2n) / (3n * S);
    const health =
      s.debt === 0n
        ? null
        : (s.collateral * s.price * 8000n) / (s.debt * 10000n);
    const liquidatable =
      s.debt > 0n && s.collateral * s.price * 8000n < s.debt * S * 10000n;
    return {
      value,
      maxBorrow,
      availableBorrow: maxBorrow > s.debt ? maxBorrow - s.debt : 0n,
      health,
      liquidatable,
      recovery: s.poolCash + s.debt,
    };
  }
  function provide(s, amount) {
    open(s);
    positive(amount);
    if (amount > s.wallets.lender.B) throw new Error("存款人余额不足。");
    const n = clone(s);
    n.wallets.lender.B -= amount;
    n.poolCash += amount;
    n.deposits += amount;
    n.revision++;
    return n;
  }
  function pledge(s, amount) {
    open(s);
    positive(amount);
    if (amount > s.wallets.borrower.C) throw new Error("抵押资产余额不足。");
    const n = clone(s);
    n.wallets.borrower.C -= amount;
    n.collateral += amount;
    n.revision++;
    return n;
  }
  function borrow(s, amount) {
    open(s);
    positive(amount);
    if (s.debt + amount > metrics(s).maxBorrow)
      throw new Error("累计债务超过借款上限，请减少借款或增加抵押。");
    if (amount > s.poolCash)
      throw new Error("池子可用现金不足，请先提供流动性。");
    const n = clone(s);
    n.debt += amount;
    n.poolCash -= amount;
    n.wallets.borrower.B += amount;
    n.revision++;
    return n;
  }
  function setPrice(s, price) {
    open(s);
    positive(price);
    if (price < 10n * S || price > 200n * S)
      throw new Error("本实验价格范围为 10 至 200 B/C。");
    const n = clone(s);
    n.price = price;
    return n;
  }
  function repay(s, amount) {
    open(s);
    positive(amount);
    if (amount > s.debt) throw new Error("还款超过当前债务。");
    if (amount > s.wallets.borrower.B) throw new Error("借款人现金余额不足。");
    const n = clone(s);
    n.debt -= amount;
    n.poolCash += amount;
    n.wallets.borrower.B -= amount;
    n.revision++;
    if (n.debt === 0n) {
      const returned = n.collateral;
      n.wallets.borrower.C += returned;
      n.collateral = 0n;
      n.closed = true;
      n.settlement = {
        kind: "repayment",
        repaid: amount,
        seized: 0n,
        returned,
        badDebt: 0n,
      };
    }
    return n;
  }
  function liquidationTerms(s) {
    if (!metrics(s).liquidatable) return null;
    const maxRepay = (s.collateral * s.price * 10000n) / (S * 10500n);
    const repaid = maxRepay < s.debt ? maxRepay : s.debt;
    const calculated = (repaid * 10500n * S) / (s.price * 10000n);
    const seized =
      maxRepay < s.debt
        ? s.collateral
        : calculated < s.collateral
          ? calculated
          : s.collateral;
    return {
      kind: "liquidation",
      repaid,
      seized,
      returned: s.collateral - seized,
      badDebt: s.debt - repaid,
    };
  }
  function liquidate(s) {
    open(s);
    const terms = liquidationTerms(s);
    if (!terms) throw new Error("头寸健康，当前不能清算。");
    if (terms.repaid <= 0n || terms.repaid > s.wallets.liquidator.B)
      throw new Error("清算者现金余额不足或可还款额过低。");
    const n = clone(s);
    n.wallets.liquidator.B -= terms.repaid;
    n.wallets.liquidator.C += terms.seized;
    n.wallets.borrower.C += terms.returned;
    n.poolCash += terms.repaid;
    n.badDebt += terms.badDebt;
    n.collateral = 0n;
    n.debt = 0n;
    n.closed = true;
    n.settlement = terms;
    n.revision++;
    return n;
  }
  return {
    createState,
    totals,
    metrics,
    provide,
    pledge,
    borrow,
    setPrice,
    repay,
    liquidationTerms,
    liquidate,
  };
});
