"use strict";
(() => {
  const M = window.AMMLab,
    L = window.LendingLab,
    $ = (id) => document.getElementById(id),
    fmt = M.formatAmount;
  let state = L.createState(),
    step = 0;
  const initial = L.totals(state);
  const lessons = [
    [
      "资金来源",
      "智能合约的钱，也是别人存进来的。",
      "存款人持有 10000 B，借款人持有 4 C，清算者持有 1000 B。池子从空账本开始。",
    ],
    [
      "抵押借款",
      "先锁定资产，再从池子里借出现金。",
      "数量、价格和价值是三件事。新增借款使用累计债务检查抵押上限。",
    ],
    [
      "价格风险",
      "只改变价格，健康因子为什么变了？",
      "抵押数量没有变，但抵押价值变了。健康因子低于 1 时可清算，并不意味着已经发生资金转移。",
    ],
    [
      "补救操作",
      "补抵押或还款，能恢复到安全一侧吗？",
      "在清算发生前增加抵押，或使用真实钱包余额减少债务。每个操作都需要资产来源。",
    ],
    [
      "清算损失",
      "清算者实际付款，抵押不足的缺口还在。",
      "先查看预估，再执行清算。对照清算者余额、借款人剩余抵押和存款人的回收缺口。",
    ],
  ];
  function animate(elements) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.getAnimations().forEach((a) => a.cancel());
      return;
    }
    elements.forEach((e) => {
      e.getAnimations().forEach((a) => a.cancel());
      e.animate(
        [{ backgroundColor: "#d9e7ff" }, { backgroundColor: "transparent" }],
        { duration: 650, easing: "ease-out" },
      );
    });
  }
  function select(index) {
    step = index;
    document.querySelectorAll("[data-borrow-step]").forEach((b) => {
      if (Number(b.dataset.borrowStep) === index)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    ["fund", "open", "price", "rescue", "liquidate"].forEach(
      (p, i) => ($("borrow-" + p + "-panel").hidden = i !== index),
    );
    $("borrow-step-label").textContent = `0${index + 1} / ${lessons[index][0]}`;
    $("borrow-control-title").textContent = lessons[index][0];
    $("borrow-step-title").textContent = lessons[index][1];
    $("borrow-step-description").textContent = lessons[index][2];
    $("borrow-progress").textContent = `第 ${index + 1} / 5 步`;
    $("borrow-prev").disabled = index === 0;
    $("borrow-next").disabled = index === 4 || state.deposits === 0n;
    animate([document.querySelector(".lesson-intro")]);
  }
  function status(text, error = false) {
    $("borrow-status").textContent = text;
    $("borrow-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function render() {
    const m = L.metrics(state),
      terms =
        state.settlement?.kind === "liquidation"
          ? state.settlement
          : L.liquidationTerms(state),
      closed = state.closed;
    $("borrow-position-tag").textContent = closed
      ? state.settlement.kind === "liquidation"
        ? "已清算 · 情景冻结"
        : "已偿清 · 情景冻结"
      : state.debt > 0n
        ? "有借款"
        : "尚未借款";
    $("borrow-revision").textContent = "资产操作 " + state.revision + " 次";
    $("borrow-lender-cash").textContent = fmt(state.wallets.lender.B);
    $("borrow-free-collateral").textContent = fmt(state.wallets.borrower.C);
    $("borrow-health").textContent = m.health === null ? "—" : fmt(m.health);
    $("borrow-health-status").textContent = closed
      ? "头寸已关闭"
      : m.health === null
        ? "无债务"
        : m.liquidatable
          ? "可清算"
          : m.health === M.SCALE
            ? "边界 · 当前不可清算"
            : "健康";
    $("borrow-health-card").classList.toggle("at-risk", m.liquidatable);
    $("borrow-health-fill").style.width =
      m.health === null
        ? "0%"
        : Math.min(100, (Number(m.health) / Number(M.SCALE) / 2) * 100) + "%";
    for (const [id, value, unit] of [
      ["borrow-locked", state.collateral, "C"],
      ["borrow-unit-price", state.price, "B/C"],
      ["borrow-value", m.value, "B"],
      ["borrow-debt", state.debt, "B"],
      ["borrow-max", m.maxBorrow, "B"],
      ["borrow-pool-cash", state.poolCash, "B"],
      ["borrow-wallet-cash", state.wallets.borrower.B, "B"],
    ])
      $(id).textContent = fmt(value) + " " + unit;
    $("borrow-price").value = fmt(state.price);
    $("borrow-price-label").textContent = fmt(state.price);
    $("borrow-provide").disabled = closed || state.wallets.lender.B === 0n;
    for (const id of ["borrow-pledge", "borrow-topup"])
      $(id).disabled = closed || state.wallets.borrower.C === 0n;
    $("borrow-take").disabled =
      closed || state.collateral === 0n || state.poolCash === 0n;
    for (const id of ["borrow-repay", "borrow-repay-all"])
      $(id).disabled = closed || state.debt === 0n;
    $("borrow-price").disabled = closed;
    for (const id of [
      "borrow-fund-amount",
      "borrow-collateral-input",
      "borrow-debt-input",
      "borrow-topup-input",
      "borrow-repay-input",
    ])
      $(id).disabled = closed;
    $("borrow-preview-label").textContent =
      state.settlement?.kind === "liquidation"
        ? "本次清算结果"
        : "执行前的清算预估";
    document
      .querySelectorAll("[data-price]")
      .forEach((b) => (b.disabled = closed));
    $("borrow-liquidate").disabled =
      closed ||
      !terms ||
      terms.repaid > state.wallets.liquidator.B ||
      terms.repaid === 0n;
    $("borrow-eligibility").textContent = closed
      ? "本情景已结束。重置可比较其他处理方式。"
      : terms
        ? "健康因子低于 1，可以执行清算。借款人若未及时补救，清算者可提交交易。"
        : "当前不能清算。可以回到价格步骤降低价格，或观察还款如何使头寸恢复健康。";
    for (const [id, key, unit] of [
      ["borrow-preview-repaid", "repaid", "B"],
      ["borrow-preview-seized", "seized", "C"],
      ["borrow-preview-returned", "returned", "C"],
      ["borrow-preview-bad", "badDebt", "B"],
    ])
      $(id).textContent = terms ? fmt(terms[key]) + " " + unit : "—";
    $("borrow-outcome").hidden = state.deposits === 0n;
    $("borrow-deposit-value").textContent = fmt(state.deposits) + " B";
    $("borrow-book-value").textContent = fmt(m.recovery) + " B";
    $("borrow-bad-debt").textContent = fmt(state.badDebt) + " B";
    $("borrow-bad-debt").className = state.badDebt > 0n ? "value-negative" : "";
    $("borrow-outcome-title").textContent = closed
      ? "头寸已关闭：现金与损失分别留下记录"
      : "存款人的债权，能收回多少？";
    $("borrow-outcome-note").textContent =
      state.badDebt > 0n
        ? `抵押与奖励约束下，未收回的 ${fmt(state.badDebt)} B 已确认坏账。存款人债权没有自动减少，但池子可回收资产存在缺口。`
        : "现金 + 未偿债务 + 坏账 = 存款。未偿债务是债权，不是可立即提取的现金，也不保证全额回收。";
    $("borrow-settlement").hidden = !state.settlement;
    if (state.settlement) {
      const t = state.settlement;
      $("borrow-settlement").textContent =
        t.kind === "liquidation"
          ? `清算者支付 ${fmt(t.repaid)} B，取得 ${fmt(t.seized)} C；退回借款人 ${fmt(t.returned)} C。清算者按参考价计的差额为 ${fmt((t.seized * state.price) / M.SCALE - t.repaid)} B，尚未模拟卖出。`
          : `已偿清债务，退回 ${fmt(t.returned)} C。部分还款的资金转移也已计入池子。`;
    }
    $("borrow-audit").replaceChildren();
    const rows = [
      ["存款人", state.wallets.lender.C, state.wallets.lender.B],
      ["借款人钱包", state.wallets.borrower.C, state.wallets.borrower.B],
      ["锁定抵押", state.collateral, 0n],
      ["池子现金", 0n, state.poolCash],
      ["清算者", state.wallets.liquidator.C, state.wallets.liquidator.B],
    ];
    rows.forEach(([name, c, b]) => {
      const tr = document.createElement("tr"),
        th = document.createElement("th");
      th.scope = "row";
      th.textContent = name;
      tr.append(th);
      for (const amount of [c, b]) {
        const td = document.createElement("td");
        td.textContent = fmt(amount);
        tr.append(td);
      }
      $("borrow-audit").append(tr);
    });
    const total = L.totals(state);
    $("borrow-total-c").textContent = fmt(total.C);
    $("borrow-total-b").textContent = fmt(total.B);
    $("borrow-conservation").textContent =
      total.C === initial.C && total.B === initial.B
        ? "C、B 总量分别守恒 · 债务未重复计入现金"
        : "对账异常，请重置";
    $("borrow-next").disabled = step === 4 || state.deposits === 0n;
  }
  function action(fn, message, transfer) {
    try {
      const before = state;
      state = fn();
      render();
      status(typeof message === "function" ? message() : message);
      if (transfer) {
        $("borrow-transfer").hidden = false;
        $("borrow-transfer-text").textContent =
          typeof transfer === "function" ? transfer() : transfer;
      }
      const changed = [];
      if (before.debt !== state.debt) changed.push($("borrow-debt"));
      if (before.poolCash !== state.poolCash)
        changed.push($("borrow-pool-cash"));
      if (before.wallets.borrower.B !== state.wallets.borrower.B)
        changed.push($("borrow-wallet-cash"));
      if (before.collateral !== state.collateral)
        changed.push($("borrow-locked"));
      if (
        before.price !== state.price ||
        before.collateral !== state.collateral
      )
        changed.push($("borrow-value"));
      if (
        before.price !== state.price ||
        before.collateral !== state.collateral ||
        before.debt !== state.debt
      )
        changed.push($("borrow-health"));
      animate(changed);
    } catch (e) {
      status(e.message, true);
    }
  }
  document
    .querySelectorAll("[data-borrow-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.borrowStep))),
    );
  $("borrow-prev").addEventListener("click", () =>
    select(Math.max(0, step - 1)),
  );
  $("borrow-next").addEventListener("click", () =>
    select(Math.min(4, step + 1)),
  );
  $("borrow-provide").addEventListener("click", () => {
    const amount = $("borrow-fund-amount").value;
    action(
      () => L.provide(state, M.parseAmount(amount)),
      "现金已进入池子，可以继续锁定抵押和借款。",
      `存款人 → 池子：${amount} B。`,
    );
  });
  function pledge(id) {
    const amount = $(id).value;
    action(
      () => L.pledge(state, M.parseAmount(amount)),
      "抵押已锁定，重新检查借款上限与健康因子。",
      `借款人钱包 → 锁定抵押：${amount} C。`,
    );
  }
  $("borrow-pledge").addEventListener("click", () =>
    pledge("borrow-collateral-input"),
  );
  $("borrow-topup").addEventListener("click", () =>
    pledge("borrow-topup-input"),
  );
  $("borrow-take").addEventListener("click", () => {
    const amount = $("borrow-debt-input").value;
    action(
      () => L.borrow(state, M.parseAmount(amount)),
      "借款成功：钱包收到现金，债务记录增加，两者不能重复计入资产。",
      `池子 → 借款人钱包：${amount} B；债务记录增加同额。`,
    );
  });
  function price(value) {
    action(
      () => L.setPrice(state, M.parseAmount(value)),
      "只更新了参考价格；资产数量和现金余额没有改变。",
    );
  }
  $("borrow-price").addEventListener("input", (e) => price(e.target.value));
  document
    .querySelectorAll("[data-price]")
    .forEach((b) => b.addEventListener("click", () => price(b.dataset.price)));
  $("borrow-repay").addEventListener("click", () => {
    const amount = $("borrow-repay-input").value;
    action(
      () => L.repay(state, M.parseAmount(amount)),
      "还款成功，债务减少；若已偿清，抵押已返还并冻结情景。",
      `借款人钱包 → 池子：${amount} B。`,
    );
  });
  $("borrow-repay-all").addEventListener("click", () => {
    const amount = state.debt;
    action(
      () => L.repay(state, amount),
      "已偿清全部债务并返还抵押。重置可比较另一种情景。",
      `借款人 → 池子：${fmt(amount)} B；剩余抵押 → 借款人钱包。`,
    );
  });
  $("borrow-liquidate").addEventListener("click", () =>
    action(
      () => L.liquidate(state),
      () =>
        state.badDebt > 0n
          ? "清算已执行，但未收回的债务成为坏账。资产没有凭空补齐。"
          : "清算已执行，债务偿清，剩余抵押已返还。",
      () =>
        `清算者 → 池子：${fmt(state.settlement.repaid)} B；锁定抵押 → 清算者：${fmt(state.settlement.seized)} C。`,
    ),
  );
  $("borrow-reset").addEventListener("click", () => {
    state = L.createState();
    $("borrow-transfer").hidden = true;
    select(0);
    render();
    status("已恢复所有账户、抵押、价格、债务和坏账，开始一个独立情景。");
  });
  select(0);
  render();
  document
    .querySelectorAll("[data-borrow-step]")
    .forEach((b) => (b.disabled = false));
  document.body.dataset.ready = "true";
  $("borrow-loading").hidden = true;
})();
