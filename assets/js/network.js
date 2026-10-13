(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./chain.js"), require("./utxo.js"));
  else root.NetworkLab = factory(root.ChainLab, root.UTXOLab);
})(globalThis, function (C, U) {
  "use strict";
  const names = ["A", "B", "C"],
    difficulty = 1;
  const cloneLedger = (s) => ({
    utxos: s.utxos.map((c) => ({ ...c })),
    fees: s.fees,
    spent: [...s.spent],
    accepted: [...s.accepted],
  });
  const cloneChain = (chain) =>
    chain.map((b) => ({
      ...b,
      transaction: b.transaction ? U.cloneTx(b.transaction) : null,
    }));
  function nodeOf(net, name) {
    if (!names.includes(name)) throw new Error("请选择节点 A、B 或 C。");
    return net.nodes[name];
  }
  function copy(net) {
    return {
      ...net,
      nodes: Object.fromEntries(
        names.map((name) => {
          const n = net.nodes[name];
          return [
            name,
            {
              ...n,
              chain: cloneChain(n.chain),
              ledger: cloneLedger(n.ledger),
              pending: n.pending.map(U.cloneTx),
            },
          ];
        }),
      ),
      events: [...net.events],
    };
  }
  function event(net, text) {
    net.events.push(text);
    net.events = net.events.slice(-30);
  }
  async function record(tx) {
    if (tx === null) return "empty";
    // Unlike the teaching body ID, this commitment also binds the exact public keys and signatures.
    return (
      "tx:" +
      (await C.sha256(
        JSON.stringify([
          tx.version,
          tx.id,
          tx.inputs,
          tx.outputs.map((o) => [o.owner, o.amount.toString()]),
          tx.fee.toString(),
          tx.witnesses.map((w) => [w.ref, w.publicHex, w.signatureHex]),
        ]),
      ))
    );
  }
  async function createNetwork() {
    const lab = await U.createLab();
    const seed = await C.sha256(
      JSON.stringify([
        lab.state.utxos.map((c) => [c.ref, c.owner, c.amount.toString()]),
        lab.state.fees.toString(),
        lab.state.spent,
        lab.state.accepted,
      ]),
    );
    const genesis = {
      index: 0,
      prevHash: "0".repeat(64),
      data: "初始 UTXO 摘要：" + seed,
      nonce: 0,
      transaction: null,
    };
    genesis.hash = await C.hashBlock(genesis);
    const candidates = {};
    for (const [key, recipient] of [
      ["X", "Bob"],
      ["Y", "Eve"],
    ]) {
      candidates[key] = await U.sign(
        await U.createTransfer(
          lab.state,
          lab.people.Alice.id,
          lab.people[recipient].id,
          ["seed-alice-70:0"],
          45000000n,
          1000000n,
        ),
        lab.people.Alice,
      );
    }
    return {
      people: lab.people,
      initial: cloneLedger(lab.state),
      anchor: genesis.hash,
      difficulty,
      candidates,
      nodes: Object.fromEntries(
        names.map((name) => [
          name,
          {
            chain: cloneChain([genesis]),
            ledger: cloneLedger(lab.state),
            pending: [],
          },
        ]),
      ),
      events: ["共同创世账本已建立；X 与 Y 已由 Alice 真实签名。"],
    };
  }
  async function replay(net, chain) {
    const proof = await C.inspect(chain, net.anchor, difficulty);
    const result = {
      valid: false,
      proofValid: proof.valid,
      proofWork: proof.work,
      work: 0n,
      ledger: null,
      reason: "",
    };
    if (!proof.valid) {
      result.reason = "区块哈希、链接、锚点或工作量证明不通过。";
      return result;
    }
    if (chain[0].transaction !== null) {
      result.reason = "创世块不能携带交易。";
      return result;
    }
    let ledger = cloneLedger(net.initial);
    for (let i = 1; i < chain.length; i++) {
      try {
        if (chain[i].data !== (await record(chain[i].transaction)))
          throw new Error("区块交易摘要与完整交易 / 签名不匹配。");
        if (chain[i].transaction !== null)
          ledger = await U.apply(ledger, chain[i].transaction);
      } catch (e) {
        result.reason = `区块 #${i}：${e.message}`;
        return result;
      }
    }
    return { ...result, valid: true, ledger, work: proof.work };
  }
  async function receive(net, name, tx) {
    const n = nodeOf(net, name),
      report = await U.verify(n.ledger, tx),
      next = copy(net);
    let reason = !report.valid
      ? "invalid"
      : n.pending.some((p) => p.id === tx.id)
        ? "duplicate"
        : n.pending.some((p) => p.inputs.some((ref) => tx.inputs.includes(ref)))
          ? "pending-conflict"
          : "pending";
    const accepted = reason === "pending";
    if (accepted) next.nodes[name].pending.push(U.cloneTx(tx));
    const message = accepted
      ? `节点 ${name} 收到交易，进入待确认池；账本尚未扣款。`
      : reason === "pending-conflict"
        ? `节点 ${name} 拒绝池内冲突：签名与账本校验通过，但该输入已有先接收的候选。`
        : reason === "duplicate"
          ? `节点 ${name} 已保存这份待确认交易。`
          : `节点 ${name} 拒绝交易：${report.reasons.join(" ")}`;
    event(next, message);
    return { network: next, accepted, reason, report, message };
  }
  async function pendingAgain(ledger, pool) {
    const pending = [],
      restored = [],
      dropped = [],
      seen = new Set();
    for (const tx of pool) {
      if (seen.has(tx.id) || ledger.accepted.includes(tx.id)) continue;
      seen.add(tx.id);
      const r = await U.verify(ledger, tx);
      if (
        r.valid &&
        !pending.some((p) => p.inputs.some((ref) => tx.inputs.includes(ref)))
      ) {
        pending.push(U.cloneTx(tx));
        restored.push(tx.id);
      } else
        dropped.push({
          id: tx.id,
          signatureValid: r.signatureValid,
          reason: r.valid ? "待确认池输入冲突。" : r.reasons.join(" "),
        });
    }
    return { pending, restored, dropped };
  }
  function stopped(options) {
    if (options.signal?.aborted)
      throw new Error("挖矿已停止，节点账本未提交修改。");
  }
  async function mine(net, name, options = {}) {
    const n = nodeOf(net, name);
    stopped(options);
    const current = await replay(net, n.chain);
    if (!current.valid) throw new Error(current.reason);
    const tx = n.pending.length ? U.cloneTx(n.pending[0]) : null;
    if (tx) await U.apply(current.ledger, tx);
    const chain = await C.append(
      n.chain,
      await record(tx),
      difficulty,
      options,
    );
    chain.at(-1).transaction = tx;
    const report = await replay(net, chain);
    if (!report.valid) throw new Error(report.reason);
    const pool = await pendingAgain(report.ledger, n.pending);
    stopped(options);
    const next = copy(net);
    next.nodes[name] = {
      chain: cloneChain(chain),
      ledger: report.ledger,
      pending: pool.pending,
    };
    event(
      next,
      `节点 ${name} 挖出区块 #${chain.length - 1}（${tx ? "一笔交易" : "空块"}）；其他节点尚未收到。`,
    );
    return next;
  }
  async function adopt(net, name, candidate, source = "外部") {
    const n = nodeOf(net, name),
      current = await replay(net, n.chain),
      proposed = await replay(net, candidate);
    if (!current.valid) throw new Error("当前节点链无效：" + current.reason);
    const next = copy(net);
    const reason = !proposed.valid
      ? "invalid"
      : candidate.at(-1).hash === n.chain.at(-1).hash
        ? "same-tip"
        : proposed.work > current.work
          ? "more-work"
          : proposed.work === current.work
            ? "tie"
            : "less-work";
    const accepted = reason === "more-work";
    let reorg = null;
    if (accepted) {
      let common = 0;
      while (
        common < n.chain.length &&
        common < candidate.length &&
        n.chain[common].hash === candidate[common].hash
      )
        common++;
      const detached = n.chain.slice(common),
        orphaned = detached
          .filter((b) => b.transaction)
          .map((b) => b.transaction);
      const pool = await pendingAgain(proposed.ledger, [
        ...n.pending,
        ...orphaned,
      ]);
      next.nodes[name] = {
        chain: cloneChain(candidate),
        ledger: proposed.ledger,
        pending: pool.pending,
      };
      reorg = {
        ancestor: common - 1,
        detached: detached.length,
        attached: candidate.length - common,
        restored: pool.restored.filter((id) =>
          orphaned.some((tx) => tx.id === id),
        ),
        dropped: pool.dropped,
      };
    }
    const message = accepted
      ? `节点 ${name} 接受 ${source} 的更多有效工作：撤下 ${reorg.detached} 块，接入 ${reorg.attached} 块，从初始账本重放。`
      : reason === "invalid"
        ? `节点 ${name} 拒绝 ${source} 的候选链：${proposed.reason}`
        : reason === "tie"
          ? `节点 ${name} 保留当前链：有效累计工作相同，节点数量不参与选链。`
          : reason === "same-tip"
            ? `节点 ${name} 已保存同一条链。`
            : `节点 ${name} 保留当前链：候选有效累计工作更少。`;
    event(next, message);
    return {
      network: next,
      accepted,
      reason,
      reorg,
      currentWork: current.work,
      candidateWork: proposed.work,
      proofWork: proposed.proofWork,
      report: proposed,
      message,
    };
  }
  async function deliver(net, from, to) {
    nodeOf(net, to);
    return adopt(net, to, nodeOf(net, from).chain, "节点 " + from);
  }
  async function makeInvalidChain(net, options = {}) {
    stopped(options);
    const tx = await U.sign(net.candidates.X, net.people.Eve);
    let chain = cloneChain([net.nodes.A.chain[0]]);
    for (const candidate of [tx, null, null]) {
      chain = await C.append(
        chain,
        await record(candidate),
        difficulty,
        options,
      );
      chain.at(-1).transaction = candidate;
    }
    stopped(options);
    return cloneChain(chain);
  }
  return {
    createNetwork,
    cloneChain,
    replay,
    receive,
    mine,
    deliver,
    adopt,
    makeInvalidChain,
  };
});
