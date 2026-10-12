"use strict";
(() => {
  const M = window.AMMLab,
    L = window.LPLab,
    $ = (id) => document.getElementById(id),
    fmt = M.formatAmount;
  let state = L.createState(),
    step = 0;
  const initialTotals = totals(state);
  const lessons = [
    [
      "加入池子",
      "投入 100 A 和 100 B，你拥有池子的多少？",
      "初始 LP 已经投入各 1000 个资产。你的份额，要除以加入后整个池子的规模。",
    ],
    [
      "观察手续费",
      "别人来交易，你的份额对应什么资产？",
      "模拟一笔普通交易，观察储备组成和累计手续费。LP 的份额数量不变，对应的资产数量会改变。",
    ],
    [
      "价格与套利",
      "外部价格变化后，谁改变池子里的资产？",
      "先改外部参考价，再执行套利。比较“仅改变价格”和“发生实际交易”之间的区别。",
    ],
    [
      "退出与比较",
      "取回当前资产，和原样持有比一比。",
      "手续费已经包含在取回资产里。用同一个外部价格计价，才是对同批资产的公平比较。",
    ],
  ];
  function totals(s) {
    return ["A", "B"].map((t) =>
      ["pool", "wallet", "trader", "arbitrage", "market"].reduce(
        (sum, k) => sum + s[k][t],
        0n,
      ),
    );
  }
  function status(text, error = false) {
    $("lp-status").textContent = text;
    $("lp-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function select(index) {
    step = index;
    document.querySelectorAll("[data-lp-step]").forEach((b) => {
      if (Number(b.dataset.lpStep) === index)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    $("lp-step-label").textContent = `0${index + 1} / ${lessons[index][0]}`;
    $("lp-step-title").textContent = lessons[index][1];
    $("lp-step-description").textContent = lessons[index][2];
    $("lp-control-title").textContent = lessons[index][0];
    ["join", "trade", "price", "exit"].forEach(
      (name, i) => ($("lp-" + name + "-panel").hidden = i !== index),
    );
    $("lp-progress").textContent = `第 ${index + 1} / 4 步`;
    $("lp-prev").disabled = index === 0;
    $("lp-next").disabled = index === 3 || !state.position;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.getAnimations().forEach((animation) => animation.cancel());
    } else
      document.querySelector(".lesson-intro").animate(
        [
          { opacity: 0.65, transform: "translateY(7px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 240, easing: "ease-out" },
      );
  }
  function render() {
    const invested = !!state.position,
      exited = !!state.position?.received,
      active = invested && !exited;
    $("lp-join").disabled = invested;
    $("lp-deposit").disabled = invested;
    $("lp-fee").disabled = invested;
    for (const id of [
      "lp-trade",
      "lp-direction",
      "lp-trade-amount",
      "lp-price",
      "lp-arbitrage",
      "lp-withdraw",
    ])
      $(id).disabled = !active;
    $("lp-position-tag").textContent = exited
      ? "已退出 · 情景冻结"
      : invested
        ? "已加入"
        : "尚未投入";
    $("lp-revision").textContent = "账本操作 " + state.revision + " 次";
    $("lp-reserve-a").textContent = fmt(state.pool.A);
    $("lp-reserve-b").textContent = fmt(state.pool.B);
    $("lp-pool-price").textContent =
      "1 A ≈ " +
      (Number(state.pool.B) / Number(state.pool.A)).toFixed(6) +
      " B";
    $("lp-market-price").textContent = fmt(state.price) + " B / A";
    $("lp-track").style.width =
      (Number(state.pool.A) / Number(state.pool.A + state.pool.B)) * 100 + "%";
    const share = (Number(state.userShares) / Number(state.totalShares)) * 100;
    $("lp-share").textContent = share.toFixed(4) + "%";
    $("lp-shares").textContent =
      fmt(state.userShares) + " / " + fmt(state.totalShares);
    $("lp-share-track").style.width = share + "%";
    const claim = L.claim(state);
    for (const t of ["A", "B"]) {
      const key = t.toLowerCase();
      $("lp-wallet-" + key).textContent = fmt(state.wallet[t]);
      $("lp-claim-" + key).textContent = invested ? fmt(claim[t]) : "—";
      $("lp-held-" + key).textContent = invested
        ? fmt(state.position.deposited[t])
        : "—";
    }
    $("lp-claim-label").textContent = exited ? "本次实际取回" : "可退出资产";
    $("lp-claim-caption").textContent = exited
      ? "退出时实际收到的资产"
      : "这份份额现在能退出多少资产？";
    $("lp-fees").textContent =
      fmt(state.feeNumerator.A / 10000n) +
      " A + " +
      fmt(state.feeNumerator.B / 10000n) +
      " B（小于最小单位的部分未显示）";
    $("lp-comparison").hidden = !invested;
    if (invested) {
      const c = L.comparison(state);
      $("lp-value-title").textContent = exited
        ? "本次实际退出，与直接持有相比"
        : "如果现在退出，与直接持有相比";
      $("lp-value").textContent = fmt(c.lpValue) + " B";
      $("lp-hold-value").textContent = fmt(c.holdValue) + " B";
      $("lp-difference").textContent =
        (c.difference > 0n ? "+" : "") + fmt(c.difference) + " B";
      const pct = (Number(c.difference) / Number(c.holdValue)) * 100;
      $("lp-difference-percent").textContent =
        (pct > 0 ? "+" : "") + pct.toFixed(4) + "%";
      $("lp-difference").className =
        c.difference < 0n
          ? "value-negative"
          : c.difference > 0n
            ? "value-positive"
            : "";
      const r = Number(state.price) / Number(M.SCALE);
      $("lp-ideal").textContent =
        (((2 * Math.sqrt(r)) / (1 + r) - 1) * 100).toFixed(4) + "%";
      $("lp-result-explanation").textContent =
        "比较只针对本次投入，未投入的钱包资产不计入。差距包含手续费、交易路径和整数舍入；少于持有不代表低于投入时的本金价值。";
    }
    $("lp-audit-rows").replaceChildren();
    for (const [key, label] of [
      ["wallet", "你的钱包"],
      ["pool", "池子储备"],
      ["trader", "普通交易者"],
      ["arbitrage", "套利账户"],
      ["market", "外部市场"],
    ]) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = label;
      tr.append(th);
      for (const t of ["A", "B"]) {
        const td = document.createElement("td");
        td.textContent = fmt(state[key][t]);
        tr.append(td);
      }
      $("lp-audit-rows").append(tr);
    }
    const sums = totals(state);
    $("lp-total-a").textContent = fmt(sums[0]);
    $("lp-total-b").textContent = fmt(sums[1]);
    $("lp-conservation").textContent = sums.every(
      (v, i) => v === initialTotals[i],
    )
      ? "A、B 总量分别守恒 · LP 份额未重复计入资产"
      : "对账异常，请重置";
    $("lp-trade-token").textContent = $("lp-direction").value;
    $("lp-next").disabled = step === 3 || !invested;
  }
  function action(fn, message) {
    try {
      state = fn();
      render();
      status(typeof message === "function" ? message() : message);
    } catch (e) {
      status(e.message, true);
    }
  }
  document
    .querySelectorAll("[data-lp-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.lpStep))),
    );
  $("lp-prev").addEventListener("click", () => select(Math.max(0, step - 1)));
  $("lp-next").addEventListener("click", () => select(Math.min(3, step + 1)));
  $("lp-join").addEventListener("click", () =>
    action(
      () => L.deposit(state, M.parseAmount($("lp-deposit").value)),
      () =>
        `加入成功。你的份额是 ${((Number(state.userShares) / Number(state.totalShares)) * 100).toFixed(4)}%，不是简单除以加入前的储备。继续观察交易。`,
    ),
  );
  $("lp-trade").addEventListener("click", () =>
    action(
      () =>
        L.swap(
          state,
          $("lp-direction").value,
          M.parseAmount($("lp-trade-amount").value),
        ),
      "交易成功。手续费留池，份额数量不变，对应资产组成发生变化。",
    ),
  );
  $("lp-price").addEventListener("change", () =>
    action(
      () => L.setPrice(state, M.parseAmount($("lp-price").value)),
      "仅外部价格已改变，池子储备尚未变化。接下来模拟套利。",
    ),
  );
  $("lp-arbitrage").addEventListener("click", () =>
    action(
      () => L.arbitrage(state),
      () => {
        const a = state.lastArbitrage;
        $("lp-arbitrage-note").textContent =
          `套利者向池子输入 ${fmt(a.amount)} ${a.from}，得到 ${fmt(a.output)} ${a.from === "A" ? "B" : "A"}；在外部市场完成另一边交易，净收益 ${fmt(a.profit)} B（省略 Gas）。`;
        return "套利交易成功。价格变化通过实际买卖改变了池子资产，所有账本仍然守恒。";
      },
    ),
  );
  $("lp-withdraw").addEventListener("click", () =>
    action(
      () => L.withdraw(state),
      "退出成功。资产已回到钱包，这个情景已冻结；重置后可比较另一个路径。",
    ),
  );
  $("lp-direction").addEventListener("change", render);
  $("lp-fee").addEventListener("change", () => {
    state = L.createState(Number($("lp-fee").value));
    render();
    status("费率已更新，尚未投入。");
  });
  $("lp-reset").addEventListener("click", () => {
    state = L.createState(Number($("lp-fee").value));
    $("lp-price").value = "1";
    $("lp-arbitrage-note").textContent =
      "套利账户使用真实模拟资金：在一边买入，在另一边卖出。池子手续费从收益中扣除。";
    select(0);
    render();
    status("已恢复初始资产，份额、价格与手续费流水已清空。");
  });
  select(0);
  render();
  document
    .querySelectorAll("[data-lp-step]")
    .forEach((b) => (b.disabled = false));
  document.body.dataset.ready = "true";
  $("lp-loading").hidden = true;
})();
