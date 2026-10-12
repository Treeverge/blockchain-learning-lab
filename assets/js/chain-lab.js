"use strict";
(async () => {
  const C = window.ChainLab,
    $ = (id) => document.getElementById(id);
  let current = await C.createChain(),
    candidate = current.map((b) => ({ ...b })),
    anchor = current[0].hash,
    d = 0,
    step = 0,
    busy = false,
    controller = null;
  const lessons = [
    [
      "看哈希",
      "每个区块的哈希，究竟包含什么？",
      "序号、前块哈希、记录文本和 nonce 一起参与计算。右侧可展开完整输入。",
    ],
    [
      "改记录",
      "把采购款从 100 改成 900，哪里出了问题？",
      "只改数据，保留旧哈希。注意后块自身可能仍然正确，但它依赖的前序已经无效。",
    ],
    [
      "修链接",
      "重算之后，修改过的账本竟然又自洽了。",
      "修复保存的哈希与后续链接，看看为什么单靠哈希不能阻止自己重写整段文本历史。",
    ],
    [
      "比节点",
      "你的账本有效，其他节点为什么还保存另一份？",
      "三份账本是独立快照。不同末块哈希表示历史分歧，哈希本身不提供接受规则。",
    ],
    [
      "挖矿选链",
      "重新挖完也不一定被接受，还要比较有效累计工作。",
      "先建立 PoW 基准，再改旧记录并重算。重新挖矿后尝试传播；等工作保持当前，再追加有效区块试试。",
    ],
  ];
  function status(text, error = false) {
    $("chain-status").textContent = text;
    $("chain-status").className =
      "feedback lp-status " + (error ? "error" : "success");
  }
  function lock(value) {
    busy = value;
    document
      .querySelectorAll("main button, main input, main select, main textarea")
      .forEach((e) => (e.disabled = value));
    $("chain-stop").disabled = !value;
    $("chain-prev").disabled = value || step === 0;
    $("chain-next").disabled = value || step === 4;
    for (const id of ["chain-mine", "chain-append", "chain-send"])
      $(id).disabled = value || d === 0;
  }
  function select(index) {
    step = index;
    document.querySelectorAll("[data-chain-step]").forEach((b) => {
      if (Number(b.dataset.chainStep) === index)
        b.setAttribute("aria-current", "step");
      else b.removeAttribute("aria-current");
    });
    $("chain-step-label").textContent = `0${index + 1} / ${lessons[index][0]}`;
    $("chain-title").textContent = lessons[index][1];
    $("chain-description").textContent = lessons[index][2];
    $("chain-control-title").textContent = lessons[index][0];
    $("chain-hash-panel").hidden = index !== 0;
    $("chain-edit-panel").hidden = ![1, 2, 4].includes(index);
    $("chain-node-panel").hidden = index !== 3;
    $("chain-pow-panel").hidden = index !== 4;
    $("chain-progress").textContent = `第 ${index + 1} / 5 步`;
    lock(false);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.getAnimations().forEach((a) => a.cancel());
    else
      document
        .querySelector(".lesson-intro")
        .animate([{ opacity: 0.65 }, { opacity: 1 }], { duration: 220 });
  }
  async function render() {
    const a = await C.inspect(candidate, anchor, d),
      b = await C.inspect(current, anchor, d);
    $("chain-mode").textContent = d ? "PoW · " + d + " 位前导零" : "未启用证明";
    $("chain-validity").textContent = a.valid
      ? "整条链通过校验"
      : "存在无效区块";
    $("chain-validity").className =
      "tag " + (a.valid ? "valid-tag" : "invalid-tag");
    $("chain-difficulty-note").textContent = d
      ? "所有节点共用难度 " + d
      : "尚未使用工作量规则";
    $("chain-blocks").replaceChildren();
    for (const [i, block] of candidate.entries()) {
      const row = a.rows[i],
        article = document.createElement("article");
      article.className =
        "chain-block " +
        (row.ancestryValid ? "chain-block-valid" : "chain-block-invalid");
      const header = document.createElement("div");
      header.className = "panel-heading";
      const title = document.createElement("h4");
      title.textContent = `区块 #${i}`;
      const nonce = document.createElement("span");
      nonce.className = "tag";
      nonce.textContent = i === 0 ? "共同创世锚点" : "nonce " + block.nonce;
      header.append(title, nonce);
      const record = document.createElement("p");
      record.className = "chain-record";
      record.textContent = block.data;
      const hashes = document.createElement("div");
      hashes.className = "chain-hash-pair";
      for (const [label, value] of [
        ["前块哈希", block.prevHash],
        ["本块哈希", block.hash],
      ]) {
        const p = document.createElement("p");
        const small = document.createElement("small");
        small.textContent = label;
        const code = document.createElement("code");
        code.textContent = value.slice(0, 14) + "…";
        p.append(small, code);
        hashes.append(p);
      }
      const checks = document.createElement("p");
      checks.className = "chain-checks";
      checks.textContent = `内容哈希 ${row.hashValid ? "✓" : "不符"} · 链接 ${row.linkValid ? "✓" : "不符"} · ${i === 0 ? "创世锚点 " + (row.anchorValid ? "✓" : "不符") : d ? "证明 " + (row.proofValid ? "✓" : "不符") : "证明未启用"}${!row.ancestryValid && row.hashValid ? " · 前序或结构无效" : ""}`;
      const details = document.createElement("details"),
        summary = document.createElement("summary"),
        pre = document.createElement("pre");
      summary.textContent = "完整哈希与输入";
      pre.textContent = `UTF-8 JSON 输入：\n${JSON.stringify([block.index, block.prevHash, block.data, block.nonce])}\n保存：${block.hash}\n重算：${row.computed}`;
      details.append(summary, pre);
      article.append(header, record, hashes, checks, details);
      $("chain-blocks").append(article);
    }
    $("chain-check-summary").textContent = a.valid
      ? "哈希、链接、结构与当前证明条件通过。这不等于记录真实，也不代表已经被其他节点接受。"
      : "区块自身校验与前序完整性需要一起成立，不能只看最后一块。";
    $("chain-nodes").replaceChildren();
    for (const [name, chain, report] of [
      ["A · 候选", candidate, a],
      ["B · 当前", current, b],
      ["C · 当前", current, b],
    ]) {
      const tr = document.createElement("tr");
      for (const text of [
        name,
        String(chain.length),
        chain.at(-1).hash.slice(0, 14) + "…",
        report.valid ? "有效" : "无效",
        d ? report.work.toString() : "未启用",
      ]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }
      $("chain-nodes").append(tr);
    }
    const selected = $("chain-block-index").value;
    $("chain-block-index").replaceChildren();
    for (let i = 1; i < candidate.length; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = "区块 #" + i;
      $("chain-block-index").append(o);
    }
    $("chain-block-index").value =
      Number(selected) < candidate.length ? selected : "1";
  }
  async function action(fn, message) {
    if (busy) return;
    lock(true);
    try {
      await fn();
      await render();
      status(typeof message === "function" ? message() : message);
      return true;
    } catch (e) {
      status(e.message, true);
      return false;
    } finally {
      lock(false);
    }
  }
  async function mining(fn, onCommit) {
    controller = new AbortController();
    const start = performance.now();
    let attempts = 0;
    const committed = await action(
      async () => {
        const result = await fn({
          signal: controller.signal,
          onProgress: (p) => {
            attempts = p.totalAttempts ?? p.attempts;
            $("chain-mining-progress").textContent =
              `正在计算区块 #${p.blockIndex} · 累计尝试 ${attempts} 次 · ${((performance.now() - start) / 1000).toFixed(2)} 秒`;
          },
        });
        onCommit(result);
      },
      () => {
        const text = `挖矿完成 · ${attempts} 次实际尝试 · ${((performance.now() - start) / 1000).toFixed(2)} 秒。`;
        $("chain-mining-progress").textContent = text;
        return text + " 校验有效性后，还要按共同规则比较累计工作。";
      },
    );
    if (!committed)
      $("chain-mining-progress").textContent =
        `未提交修改 · 最近报告 ${attempts} 次尝试 · ${((performance.now() - start) / 1000).toFixed(2)} 秒`;
    controller = null;
  }
  document
    .querySelectorAll("[data-chain-step]")
    .forEach((b) =>
      b.addEventListener("click", () => select(Number(b.dataset.chainStep))),
    );
  $("chain-prev").addEventListener("click", () =>
    select(Math.max(0, step - 1)),
  );
  $("chain-next").addEventListener("click", () =>
    select(Math.min(4, step + 1)),
  );
  $("chain-tamper").addEventListener("click", () =>
    action(() => {
      candidate = C.edit(
        candidate,
        Number($("chain-block-index").value),
        $("chain-data").value,
      );
    }, "记录已改变，保存的旧哈希未更新。观察哪个区块开始失效。"),
  );
  $("chain-repair").addEventListener("click", () =>
    action(async () => {
      candidate = await C.repair(
        candidate,
        Number($("chain-block-index").value),
      );
    }, "已重算从选中块开始的哈希与链接。没有重新挖矿，也没有修改节点 B/C。"),
  );
  $("chain-prepare").addEventListener("click", () => {
    const target = Number($("chain-difficulty").value);
    mining(
      async (options) => C.mineChain(await C.createChain(), target, options),
      (result) => {
        current = result;
        candidate = result.map((b) => ({ ...b }));
        d = target;
        $("chain-node-result").textContent =
          "基准已建立。现在重新修改旧记录、修复链接，再比较证明条件。";
      },
    );
  });
  $("chain-mine").addEventListener("click", () =>
    mining(
      (options) => C.mineChain(candidate, d, options),
      (result) => (candidate = result),
    ),
  );
  $("chain-append").addEventListener("click", () =>
    mining(
      async (options) => {
        if (!(await C.inspect(candidate, anchor, d)).valid)
          throw new Error("请先完成候选链的校验与挖矿，再追加有效区块。");
        return C.append(candidate, "补充记录：继续出块", d, options);
      },
      (result) => (candidate = result),
    ),
  );
  $("chain-send").addEventListener("click", () =>
    action(
      async () => {
        const result = await C.selectChain(current, candidate, anchor, d);
        let text;
        if (result.accepted) {
          text = `接受候选链：有效工作 ${result.candidateWork} > 当前 ${result.currentWork}，节点 B/C 已切换。`;
          current = candidate.map((b) => ({ ...b }));
        } else
          text =
            result.reason === "invalid"
              ? "拒绝：候选链校验未通过，节点 B/C 不变。"
              : result.reason === "tie"
                ? "候选链有效，但累计工作相同：本模型保留当前链，节点 B/C 不变。"
                : "候选链有效，但累计工作更少，节点 B/C 不变。";
        $("chain-node-result").textContent = text;
      },
      () => $("chain-node-result").textContent,
    ),
  );
  $("chain-stop").addEventListener("click", () => controller?.abort());
  $("chain-reset").addEventListener("click", () =>
    action(async () => {
      current = await C.createChain();
      candidate = current.map((b) => ({ ...b }));
      anchor = current[0].hash;
      d = 0;
      $("chain-mining-progress").textContent = "尚未挖矿。";
      $("chain-node-result").textContent = "已重置三个节点的快照。";
    }, "原始记录与全部节点已恢复，工作量规则未启用。"),
  );
  await render();
  select(0);
  document.body.dataset.ready = "true";
  $("chain-loading").hidden = true;
})().catch((error) => {
  const loading = document.getElementById("chain-loading");
  loading.textContent =
    "实验无法初始化：" + error.message + " 请刷新重试或使用本地预览。";
});
