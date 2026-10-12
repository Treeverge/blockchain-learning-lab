(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(
      require("node:crypto").webcrypto,
      require("./chain.js"),
    );
  else root.UTXOLab = factory(root.crypto, root.ChainLab);
})(globalThis, function (crypto, C) {
  "use strict";
  const hex = (bytes) =>
    Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const bytes = (s) => {
    if (typeof s !== "string" || !/^(?:[a-f0-9]{2})+$/.test(s))
      throw new Error("十六进制字段无效。");
    return Uint8Array.from(s.match(/../g), (b) => parseInt(b, 16));
  };
  const identity = (s) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
  function body(tx) {
    if (
      !tx ||
      tx.version !== 1 ||
      !Array.isArray(tx.inputs) ||
      tx.inputs.length < 1 ||
      tx.inputs.length > 8 ||
      !tx.inputs.every(
        (r) => typeof r === "string" && r.length > 0 && r.length < 100,
      ) ||
      !Array.isArray(tx.outputs) ||
      tx.outputs.length < 1 ||
      tx.outputs.length > 8 ||
      !tx.outputs.every(
        (o) =>
          o &&
          identity(o.owner) &&
          typeof o.amount === "bigint" &&
          o.amount > 0n,
      ) ||
      typeof tx.fee !== "bigint" ||
      tx.fee < 0n
    )
      throw new Error("交易字段或金额无效。");
    return JSON.stringify([
      "UTXO-LAB-v1",
      tx.inputs,
      tx.outputs.map((o) => [o.owner, o.amount.toString()]),
      tx.fee.toString(),
    ]);
  }
  function cloneTx(tx) {
    return {
      ...tx,
      inputs: [...tx.inputs],
      outputs: tx.outputs.map((o) => ({ ...o })),
      witnesses: (tx.witnesses || []).map((w) => ({ ...w })),
    };
  }
  async function rehash(tx) {
    const next = cloneTx(tx);
    next.id = await C.sha256(body(next));
    return next;
  }
  async function createLab() {
    if (!crypto?.subtle)
      throw new Error(
        "此环境不支持 Web Crypto，请使用现代浏览器的 HTTPS 页面或本地文件。",
      );
    const people = {};
    await Promise.all(
      ["Alice", "Bob", "Eve"].map(async (name) => {
        const keys = await crypto.subtle.generateKey(
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["sign", "verify"],
        );
        const publicHex = hex(
          await crypto.subtle.exportKey("raw", keys.publicKey),
        );
        people[name] = { ...keys, publicHex, id: await C.sha256(publicHex) };
      }),
    );
    const scale = 1000000n;
    return {
      people,
      state: {
        utxos: [
          {
            ref: "seed-alice-30:0",
            owner: people.Alice.id,
            amount: 30n * scale,
          },
          {
            ref: "seed-alice-70:0",
            owner: people.Alice.id,
            amount: 70n * scale,
          },
          { ref: "seed-bob-50:0", owner: people.Bob.id, amount: 50n * scale },
        ],
        fees: 0n,
        spent: [],
        accepted: [],
      },
    };
  }
  async function createTransfer(state, sender, recipient, refs, amount, fee) {
    if (
      !identity(sender) ||
      !identity(recipient) ||
      typeof amount !== "bigint" ||
      amount <= 0n ||
      typeof fee !== "bigint" ||
      fee < 0n
    )
      throw new Error("收款身份、转账金额或手续费无效。");
    if (!Array.isArray(refs) || !refs.length)
      throw new Error("请至少选择一个输入。");
    if (new Set(refs).size !== refs.length) throw new Error("输入引用重复。");
    let sum = 0n;
    for (const ref of refs) {
      const coin = state.utxos.find((v) => v.ref === ref);
      if (!coin) throw new Error("输入不存在或已花费。");
      if (coin.owner !== sender) throw new Error("输入所有者与发送者不一致。");
      sum += coin.amount;
    }
    if (sum < amount + fee) throw new Error("所选输入金额不足。");
    const outputs = [{ owner: recipient, amount }];
    if (sum > amount + fee)
      outputs.push({ owner: sender, amount: sum - amount - fee });
    return rehash({
      version: 1,
      inputs: [...refs],
      outputs,
      fee,
      witnesses: [],
    });
  }
  async function sign(tx, person) {
    const next = await rehash(tx);
    const signatureHex = hex(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        person.privateKey,
        new TextEncoder().encode(body(next)),
      ),
    );
    next.witnesses = next.inputs.map((ref) => ({
      ref,
      publicHex: person.publicHex,
      signatureHex,
    }));
    return next;
  }
  async function verify(state, tx) {
    const r = {
      valid: false,
      hashValid: false,
      inputsValid: false,
      ownershipValid: null,
      signatureValid: false,
      amountsValid: null,
      reasons: [],
    };
    let message;
    try {
      message = body(tx);
    } catch (e) {
      r.reasons.push(e.message);
      return r;
    }
    r.hashValid = tx.id === (await C.sha256(message));
    if (!r.hashValid) r.reasons.push("交易 ID 与主体不匹配。");
    const coins = tx.inputs.map((ref) =>
      state.utxos.find((v) => v.ref === ref),
    );
    const available = coins.every(Boolean),
      unique = new Set(tx.inputs).size === tx.inputs.length;
    r.inputsValid = available && unique && !state.accepted.includes(tx.id);
    if (!unique) r.reasons.push("输入引用重复。");
    if (!available) r.reasons.push("输入不存在或已花费。");
    if (state.accepted.includes(tx.id)) r.reasons.push("交易重复确认。");
    let signatures = true,
      owners = true;
    const witnesses = Array.isArray(tx.witnesses) ? tx.witnesses : [];
    if (witnesses.length !== tx.inputs.length) signatures = owners = false;
    for (let i = 0; i < tx.inputs.length; i++) {
      const w = witnesses[i];
      try {
        if (
          !w ||
          w.ref !== tx.inputs[i] ||
          !/^04[a-f0-9]{128}$/.test(w.publicHex) ||
          !/^[a-f0-9]{128}$/.test(w.signatureHex)
        )
          throw new Error("签名字段无效");
        const key = await crypto.subtle.importKey(
          "raw",
          bytes(w.publicHex),
          { name: "ECDSA", namedCurve: "P-256" },
          false,
          ["verify"],
        );
        if (
          !(await crypto.subtle.verify(
            { name: "ECDSA", hash: "SHA-256" },
            key,
            bytes(w.signatureHex),
            new TextEncoder().encode(message),
          ))
        )
          signatures = false;
        if (coins[i] && (await C.sha256(w.publicHex)) !== coins[i].owner)
          owners = false;
      } catch {
        signatures = owners = false;
      }
    }
    r.signatureValid = signatures;
    r.ownershipValid = available ? owners : null;
    if (!signatures) r.reasons.push("签名缺失或签名验证失败。");
    if (available && !owners) r.reasons.push("签名公钥与输入所有者不匹配。");
    if (available) {
      r.amountsValid =
        coins.reduce((s, c) => s + c.amount, 0n) ===
        tx.outputs.reduce((s, o) => s + o.amount, tx.fee);
      if (!r.amountsValid) r.reasons.push("输入总额不等于输出总额加手续费。");
    }
    r.valid =
      r.hashValid &&
      r.inputsValid &&
      r.signatureValid &&
      r.ownershipValid === true &&
      r.amountsValid === true;
    return r;
  }
  async function apply(state, tx) {
    const r = await verify(state, tx);
    if (!r.valid) throw new Error(r.reasons.join(" "));
    const refs = new Set(tx.inputs);
    return {
      utxos: [
        ...state.utxos.filter((c) => !refs.has(c.ref)).map((c) => ({ ...c })),
        ...tx.outputs.map((o, i) => ({ ...o, ref: tx.id + ":" + i })),
      ],
      fees: state.fees + tx.fee,
      spent: [...state.spent, ...tx.inputs],
      accepted: [...state.accepted, tx.id],
    };
  }
  const balance = (state, owner) =>
    state.utxos
      .filter((c) => c.owner === owner)
      .reduce((s, c) => s + c.amount, 0n);
  const total = (state) =>
    state.utxos.reduce((s, c) => s + c.amount, state.fees);
  return {
    createLab,
    createTransfer,
    cloneTx,
    rehash,
    sign,
    verify,
    apply,
    balance,
    total,
  };
});
