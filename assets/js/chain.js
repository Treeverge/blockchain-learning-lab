(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("node:crypto").webcrypto);
  else root.ChainLab = factory(root.crypto);
})(globalThis, function (crypto) {
  "use strict";
  const ZERO = "0".repeat(64),
    MAX_BLOCKS = 8;
  function difficulty(d) {
    if (!Number.isInteger(d) || d < 0 || d > 3)
      throw new Error("实验难度只能是 0 至 3 位前导零。");
  }
  async function sha256(text) {
    if (!crypto?.subtle)
      throw new Error(
        "此环境不支持安全的 SHA-256，请使用现代浏览器、HTTPS 或本地预览。",
      );
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text),
    );
    return Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  }
  function dataValid(data) {
    return (
      typeof data === "string" && data.trim().length > 0 && data.length <= 180
    );
  }
  async function hashBlock(b) {
    if (
      !b ||
      !Number.isSafeInteger(b.index) ||
      b.index < 0 ||
      !Number.isSafeInteger(b.nonce) ||
      b.nonce < 0 ||
      !dataValid(b.data) ||
      !/^([a-f0-9]{64})$/.test(b.prevHash)
    )
      throw new Error("区块字段无效。");
    return sha256(JSON.stringify([b.index, b.prevHash, b.data, b.nonce]));
  }
  function copy(chain) {
    if (!Array.isArray(chain) || !chain.length || chain.length > MAX_BLOCKS)
      throw new Error("本实验支持 1 至 8 个区块。");
    return chain.map((b) => ({ ...b }));
  }
  async function createChain() {
    const result = [];
    for (const [index, data] of [
      "创世区块",
      "工程项目：采购款 100",
      "工程项目：验收款 50",
    ].entries()) {
      const b = {
        index,
        data,
        prevHash: index === 0 ? ZERO : result[index - 1].hash,
        nonce: 0,
      };
      b.hash = await hashBlock(b);
      result.push(b);
    }
    return result;
  }
  function edit(chain, index, data) {
    if (
      !Number.isInteger(index) ||
      index < 1 ||
      index >= chain.length ||
      !dataValid(data)
    )
      throw new Error("只能修改非创世块，文本为 1 至 180 个字符。");
    const result = copy(chain);
    result[index].data = data;
    return result;
  }
  async function repair(chain, start = 1) {
    const result = copy(chain);
    if (!Number.isInteger(start) || start < 0 || start >= result.length)
      throw new Error("起始区块无效。");
    for (let i = start; i < result.length; i++) {
      result[i].prevHash = i === 0 ? ZERO : result[i - 1].hash;
      result[i].nonce = 0;
      result[i].hash = await hashBlock(result[i]);
      result[i].miningAttempts = 0;
    }
    return result;
  }
  async function inspect(chain, anchor, d = 0) {
    difficulty(d);
    if (!Array.isArray(chain) || !chain.length || chain.length > MAX_BLOCKS)
      return { valid: false, rows: [], work: 0n };
    let ancestry = true;
    const rows = [];
    for (let i = 0; i < chain.length; i++) {
      const b = chain[i];
      let computed = null;
      try {
        computed = await hashBlock(b);
      } catch {}
      const hashValid = computed !== null && computed === b?.hash;
      const linkValid = b?.prevHash === (i === 0 ? ZERO : chain[i - 1]?.hash);
      const indexValid = b?.index === i;
      const proofValid =
        i === 0 ||
        (/^([a-f0-9]{64})$/.test(b?.hash) && b.hash.startsWith("0".repeat(d)));
      const anchorValid = i !== 0 || b?.hash === anchor;
      ancestry =
        ancestry &&
        hashValid &&
        linkValid &&
        indexValid &&
        proofValid &&
        anchorValid;
      rows.push({
        index: i,
        computed,
        hashValid,
        linkValid,
        indexValid,
        proofValid,
        anchorValid,
        ancestryValid: ancestry,
      });
    }
    return {
      valid: ancestry,
      rows,
      work:
        ancestry && d > 0 ? BigInt(chain.length - 1) * 16n ** BigInt(d) : 0n,
    };
  }
  function stopped(signal) {
    if (signal?.aborted) throw new Error("挖矿已停止，账本未提交修改。");
  }
  async function findProof(
    block,
    d,
    { signal, maxAttempts = 100000, onProgress } = {},
  ) {
    difficulty(d);
    if (
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 100000
    )
      throw new Error("每块尝试上限为 1 至 100000。");
    for (let nonce = 0; nonce < maxAttempts; nonce++) {
      stopped(signal);
      const b = { ...block, nonce };
      b.hash = await hashBlock(b);
      stopped(signal);
      if (nonce === 0 || nonce % 64 === 0 || b.hash.startsWith("0".repeat(d)))
        onProgress?.({ attempts: nonce + 1, blockIndex: b.index });
      stopped(signal);
      if (b.hash.startsWith("0".repeat(d)))
        return { ...b, miningAttempts: nonce + 1 };
      if (nonce % 64 === 63)
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error("已达到本块尝试上限，请降低难度后重试。");
  }
  async function mineChain(chain, d, options = {}) {
    difficulty(d);
    stopped(options.signal);
    const result = copy(chain);
    let total = 0;
    for (let i = 1; i < result.length; i++) {
      const b = { ...result[i], prevHash: result[i - 1].hash };
      result[i] = await findProof(b, d, {
        ...options,
        onProgress: (p) =>
          options.onProgress?.({ ...p, totalAttempts: total + p.attempts }),
      });
      total += result[i].miningAttempts;
    }
    stopped(options.signal);
    return result;
  }
  async function append(chain, data, d = 0, options = {}) {
    difficulty(d);
    const result = copy(chain);
    if (result.length === MAX_BLOCKS)
      throw new Error("本实验最多 8 个区块，请重置继续比较。");
    if (!dataValid(data)) throw new Error("补充记录文本无效。");
    const b = {
      index: result.length,
      prevHash: result.at(-1).hash,
      data,
      nonce: 0,
    };
    result.push(await findProof(b, d, options));
    return result;
  }
  async function selectChain(current, candidate, anchor, d) {
    const a = await inspect(current, anchor, d),
      b = await inspect(candidate, anchor, d);
    if (!b.valid)
      return {
        accepted: false,
        reason: "invalid",
        currentWork: a.work,
        candidateWork: b.work,
      };
    if (b.work > a.work)
      return {
        accepted: true,
        reason: "more-work",
        currentWork: a.work,
        candidateWork: b.work,
      };
    return {
      accepted: false,
      reason: b.work === a.work ? "tie" : "less-work",
      currentWork: a.work,
      candidateWork: b.work,
    };
  }
  return {
    sha256,
    hashBlock,
    createChain,
    edit,
    repair,
    inspect,
    mineChain,
    append,
    selectChain,
  };
});
