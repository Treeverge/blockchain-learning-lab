"use strict";
(() => {
  const U = window.UTXOLab,
    M = window.AMMLab,
    $ = (id) => document.getElementById(id),
    fmt = M.formatAmount;
  let lab,
    ledger,
    tx,
    original,
    conflict,
    report,
    step = 0,
    busy = true;
  const lessons = [
    [
      "看身份",
      "公钥是身份，私钥授权花费。",
      "余额是当前未花费输出的合计。知道某个人的公钥，不等于可以替他授权。",
    ],
    [
      "选输入",
      "花掉一笔输出，把余额作为新输出找回来。",
      "预测：选择 70，转出 45，付费 1。输入会完整消耗，找零应该是多少？",
    ],
    [
      "签名验证",
      "重算 ID 可以做到，旧签名还能通过吗？",
      "比较两种失败：修改消息会破坏签名；Eve 自己签名可以通过验签，却无权花 Alice 的钱。",
    ],
    [
      "确认交易",
      "不是修改余额，而是消耗旧输出、建立新输出。",
      "核对输入、收款、找零和费用账户。失败的确认不会扣款，已确认交易的签名不会因为输入消耗而失效。",
    ],
    [
      "尝试双花",
      "两份交易都曾有效，为什么只能确认一份？",
      "签名检查授权，UTXO 检查是否已经花费。真实网络还需要共识决定哪份历史被接受。",
    ],
  ];
  const short = (s) => (s.length > 20 ? s.slice(0, 10) + "…" + s.slice(-6) : s);
  const owner = (id) =>
    Object.keys(lab.people).find((name) => lab.people[name].id === id) ||
    "未知身份";
  function el(tag, text, className) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (className) n.className = className;
    return n;
  }
  function detail(title, text) {
    const d = el("details");
    d.append(el("summary", title), el("code", text, "utxo-hex"));
    return d;
  }
  function status(text, error = false) {
    $("utxo-status").textContent = text;
    $("utxo-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function controls() {
    document
      .querySelectorAll("button,input,select")
      .forEach((n) => (n.disabled = busy));
    if (busy) return;
    $("utxo-prev").disabled = step === 0;
    $("utxo-next").disabled = step === 4;
    $("utxo-sign").disabled = !tx || !report?.inputsValid;
    ["tamper", "eve", "restore", "first", "second"].forEach(
      (id) => ($("utxo-" + id).disabled = !original),
    );
    ["tamper", "eve"].forEach(
      (id) =>
        ($("utxo-" + id).disabled =
          !original ||
          !original.inputs.every((ref) =>
            ledger.utxos.some((c) => c.ref === ref),
          )),
    );
    $("utxo-confirm").disabled = !tx;
  }
  function select(index) {
    step = Math.max(0, Math.min(4, index));
    document.querySelectorAll("[data-utxo-step]").forEach((b) => {
      if (Number(b.dataset.utxoStep) === step)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    ["identity", "input", "sign", "confirm", "conflict"].forEach(
      (s, i) => ($("utxo-" + s + "-panel").hidden = i !== step),
    );
    $("utxo-step-label").textContent = `0${step + 1} / ${lessons[step][0]}`;
    $("utxo-title").textContent = lessons[step][1];
    $("utxo-description").textContent = lessons[step][2];
    $("utxo-control-title").textContent = lessons[step][0];
    $("utxo-progress").textContent = `第 ${step + 1} / 5 步`;
    controls();
  }
  function selected() {
    const refs = [...$("utxo-inputs").querySelectorAll("input:checked")].map(
      (n) => n.value,
    );
    const sum = ledger.utxos
      .filter((c) => refs.includes(c.ref))
      .reduce((s, c) => s + c.amount, 0n);
    $("utxo-selected").textContent =
      `已选 ${refs.length} 个输入，合计 ${fmt(sum)}。`;
    return refs;
  }
  function inputList() {
    $("utxo-inputs").replaceChildren();
    const coins = ledger.utxos.filter((c) => c.owner === lab.people.Alice.id);
    const preferred =
      coins.find((c) => c.ref === "seed-alice-70:0") ||
      coins.reduce((a, b) => (!a || b.amount > a.amount ? b : a), null);
    coins.forEach((c) => {
      const l = el("label", undefined, "utxo-input-option"),
        i = el("input");
      i.type = "checkbox";
      i.value = c.ref;
      i.checked = c === preferred;
      const text = el("span");
      text.append(el("strong", fmt(c.amount)), el("small", short(c.ref)));
      l.append(i, text);
      $("utxo-inputs").append(l);
      i.addEventListener("change", configChanged);
    });
    if (!coins.length)
      $("utxo-inputs").append(el("p", "Alice 当前没有未花费输出。", "caption"));
    selected();
  }
  function configChanged() {
    tx = original = conflict = report = null;
    selected();
    render();
    status("配置已改变，请生成新的交易草稿。账本没有变化。");
  }
  function render() {
    $("utxo-ledger").replaceChildren();
    ledger.utxos.forEach((c) => {
      const row = el("tr"),
        ref = el("td");
      ref.append(detail(short(c.ref), c.ref));
      row.append(el("td", owner(c.owner)), el("td", fmt(c.amount)), ref);
      $("utxo-ledger").append(row);
    });
    ["Alice", "Bob", "Eve"].forEach(
      (name) =>
        ($(
          name === "Eve" ? "utxo-eve-balance" : "utxo-" + name.toLowerCase(),
        ).textContent = fmt(U.balance(ledger, lab.people[name].id))),
    );
    $("utxo-fees").textContent = fmt(ledger.fees);
    $("utxo-confirmed").textContent = `确认 ${ledger.accepted.length} 笔`;
    $("utxo-conservation").textContent =
      `UTXO ${fmt(U.total(ledger) - ledger.fees)} + 费用 ${fmt(ledger.fees)} = ${fmt(U.total(ledger))}；初始总量 150，资产守恒。`;
    const accepted = tx && ledger.accepted.includes(tx.id);
    $("utxo-tx-tag").textContent = accepted
      ? "已确认，输入已消耗"
      : !tx
        ? "尚无草稿"
        : report?.valid
          ? "当前可确认"
          : tx.witnesses.length
            ? "校验未通过"
            : "等待签名";
    const box = $("utxo-transaction");
    box.replaceChildren();
    if (!tx) box.append(el("p", "到第二步选择输入，生成一份交易。", "caption"));
    else {
      box.append(
        el(
          "p",
          `${tx.inputs.length} 个输入 → ${tx.outputs.map((o) => `${owner(o.owner)} ${fmt(o.amount)}`).join(" + ")}；手续费 ${fmt(tx.fee)}`,
          "utxo-output-summary",
        ),
      );
      box.append(
        detail("输入引用与完整交易 ID", tx.inputs.join("\n") + "\nID " + tx.id),
      );
      if (tx.witnesses.length)
        box.append(
          detail(
            "签名公钥与原始签名字节",
            tx.witnesses
              .map(
                (w) =>
                  `${short(w.ref)}\n公钥 ${w.publicHex}\n签名 ${w.signatureHex}`,
              )
              .join("\n\n"),
          ),
        );
    }
    const checks = $("utxo-checks");
    checks.replaceChildren();
    [
      ["hashValid", "内容 / ID"],
      ["inputsValid", "未花费输入"],
      ["ownershipValid", "输入所有者"],
      ["signatureValid", "真实签名"],
      ["amountsValid", "金额守恒"],
    ].forEach(([key, label]) => {
      const v = report?.[key],
        row = el("div", undefined, "utxo-check");
      row.append(
        el("span", label),
        el(
          "strong",
          v === true
            ? "通过"
            : v === false
              ? "未通过"
              : report
                ? "缺少未花费输入"
                : "待检查",
          v === true ? "value-positive" : v === false ? "value-negative" : "",
        ),
      );
      checks.append(row);
    });
    $("utxo-check-note").textContent = accepted
      ? "这笔交易已确认。以下是再次提交时的校验：输入已消耗不等于历史签名无效；未知项需要对应未花费输出。"
      : report
        ? report.valid
          ? "所有层都通过；这份候选在当前账本中可以确认。"
          : report.reasons.join(" ")
        : "先生成交易，再观察每一层校验。";
    $("utxo-candidates").hidden = !original;
    if (original) {
      $("utxo-candidates").replaceChildren();
      [
        ["原候选", original],
        ["冲突候选", conflict],
      ].forEach(([label, candidate]) => {
        const p = el("div");
        p.append(
          el("strong", `${label} → ${owner(candidate.outputs[0].owner)}`),
          el("p", short(candidate.id), "utxo-hex"),
          el(
            "small",
            ledger.accepted.includes(candidate.id)
              ? "已确认"
              : candidate.inputs.every((ref) =>
                    ledger.utxos.some((c) => c.ref === ref),
                  )
                ? "Alice 已签名 · 输入尚未消耗"
                : "Alice 已签名 · 共享输入已消耗",
          ),
        );
        $("utxo-candidates").append(p);
      });
    }
    controls();
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    controls();
    try {
      await action();
      report = tx ? await U.verify(ledger, tx) : null;
      render();
    } catch (e) {
      status(e.message, true);
      report = tx ? await U.verify(ledger, tx) : null;
      render();
    } finally {
      busy = false;
      controls();
    }
  }
  async function confirm(candidate) {
    // Assignment happens only after full verification succeeds; rejected candidates keep the ledger intact.
    const next = await U.apply(ledger, candidate);
    ledger = next;
    tx = U.cloneTx(candidate);
    inputList();
    status(
      `交易已确认：${owner(tx.outputs[0].owner)} 收到 ${fmt(tx.outputs[0].amount)}，费用账户增加 ${fmt(tx.fee)}。`,
    );
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      $("utxo-ledger").animate(
        [{ backgroundColor: "#d9e7ff" }, { backgroundColor: "transparent" }],
        { duration: 650 },
      );
    }
  }
  async function initialize() {
    const next = await U.createLab();
    lab = next;
    ledger = lab.state;
    tx = original = conflict = report = null;
    $("utxo-recipient").value = "Bob";
    $("utxo-amount").value = "45";
    $("utxo-fee").value = "1";
    $("utxo-identities").replaceChildren();
    ["Alice", "Bob", "Eve"].forEach((name) => {
      const d = detail(
        `${name} · ${short(lab.people[name].id)}`,
        `指纹 ${lab.people[name].id}\n公钥 ${lab.people[name].publicHex}`,
      );
      $("utxo-identities").append(d);
    });
    inputList();
    select(0);
    render();
    status("先查看公钥身份，再选择 Alice 的输入。");
    $("utxo-loading").hidden = true;
    document.body.dataset.ready = "true";
  }
  document
    .querySelectorAll("[data-utxo-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.utxoStep))),
    );
  $("utxo-prev").addEventListener("click", () => select(step - 1));
  $("utxo-next").addEventListener("click", () => select(step + 1));
  $("utxo-reset").addEventListener("click", () => run(initialize));
  ["recipient", "amount", "fee"].forEach((id) =>
    $("utxo-" + id).addEventListener("input", configChanged),
  );
  $("utxo-draft").addEventListener("click", () =>
    run(async () => {
      const feeText = $("utxo-fee").value.trim();
      const fee = /^0(?:\.0{1,6})?$/.test(feeText)
        ? 0n
        : M.parseAmount(feeText);
      tx = await U.createTransfer(
        ledger,
        lab.people.Alice.id,
        lab.people[$("utxo-recipient").value].id,
        selected(),
        M.parseAmount($("utxo-amount").value),
        fee,
      );
      original = conflict = null;
      status("草稿已生成。金额守恒，但还没有授权签名。");
    }),
  );
  $("utxo-sign").addEventListener("click", () =>
    run(async () => {
      const signed = await U.sign(tx, lab.people.Alice);
      const recipient =
        signed.outputs[0].owner === lab.people.Eve.id
          ? lab.people.Bob.id
          : lab.people.Eve.id;
      const second = await U.sign(
        await U.createTransfer(
          ledger,
          lab.people.Alice.id,
          recipient,
          signed.inputs,
          signed.outputs[0].amount,
          signed.fee,
        ),
        lab.people.Alice,
      );
      tx = signed;
      original = U.cloneTx(signed);
      conflict = second;
      status(
        "Alice 已真实签名；另一份共享输入、收款人不同的候选也已签好。当前两份都可以分别通过校验。",
      );
    }),
  );
  $("utxo-tamper").addEventListener("click", () =>
    run(async () => {
      const changed = U.cloneTx(original);
      changed.outputs[0].owner =
        changed.outputs[0].owner === lab.people.Eve.id
          ? lab.people.Bob.id
          : lab.people.Eve.id;
      tx = await U.rehash(changed);
      status(
        "收款人和 ID 已改变，旧签名保留。观察：ID 通过，签名不通过。",
        true,
      );
    }),
  );
  $("utxo-eve").addEventListener("click", () =>
    run(async () => {
      tx = await U.sign(original, lab.people.Eve);
      status("Eve 的签名本身有效，但公钥不是 Alice 的输入所有者。", true);
    }),
  );
  $("utxo-restore").addEventListener("click", () =>
    run(async () => {
      tx = U.cloneTx(original);
      status("已恢复 Alice 的原签名交易；账本没有变化。");
    }),
  );
  $("utxo-confirm").addEventListener("click", () => run(() => confirm(tx)));
  $("utxo-first").addEventListener("click", () =>
    run(async () => {
      tx = U.cloneTx(original);
      await confirm(tx);
    }),
  );
  $("utxo-second").addEventListener("click", () =>
    run(async () => {
      tx = U.cloneTx(conflict);
      await confirm(tx);
    }),
  );
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
    "change",
    (e) => {
      if (e.matches) document.getAnimations().forEach((a) => a.cancel());
    },
  );
  controls();
  initialize()
    .then(() => {
      busy = false;
      controls();
    })
    .catch((e) => {
      $("utxo-loading").textContent = e.message;
      status(e.message, true);
    });
})();
