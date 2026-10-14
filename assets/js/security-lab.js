"use strict";
(() => {
  const S = window.SecurityLab,
    $ = (id) => document.getElementById(id);
  const names = ["Alice", "Bob", "Attacker"];
  let step = 0,
    last = null,
    frame = 0;
  const lessons = [
    [
      "正常提款",
      "先分开银行的钱与欠款。",
      "银行实际持有6 G；Alice可取3、Bob可取2、攻击合约可取1。债权不能再加进总资产。",
    ],
    [
      "重入攻击",
      "外部回调回来时，读取了什么旧状态？",
      "先运行，再从初始帧逐步推进。每一层尚未清零的债权，都允许再次转出1 G。",
    ],
    [
      "防护对照",
      "改顺序与加锁，分别挡在哪一步？",
      "用同一初态对照两种实现。CEI提前清零债权；锁阻止再次进入。捕获内层失败时，仍可取回自己的1 G。",
    ],
    [
      "失败传播",
      "内层拒绝之后，整笔交易一定失败吗？",
      "分别捕获与传播回调失败，再试主动拒收。先前存款保留，本次临时转账和写入可以一起恢复。",
    ],
  ];
  const code = {
    vulnerable:
      "check(claim > 0)\ncall(receiver, claim)  // 回调可再进入\nclaim = 0",
    cei: "check(claim > 0)\nclaim = 0             // 先改账\ncall(receiver, savedClaim)",
    lock: "check(!locked); locked = true\ncheck(claim > 0)\ncall(receiver, claim)  // 回调被锁挡住\nclaim = 0; locked = false",
  };
  const modeLabels = { vulnerable: "漏洞版本", cei: "CEI", lock: "单独重入锁" };
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function controls() {
    document
      .querySelectorAll("button,input,select")
      .forEach((n) => (n.disabled = false));
    $("security-prev").disabled = step === 0;
    $("security-next").disabled = step === 3;
    $("security-mode").disabled = step === 1;
    $("security-frame-prev").disabled = !last || frame === 0;
    $("security-frame-next").disabled =
      !last || frame === last.trace.length - 1;
    $("security-frame-end").disabled = !last || frame === last.trace.length - 1;
    $("security-honest-after").hidden = step !== 1;
    $("security-honest-after").disabled =
      !last || !last.success || last.state.cash !== 0n;
  }
  function select(i) {
    step = Math.max(0, Math.min(3, i));
    last = null;
    frame = 0;
    document.querySelectorAll("[data-security-step]").forEach((b) => {
      if (Number(b.dataset.securityStep) === step)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    $("security-options").hidden = step === 0;
    $("security-reject-field").hidden = step !== 3;
    $("security-mode").value = step < 2 ? "vulnerable" : "cei";
    $("security-limit").value = "6";
    $("security-catch").value = step === 3 ? "bubble" : "catch";
    $("security-reject").value = "no";
    $("security-step-label").textContent = `0${step + 1} / ${lessons[step][0]}`;
    $("security-title").textContent = lessons[step][1];
    $("security-description").textContent = lessons[step][2];
    $("security-progress").textContent = `第${step + 1} / 4步`;
    $("security-run").textContent =
      step === 0 ? "运行 Alice 正常提款 →" : "运行攻击合约提款 →";
    status("先预测结果，再运行并逐帧核对。");
    render();
  }
  function status(text, error = false) {
    $("security-status").textContent = text;
    $("security-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function render() {
    const state = last ? last.state : S.createState(),
      total = S.totals(state);
    $("security-code").textContent = code[$("security-mode").value];
    $("security-run-config").textContent = last
      ? `结果与轨迹来自：${last.configuration}`
      : "尚未运行，显示初始状态。";
    $("security-cash").textContent = String(state.cash);
    $("security-claims").textContent = String(total.claims);
    $("security-received").textContent = String(state.wallets.Attacker);
    $("security-gap").textContent = String(total.gap);
    $("security-gap").className = total.gap > 0n ? "value-negative" : "";
    $("security-ledger").replaceChildren(
      ...names.map((name) => {
        const row = el("tr");
        row.append(
          el("th", name),
          el("td", String(state.claims[name])),
          el("td", String(state.wallets[name])),
        );
        return row;
      }),
    );
    $("security-total").textContent =
      `银行 ${state.cash} + 银行外 ${total.assets - state.cash} = ${total.assets} G；初始总资金6 G，债权另计。`;
    $("security-receipt-tag").textContent = !last
      ? "尚未执行"
      : last.success
        ? "提款已提交"
        : "提款已回滚";
    $("security-verdict").textContent = !last
      ? "债权表示银行的义务；实际现金表示银行能付多少钱。"
      : !last.success
        ? "本次提款业务状态已恢复。此前存款仍保留；真实链上执行费不会一起退回。"
        : total.gap > 0n
          ? `总钱数没增加，但银行还有${total.claims} G债权未付，现金仅${state.cash} G。`
          : "最终实际资金覆盖剩余债权；本次提款没有重复支付。";
    renderFrame();
    controls();
  }
  function renderFrame() {
    if (!last) {
      $("security-frame-index").textContent = "等待运行";
      $("security-frame").replaceChildren(
        el("p", "运行一次提款，展开调用与回滚。"),
      );
      $("security-timeline").replaceChildren();
      return;
    }
    const t = last.trace[frame],
      s = t.state;
    $("security-frame-index").textContent =
      `帧 ${frame + 1} / ${last.trace.length}`;
    const title = el(
      "p",
      `调用深度 ${t.depth} · ${t.text}`,
      "security-frame-title",
    );
    const snapshot = el(
      "p",
      `临时现金 ${s.cash} G / Attacker债权 ${s.claims.Attacker} G / 已收 ${s.wallets.Attacker} G / 锁 ${s.locked ? "占用" : "释放"}`,
      "security-frame-values",
    );
    $("security-frame").replaceChildren(title, snapshot);
    $("security-timeline").replaceChildren(
      ...last.trace.map((entry, index) => {
        const li = el("li"),
          button = el(
            "button",
            `${String(index + 1).padStart(2, "0")} · 深度${entry.depth} · ${entry.text}`,
          );
        button.className = "security-timeline-button";
        button.dataset.kind = entry.kind;
        if (index === frame) button.setAttribute("aria-current", "true");
        button.addEventListener("click", () => {
          frame = index;
          renderFrame();
          controls();
        });
        li.append(button);
        return li;
      }),
    );
  }
  function execute(continuation = false) {
    try {
      const raw = $("security-limit").value.trim();
      if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 8)
        throw new Error("最多接收次数请输入1至8的整数。");
      const initial = continuation ? last.state : S.createState();
      const options = {
        mode: $("security-mode").value,
        caller: step === 0 || continuation ? "Alice" : "Attacker",
        maxPayouts: Number(raw),
        catchFailure: $("security-catch").value === "catch",
        receiverReject: step === 3 && $("security-reject").value === "yes",
      };
      last = S.run(initial, options);
      last.configuration = `${continuation ? "延续攻击后账本，" : "独立初态，"}${modeLabels[options.mode]} / ${options.caller} / 最多接收${options.maxPayouts}次 / ${options.catchFailure ? "捕获内层失败" : "向外传播"} / ${options.receiverReject ? "主动拒收" : "正常接收"}`;
      frame = 0;
      render();
      status(
        `${continuation ? "延续攻击后账本：" : "独立初态提款："}${last.success ? "提交成功" : "已回滚"}。${last.reason}；先看初始帧，再推进。`,
        !last.success,
      );
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        $("security-frame")
          .getAnimations()
          .forEach((a) => a.cancel());
        $("security-frame").animate(
          [{ backgroundColor: "#edf2ff" }, { backgroundColor: "#fff" }],
          { duration: 450 },
        );
      }
    } catch (error) {
      status(error.message, true);
    }
  }
  document
    .querySelectorAll("[data-security-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.securityStep))),
    );
  $("security-prev").addEventListener("click", () => select(step - 1));
  $("security-next").addEventListener("click", () => select(step + 1));
  $("security-reset").addEventListener("click", () => select(step));
  $("security-run").addEventListener("click", () => execute());
  $("security-honest-after").addEventListener("click", () => execute(true));
  function changed() {
    $("security-code").textContent = code[$("security-mode").value];
    status(
      last
        ? "配置已改变。下方账本与轨迹属于上次运行，配置已标注；重新运行后更新结果。"
        : "配置已改变，运行后查看结果。",
    );
  }
  [
    "security-mode",
    "security-limit",
    "security-catch",
    "security-reject",
  ].forEach((id) => {
    $(id).addEventListener(
      id === "security-limit" ? "input" : "change",
      changed,
    );
  });
  for (const [id, delta] of [
    ["security-frame-prev", -1],
    ["security-frame-next", 1],
  ])
    $(id).addEventListener("click", () => {
      frame += delta;
      renderFrame();
      controls();
    });
  $("security-frame-end").addEventListener("click", () => {
    frame = last.trace.length - 1;
    renderFrame();
    controls();
  });
  select(0);
  $("security-loading").hidden = true;
  document.body.dataset.ready = "true";
})();
