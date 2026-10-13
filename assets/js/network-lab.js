"use strict";
(() => {
  const N = window.NetworkLab,
    U = window.UTXOLab,
    M = window.AMMLab,
    $ = (id) => document.getElementById(id),
    fmt = M.formatAmount;
  let net,
    selected = "A",
    step = 0,
    busy = true,
    controller = null,
    miningReport = null,
    lastReorg = null,
    attack = null;
  const names = ["A", "B", "C"],
    lessons = [
      [
        "传播交易",
        "签了两份交易，网络会先收到哪一份？",
        "X 给 Bob，Y 给 Eve。都由 Alice 签名，都花同一笔 70：转出 45，找零 24，费用 1。",
      ],
      [
        "制造分叉",
        "两个节点，都挖出了合法的一块。",
        "A、B 的历史确认 X，C 的历史确认 Y。每条链各自有效，但它们不能在同一段历史里同时花那笔 70。",
      ],
      [
        "等工作",
        "两票对一票，足够让节点切换吗？",
        "比较有效累计工作，而不是节点数量。等工作分叉会暂时保留当前链，分歧还没有结束。",
      ],
      [
        "重组账本",
        "接受另一段历史，余额怎样恢复正确？",
        "先识别共同祖先，撤下旧分支，再从共同初始账本重放新链。余额与费用都必须对应新历史。",
      ],
      [
        "拒绝无效链",
        "证明工作更多，就能替别人花钱吗？",
        "挖矿不会赋予交易权限。每一块的交易都要验证；无权花费的长链仍被拒绝。",
      ],
    ];
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const short = (s) => (s.length > 20 ? s.slice(0, 9) + "…" + s.slice(-6) : s);
  const owner = (id) =>
    Object.keys(net.people).find((name) => net.people[name].id === id) ||
    "未知";
  const label = (tx) =>
    !tx
      ? "空块"
      : tx.id === net.candidates.X.id
        ? "X → Bob"
        : tx.id === net.candidates.Y.id
          ? "Y → Eve"
          : "其他交易";
  function status(text, error = false) {
    $("net-status").textContent = text;
    $("net-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function controls() {
    document
      .querySelectorAll("button,select")
      .forEach((n) => (n.disabled = busy));
    $("net-stop").hidden = !controller;
    $("net-stop").disabled = !controller || controller.signal.aborted;
    if (busy) return;
    $("net-prev").disabled = step === 0;
    $("net-next").disabled = step === 4;
    $("net-seed").disabled = !names.every(
      (name) =>
        net.nodes[name].chain.length === 1 &&
        net.nodes[name].pending.length === 0,
    );
    $("net-fork").disabled = !(
      net.nodes.A.chain.length === 1 &&
      net.nodes.C.chain.length === 1 &&
      net.nodes.A.pending[0]?.id === net.candidates.X.id &&
      net.nodes.C.pending[0]?.id === net.candidates.Y.id
    );
    $("net-extend").disabled =
      net.nodes.C.chain.length !== 2 ||
      net.nodes.C.pending.length !== 0 ||
      net.nodes.C.chain[1].transaction?.id !== net.candidates.Y.id;
    $("net-converge").disabled = net.nodes.C.chain.length < 3;
    $("net-mine").disabled = net.nodes[selected].chain.length >= 8;
  }
  function select(index) {
    step = Math.max(0, Math.min(4, index));
    document.querySelectorAll("[data-net-step]").forEach((b) => {
      if (Number(b.dataset.netStep) === step)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    ["receive", "fork", "tie", "reorg", "invalid"].forEach(
      (p, i) => ($("net-" + p + "-panel").hidden = i !== step),
    );
    $("net-step-label").textContent = `0${step + 1} / ${lessons[step][0]}`;
    $("net-title").textContent = lessons[step][1];
    $("net-description").textContent = lessons[step][2];
    $("net-control-title").textContent = lessons[step][0];
    $("net-progress").textContent = `第 ${step + 1} / 5 步`;
    controls();
  }
  function render() {
    const cards = $("net-nodes");
    cards.replaceChildren();
    names.forEach((name) => {
      const n = net.nodes[name],
        b = el("button", undefined, "network-node");
      b.type = "button";
      b.dataset.netNode = name;
      b.setAttribute("aria-pressed", String(name === selected));
      b.append(
        el("strong", "节点 " + name),
        el(
          "span",
          `高度 ${n.chain.length - 1} · 有效工作 ${(n.chain.length - 1) * 16}`,
        ),
        el(
          "small",
          `待确认 ${n.pending.length} 笔 · 当前链 ${
            n.chain
              .filter((v) => v.transaction)
              .map((v) => label(v.transaction))
              .join("，") || "尚无交易"
          }`,
        ),
      );
      b.addEventListener("click", () => {
        selected = name;
        render();
      });
      cards.append(b);
    });
    const tips = names.map((name) => net.nodes[name].chain.at(-1).hash),
      agreed = new Set(tips).size === 1;
    const longest = names
      .map((name) => net.nodes[name].chain)
      .reduce((a, b) => (b.length > a.length ? b : a));
    const competing = names.some((name) =>
      net.nodes[name].chain.some((block, i) => block.hash !== longest[i].hash),
    );
    $("net-agreement").textContent = agreed
      ? "A / B / C 当前末块相同。未来仍可能出现新分叉。"
      : competing
        ? "节点末块不同：当前存在分叉。每条链的账本按各自历史计算。"
        : "节点尚未同步：较短的链是同一分支的前缀，暂未出现竞争分叉。";
    $("net-node").value = selected;
    const n = net.nodes[selected];
    $("net-ledger-title").textContent = `节点 ${selected} · 当前选中链`;
    $("net-ledger-tag").textContent =
      `高度 ${n.chain.length - 1} · 工作 ${(n.chain.length - 1) * 16}`;
    $("net-blocks").replaceChildren(
      ...n.chain.map((b, i) =>
        el(
          "span",
          i === 0 ? "G · 共同初始账本" : `${i} · ${label(b.transaction)}`,
          "network-block",
        ),
      ),
    );
    $("net-hashes").textContent = n.chain
      .map(
        (b) =>
          `#${b.index} ${b.hash}\n${b.index === 0 ? b.data : b.transaction ? "交易 ID " + b.transaction.id + "\n完整材料摘要 " + b.data : "无交易的空块"}`,
      )
      .join("\n\n");
    $("net-pending").textContent =
      `待确认池：${n.pending.map(label).join("，") || "空"}。当前链确认 ${n.ledger.accepted.length} 笔交易。`;
    ["Alice", "Bob", "Eve"].forEach(
      (name) =>
        ($("net-" + name.toLowerCase()).textContent = fmt(
          U.balance(n.ledger, net.people[name].id),
        )),
    );
    $("net-fees").textContent = fmt(n.ledger.fees);
    $("net-ledger").replaceChildren();
    n.ledger.utxos.forEach((c) => {
      const row = el("tr"),
        ref = el("td"),
        d = el("details");
      d.append(el("summary", short(c.ref)), el("code", c.ref, "utxo-hex"));
      ref.append(d);
      row.append(el("td", owner(c.owner)), el("td", fmt(c.amount)), ref);
      $("net-ledger").append(row);
    });
    $("net-conservation").textContent =
      `UTXO ${fmt(U.total(n.ledger) - n.ledger.fees)} + 费用 ${fmt(n.ledger.fees)} = ${fmt(U.total(n.ledger))}；初始总量 150，资产守恒。`;
    $("net-reorg-summary").textContent = lastReorg
      ? `节点 ${lastReorg.node} · 共同祖先 #${lastReorg.ancestor}；撤下 ${lastReorg.detached} 块，接入 ${lastReorg.attached} 块。`
      : "等待更多有效工作的分支接入。";
    $("net-reorg-detail").replaceChildren();
    if (lastReorg) {
      $("net-reorg-detail").append(
        el(
          "p",
          `恢复待确认 ${lastReorg.restored.length} 笔；丢弃 ${lastReorg.dropped.length} 笔。`,
          "caption",
        ),
      );
      lastReorg.dropped.forEach((d) =>
        $("net-reorg-detail").append(
          el(
            "p",
            `${short(d.id)}：${d.signatureValid ? "签名仍有效；" : ""}${d.reason}`,
            "caption",
          ),
        ),
      );
    }
    $("net-attack-report").hidden = !attack;
    if (attack) {
      $("net-attack-report").replaceChildren(
        el(
          "strong",
          `最近候选：${attack.proofWork} 证明工作，${attack.candidateWork} 有效工作`,
        ),
        el(
          "p",
          `真实验签：${attack.signatureValid ? "通过" : "未通过"}；输入所有者：${attack.ownershipValid ? "通过" : "未通过"}。`,
        ),
        el("p", attack.message),
      );
    }
    $("net-events").replaceChildren(
      ...net.events.slice(-6).map((text) => el("li", text)),
    );
    controls();
  }
  async function run(action, mining = false) {
    if (busy) return;
    busy = true;
    if (mining) {
      controller = new AbortController();
      miningReport = null;
    }
    let completed = false;
    controls();
    try {
      await action();
      completed = true;
      render();
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
        $("net-nodes").animate(
          [{ backgroundColor: "#d9e7ff" }, { backgroundColor: "transparent" }],
          { duration: 450 },
        );
    } catch (e) {
      status(e.message, true);
      render();
    } finally {
      if (mining)
        $("net-mining").textContent =
          `本次挖矿${completed ? "已完成" : "未提交修改"}。${miningReport ? `最后报告：区块 #${miningReport.blockIndex}，本块尝试 ${miningReport.attempts} 次。` : "尚无尝试报告。"}期望工作与尝试次数分开。`;
      controller = null;
      busy = false;
      controls();
    }
  }
  const options = () => ({
    signal: controller?.signal,
    onProgress: (p) => {
      miningReport = p;
      $("net-mining").textContent =
        `正在尝试真实 SHA-256：区块 #${p.blockIndex}，本块已尝试 ${p.attempts} 次。`;
    },
  });
  function adoptResult(r, node) {
    net = r.network;
    if (r.reorg) lastReorg = { ...r.reorg, node };
    return r.message;
  }
  async function initialize() {
    const next = await N.createNetwork();
    net = next;
    selected = "A";
    lastReorg = attack = null;
    $("net-source").value = "C";
    $("net-transaction").value = "X";
    $("net-mining").textContent =
      "每个非创世有效块记 16 单位期望工作；与本次尝试次数分开。";
    select(0);
    render();
    status("先投递交易。节点收到候选后，余额还不会改变。");
    $("net-loading").hidden = true;
    document.body.dataset.ready = "true";
  }
  document
    .querySelectorAll("[data-net-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.netStep))),
    );
  $("net-prev").addEventListener("click", () => select(step - 1));
  $("net-next").addEventListener("click", () => select(step + 1));
  $("net-node").addEventListener("change", () => {
    selected = $("net-node").value;
    render();
  });
  $("net-reset").addEventListener("click", () => run(initialize));
  $("net-stop").addEventListener("click", () => {
    controller?.abort();
    controls();
  });
  $("net-receive").addEventListener("click", () =>
    run(async () => {
      const r = await N.receive(
        net,
        selected,
        net.candidates[$("net-transaction").value],
      );
      net = r.network;
      status(r.message, !r.accepted);
    }),
  );
  $("net-seed").addEventListener("click", () =>
    run(async () => {
      let next = net;
      for (const [node, key] of [
        ["A", "X"],
        ["B", "X"],
        ["C", "Y"],
      ])
        next = (await N.receive(next, node, next.candidates[key])).network;
      net = next;
      status("A / B 的待确认池保存 X，C 保存 Y。三个节点余额均未改变。");
    }),
  );
  $("net-mine").addEventListener("click", () =>
    run(async () => {
      net = await N.mine(net, selected, options());
      status(net.events.at(-1));
    }, true),
  );
  $("net-fork").addEventListener("click", () =>
    run(async () => {
      let next = await N.mine(net, "A", options());
      next = await N.mine(next, "C", options());
      const r = await N.deliver(next, "A", "B");
      if (controller.signal.aborted)
        throw new Error("挖矿已停止，节点账本未提交修改。");
      net = r.network;
      if (r.reorg) lastReorg = { ...r.reorg, node: "B" };
      status("A 确认 X，C 确认 Y，各有 16 有效工作。" + r.message);
    }, true),
  );
  $("net-tie").addEventListener("click", () =>
    run(async () => {
      const a = await N.deliver(net, "C", "A");
      const first = adoptResult(a, "A");
      const b = await N.deliver(net, "C", "B");
      status(first + " " + adoptResult(b, "B"));
    }),
  );
  $("net-send").addEventListener("click", () =>
    run(async () => {
      const r = await N.deliver(net, $("net-source").value, selected);
      status(adoptResult(r, selected), r.reason === "invalid");
    }),
  );
  $("net-extend").addEventListener("click", () =>
    run(async () => {
      net = await N.mine(net, "C", options());
      status("C 的 Y 分支新增空块；空块增加工作，余额和费用没有改变。");
    }, true),
  );
  $("net-converge").addEventListener("click", () =>
    run(async () => {
      const a = await N.deliver(net, "C", "A");
      const first = adoptResult(a, "A");
      const b = await N.deliver(net, "C", "B");
      status(first + " " + adoptResult(b, "B"));
    }),
  );
  $("net-attack").addEventListener("click", () =>
    run(async () => {
      const chain = await N.makeInvalidChain(net, options()),
        check = await U.verify(net.initial, chain[1].transaction),
        r = await N.adopt(net, selected, chain, "无权交易候选");
      if (controller.signal.aborted)
        throw new Error("挖矿已停止，节点账本未提交修改。");
      net = r.network;
      attack = {
        ...r,
        signatureValid: check.signatureValid,
        ownershipValid: check.ownershipValid,
      };
      status(r.message, true);
    }, true),
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
      $("net-loading").textContent = e.message;
      status(e.message, true);
    });
})();
