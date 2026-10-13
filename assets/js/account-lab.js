"use strict";
(() => {
  const A = window.AccountLab,
    M = window.AMMLab,
    $ = (id) => document.getElementById(id),
    fmt = M.formatAmount;
  let state = A.createState(),
    step = 0,
    savedDraft = null,
    last = null,
    busy = false;
  const lessons = [
    [
      "看账户",
      "同一个角色，有两种余额。",
      "G 在原生账户里支付执行费用；LAB 在 Token 合约的余额映射里。转 LAB 并不把 G 也转给收款人。",
    ],
    [
      "交易顺序",
      "一份成功执行的草稿，再提交会怎样？",
      "nonce 指定发送者的执行顺序。先创建固定草稿，再执行、重复执行，比较纳入前拒绝和合约失败。",
    ],
    [
      "存储位置",
      "临时副本变了，持久存储会跟着变吗？",
      "先做链外调用，再提交写入交易；观察 counter、原生 G 和 nonce。",
    ],
    [
      "失败回滚",
      "临时写入过了，最终仍可以全部撤销。",
      "核对回执轨迹与最终账本：业务状态和日志回滚，已消耗的执行费用与 nonce 保留。",
    ],
    [
      "授权代转",
      "支付 LAB 的人，未必是支付执行费用的人。",
      "拥有者授权，获准账户发起代转。先观察额度，再重复代转，解释失败后谁的原生余额减少。",
    ],
  ];
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function int(id) {
    const v = $(id).value.trim();
    if (!/^\d+$/.test(v) || !Number.isSafeInteger(Number(v)))
      throw new Error("请输入非负整数，不用科学计数法。");
    return Number(v);
  }
  function amount(id, zero = false) {
    const v = $(id).value.trim();
    return zero && /^0+(?:\.0{1,6})?$/.test(v) ? 0n : M.parseAmount(v);
  }
  function status(text, error = false) {
    $("account-status").textContent = text;
    $("account-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function controls() {
    document
      .querySelectorAll("button,input,select")
      .forEach((n) => (n.disabled = busy));
    $("account-prev").disabled = busy || step === 0;
    $("account-next").disabled = busy || step === 4;
    $("account-submit").disabled = busy || !savedDraft;
  }
  function select(i) {
    step = Math.max(0, Math.min(4, i));
    document.querySelectorAll("[data-account-step]").forEach((b) => {
      if (Number(b.dataset.accountStep) === step)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    ["transfer", "sequence", "storage", "failure", "approval"].forEach(
      (p, index) => ($("account-" + p + "-panel").hidden = index !== step),
    );
    $("account-actor-field").hidden = step === 4;
    $("account-step-label").textContent = `0${step + 1} / ${lessons[step][0]}`;
    $("account-title").textContent = lessons[step][1];
    $("account-description").textContent = lessons[step][2];
    $("account-control-title").textContent = lessons[step][0];
    $("account-progress").textContent = `第 ${step + 1} / 5 步`;
    controls();
  }
  function render() {
    $("account-accounts").replaceChildren(
      ...["Alice", "Bob", "Eve"].map((name) => {
        const row = el("tr");
        row.append(
          el("th", name),
          el("td", fmt(state.accounts[name].G)),
          el("td", String(state.accounts[name].nonce)),
        );
        return row;
      }),
    );
    const totals = A.totals(state);
    $("account-native-total").textContent =
      `账户 G ${fmt(totals.G - state.fees)} + 费用 ${fmt(state.fees)} = ${fmt(totals.G)}；初始 3 G，原生资产守恒。`;
    ["Alice", "Bob", "Eve"].forEach(
      (name) =>
        ($("account-" + name.toLowerCase() + "-lab").textContent = fmt(
          state.token.balances[name],
        )),
    );
    $("account-counter").textContent = state.token.counter;
    $("account-token-total").textContent =
      `LAB 余额合计 ${fmt(totals.LAB)} = 固定供应 ${fmt(state.token.supply)}。`;
    const owner = $("account-owner").value,
      spender = $("account-spender").value;
    $("account-allowance").textContent =
      `当前授权：${owner} → ${spender}，${fmt(A.allowance(state, owner, spender))} LAB。`;
    $("account-next-nonce").textContent =
      `${$("account-actor").value} 下一笔 nonce = ${state.accounts[$("account-actor").value].nonce}。`;
    $("account-draft").textContent = savedDraft
      ? `固定草稿：${savedDraft.from} → ${savedDraft.to}，${fmt(savedDraft.amount)} LAB；nonce ${savedDraft.nonce}，上限 ${savedDraft.gasLimit}。${savedDraft.nonce === state.accounts[savedDraft.from].nonce ? "尚未使用该 nonce。" : "该 nonce 当前不能执行，请核对顺序。"}`
      : "尚无草稿。";
    $("account-fee-metrics").replaceChildren();
    $("account-trace").replaceChildren();
    if (last) {
      const r = last.receipt,
        labels = {
          success: "执行成功",
          rejected: "纳入前拒绝",
          reverted: "业务已回滚",
          "out-of-gas": "执行上限耗尽",
        };
      $("account-receipt-tag").textContent = labels[r.status];
      $("account-receipt-meta").textContent =
        `${last.tx.from} · ${last.tx.kind} · nonce ${last.tx.nonce}；${r.included ? "已纳入本地执行" : "未纳入执行"}`;
      [
        ["最大预算", fmt(r.maxBudget) + " G"],
        ["消耗单位", String(r.gasUsed)],
        ["实际费用", fmt(r.fee) + " G"],
      ].forEach(([label, value]) => {
        const div = el("div");
        div.append(el("span", label), el("strong", value));
        $("account-fee-metrics").append(div);
      });
      $("account-receipt-note").textContent = r.reason;
      $("account-trace").replaceChildren(...r.trace.map((t) => el("li", t)));
      $("account-log-count").textContent =
        `回执提交日志 ${r.logs.length} 条；历史成功日志共 ${state.events.length} 条。`;
    } else {
      $("account-receipt-tag").textContent = "尚未执行";
      $("account-receipt-meta").textContent = "";
      $("account-receipt-note").textContent =
        "提交交易后核对是否纳入、业务结果与实际费用。";
      $("account-log-count").textContent = "";
    }
    controls();
  }
  function run(action) {
    if (busy) return;
    busy = true;
    controls();
    try {
      action();
      render();
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        document
          .querySelector(".account-receipt")
          .animate(
            [
              { backgroundColor: "#d9e7ff" },
              { backgroundColor: "transparent" },
            ],
            { duration: 450 },
          );
    } catch (e) {
      status(e.message, true);
    } finally {
      busy = false;
      controls();
    }
  }
  function submit(tx) {
    const result = A.execute(state, tx);
    state = result.state;
    last = { tx: { ...tx }, receipt: result.receipt };
    $("account-nonce").value = state.accounts[$("account-actor").value].nonce;
    status(
      `${result.receipt.reason} ${result.receipt.included ? `已消耗 ${fmt(result.receipt.fee)} G，${tx.from} 下一笔 nonce ${state.accounts[tx.from].nonce}。` : "余额、nonce 与合约均未改变。"}`,
      result.receipt.status !== "success",
    );
  }
  function ordinary(kind, fields = {}) {
    return A.draft(state, {
      from: $("account-actor").value,
      kind,
      gasLimit: int("account-limit"),
      ...fields,
    });
  }
  function transferFields() {
    return {
      to: $("account-recipient").value,
      amount: amount("account-amount"),
    };
  }
  document
    .querySelectorAll("[data-account-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.accountStep))),
    );
  $("account-prev").addEventListener("click", () => select(step - 1));
  $("account-next").addEventListener("click", () => select(step + 1));
  $("account-actor").addEventListener("change", () => {
    $("account-nonce").value = state.accounts[$("account-actor").value].nonce;
    render();
  });
  ["owner", "spender"].forEach((id) =>
    $("account-" + id).addEventListener("change", render),
  );
  $("account-transfer").addEventListener("click", () =>
    run(() => submit(ordinary("transfer", transferFields()))),
  );
  $("account-build").addEventListener("click", () =>
    run(() => {
      savedDraft = ordinary("transfer", {
        ...transferFields(),
        nonce: int("account-nonce"),
      });
      status("草稿已固定。更改输入不会改写这份草稿；需要时重新创建。");
    }),
  );
  $("account-submit").addEventListener("click", () =>
    run(() => submit(savedDraft)),
  );
  $("account-future").addEventListener("click", () =>
    run(() =>
      submit(
        ordinary("transfer", {
          ...transferFields(),
          nonce: state.accounts[$("account-actor").value].nonce + 1,
        }),
      ),
    ),
  );
  $("account-memory").addEventListener("click", () =>
    run(() => {
      const r = A.previewMemory(state, int("account-value"));
      $("account-memory-result").textContent =
        `上次链外调用：临时返回 ${r.temporary}；调用时 storage counter 为 ${r.stored}。`;
      status("链外临时调用完成；没有提交交易，nonce 和 G 没有变化。");
    }),
  );
  $("account-store").addEventListener("click", () =>
    run(() => submit(ordinary("store", { value: int("account-value") }))),
  );
  $("account-fail").addEventListener("click", () =>
    run(() => {
      const mode = $("account-failure-mode").value;
      submit(
        ordinary(mode === "deliberate" ? "transferThenFail" : "transfer", {
          to: "Bob",
          amount: mode === "balance" ? 999000000n : 10000000n,
          ...(mode === "gas" ? { gasLimit: 30000 } : {}),
        }),
      );
    }),
  );
  $("account-approve").addEventListener("click", () =>
    run(() =>
      submit(
        A.draft(state, {
          from: $("account-owner").value,
          kind: "approve",
          spender: $("account-spender").value,
          amount: amount("account-approval-amount", true),
        }),
      ),
    ),
  );
  $("account-delegate").addEventListener("click", () =>
    run(() =>
      submit(
        A.draft(state, {
          from: $("account-spender").value,
          kind: "transferFrom",
          owner: $("account-owner").value,
          to: "Bob",
          amount: amount("account-delegated-amount"),
        }),
      ),
    ),
  );
  $("account-reset").addEventListener("click", () =>
    run(() => {
      state = A.createState();
      savedDraft = last = null;
      $("account-actor").value = "Alice";
      $("account-recipient").value = "Bob";
      $("account-owner").value = "Alice";
      $("account-spender").value = "Eve";
      $("account-amount").value = "10";
      $("account-limit").value = "70000";
      $("account-nonce").value = "0";
      $("account-value").value = "9";
      $("account-approval-amount").value = "20";
      $("account-delegated-amount").value = "15";
      $("account-failure-mode").value = "deliberate";
      $("account-memory-result").textContent = "还没有临时调用结果。";
      select(0);
      status("初始账户与 Token 合约已恢复。");
    }),
  );
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
    "change",
    (e) => {
      if (e.matches) document.getAnimations().forEach((a) => a.cancel());
    },
  );
  select(0);
  render();
  $("account-loading").hidden = true;
  document.body.dataset.ready = "true";
  status("先转 10 LAB，观察原生 G 和 Token 余额各怎样变化。");
})();
