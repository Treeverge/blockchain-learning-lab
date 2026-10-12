"use strict";
(() => {
  const M = window.AMMLab;
  const $ = (id) => document.getElementById(id);
  const fmt = M.formatAmount;
  const lessons = [
    [
      "先预测",
      "池子里各有 1000，交换一定是 1:1 吗？",
      "池子里有 1000 A 和 1000 B。你用 100 A 换 B，手续费为 0.3%。先猜一个结果。",
    ],
    [
      "做交换",
      "执行一次交易，看看每个余额怎么变。",
      "先获取报价，再执行交换。留意：你付出的 A、池子增加的 A，以及你收到的 B 是否能一一对上。",
    ],
    [
      "比深度",
      "同样输入 100，换一个更深的池子。",
      "下面每行都从独立的新池子开始。只改变池子深度或交易规模，观察结果，不混入前一次交易的影响。",
    ],
    [
      "查费用",
      "被扣掉的手续费，最后在哪个账户里？",
      "切换 0% 和 0.3% 手续费，从初始账本分别执行同样的交易。比较输出、完整输入的去向和 k 的变化。",
    ],
    [
      "变报价",
      "报价不是承诺，执行前池子还会变化。",
      "先获取报价，再模拟别人先交易，最后执行你的旧报价。最小接收量会保护你吗？",
    ],
    [
      "讲明白",
      "现在，试着把这次实验讲给别人听。",
      "用你刚才看到的账本变化回答三个问题。选错也没关系，解释会指出应该回看哪一步。",
    ],
  ];
  let state = M.createState();
  let quote = null;
  let step = 0;
  let predicted = false;
  let initialTotal = { A: 3000n * M.SCALE, B: 3000n * M.SCALE };
  const answered = new Map();
  // Animate feedback only; exact ledger values update immediately.
  function motion(elements, frames, duration = 360) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.getAnimations().forEach((animation) => animation.cancel());
      return;
    }
    elements.forEach((element) => {
      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(frames, { duration, easing: "cubic-bezier(.2,.7,.3,1)" });
    });
  }
  function status(message, kind = "") {
    $("trade-status").textContent = message;
    $("trade-status").className = "feedback " + kind;
  }
  function invalidate() {
    quote = null;
    $("quote-caption").textContent = "报价：你将收到";
    $("quoted-output").textContent = "—";
    $("minimum-output").textContent = "—";
    $("execute").disabled = true;
    $("intervene").disabled = true;
  }
  function render() {
    const from = $("direction").value;
    const to = from === "A" ? "B" : "A";
    $("input-token").textContent = from;
    $("amount-unit").textContent = from;
    $("output-token").textContent = to;
    $("available").textContent = fmt(state.wallet[from]);
    for (const token of ["A", "B"]) {
      const suffix = token.toLowerCase();
      $("reserve-" + suffix).textContent = fmt(state.pool[token]);
      for (const actor of ["wallet", "pool", "other"])
        $(actor + "-" + suffix).textContent = fmt(state[actor][token]);
      $("total-" + suffix).textContent = fmt(
        state.wallet[token] + state.pool[token] + state.other[token],
      );
    }
    const conserved = ["A", "B"].every(
      (t) =>
        state.wallet[t] + state.pool[t] + state.other[t] === initialTotal[t],
    );
    $("conservation").textContent = conserved
      ? "A、B 总量守恒 · 手续费包含在储备内"
      : "对账异常，请重置实验";
    const ratio = Number(state.pool.B) / Number(state.pool.A);
    $("pool-ratio").textContent = "1 A ≈ " + ratio.toFixed(6) + " B";
    $("reserve-track-a").style.width =
      (Number(state.pool.A) / Number(state.pool.A + state.pool.B)) * 100 + "%";
    $("revision").textContent =
      state.revision === 0 ? "初始账本" : "已成交 " + state.revision + " 次";
    renderComparison();
  }
  function reset(message = "已恢复初始账本，报价和交易记录已清空。") {
    state = M.createState($("depth").value, Number($("fee").value));
    initialTotal = {
      A: state.pool.A + state.wallet.A + state.other.A,
      B: state.pool.B + state.wallet.B + state.other.B,
    };
    invalidate();
    $("receipt").textContent = "执行后，这里会显示输入、输出和手续费去向。";
    for (const id of ["average-price", "price-impact", "k-change"])
      $(id).textContent = "—";
    status(message);
    render();
    $("trade-flow").hidden = true;
  }
  function setStep(index) {
    step = index;
    document.querySelectorAll("[data-step]").forEach((button) => {
      if (Number(button.dataset.step) === index)
        button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    $("step-label").textContent =
      String(index + 1).padStart(2, "0") + " / " + lessons[index][0];
    $("step-title").textContent = lessons[index][1];
    $("step-description").textContent = lessons[index][2];
    $("prediction-panel").hidden = index !== 0;
    $("workspace").hidden = index === 0 || index === 5;
    $("comparison-panel").hidden = index !== 2;
    $("fee-panel").hidden = index !== 3;
    $("intervene-panel").hidden = index !== 4;
    $("reflection-panel").hidden = index !== 5;
    $("previous").disabled = index === 0;
    $("next").disabled = index === 5 || (index === 0 && !predicted);
    $("progress-label").textContent = `第 ${index + 1} / 6 步`;
    if (index === 4) {
      reset("报价变化实验已重置：先报价，再让另一账户交易。");
    }
    motion(
      [document.querySelector(".lesson-intro")],
      [
        { opacity: 0.65, transform: "translateY(7px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      240,
    );
  }
  function reportTrade(result, before) {
    const actor = result.actor === "wallet" ? "你" : "另一账户";
    $("receipt").textContent =
      `${actor}付出 ${fmt(result.input)} ${result.from}，收到 ${fmt(result.output)} ${result.to}。其中 ${fmt(result.fee)} ${result.from} 为手续费，留在池子里。`;
    const average = Number(result.output) / Number(result.input);
    const spot =
      Number(before.pool[result.to]) / Number(before.pool[result.from]);
    $("average-price").textContent =
      average.toFixed(6) + ` ${result.to}/${result.from}`;
    $("price-impact").textContent =
      ((1 - average / spot) * 100).toFixed(3) + "%";
    const oldK = before.pool.A * before.pool.B;
    const newK = state.pool.A * state.pool.B;
    $("k-change").textContent =
      "+" + ((Number(newK - oldK) / Number(oldK)) * 100).toFixed(6) + "%";
    render();
    $("trade-flow").hidden = false;
    $("flow-actor").textContent = $("flow-recipient").textContent =
      result.actor === "wallet" ? "你的钱包" : "另一账户";
    $("flow-input").textContent = fmt(result.input) + " " + result.from + " →";
    $("flow-output").textContent = fmt(result.output) + " " + result.to + " →";
    motion(
      Array.from(document.querySelectorAll(".flow-route i")),
      [
        { left: "0%", opacity: 0 },
        { left: "12%", opacity: 1, offset: 0.15 },
        { left: "88%", opacity: 1, offset: 0.85 },
        { left: "100%", opacity: 0 },
      ],
      1000,
    );
    const changed = [];
    for (const token of ["A", "B"]) {
      for (const location of ["pool", "wallet", "other"]) {
        if (before[location][token] !== state[location][token])
          changed.push($(location + "-" + token.toLowerCase()));
      }
    }
    motion(
      changed,
      [
        { backgroundColor: "#d9e7ff", color: "#2458df" },
        { backgroundColor: "transparent", color: "#192627" },
      ],
      850,
    );
  }
  function renderComparison() {
    const depthMode = $("compare-mode").value === "depth";
    const rows = (
      depthMode ? ["100", "1000", "10000"] : ["10", "100", "500"]
    ).map((value) => {
      const size = depthMode ? value : "1000";
      const amount = depthMode ? "100" : value;
      const input = M.parseAmount(amount);
      const reserve = M.parseAmount(size);
      return {
        size,
        amount,
        output: M.quoteOutput(reserve, reserve, input, state.feeBps),
        input,
      };
    });
    const max = rows.reduce((a, row) => (row.output > a ? row.output : a), 0n);
    $("comparison-rows").replaceChildren();
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      for (const text of [
        row.size + " / " + row.size,
        row.amount,
        fmt(row.output),
        (Number(row.output) / Number(row.input)).toFixed(6),
      ]) {
        const td = document.createElement("td");
        td.textContent = text;
        tr.append(td);
      }
      const td = document.createElement("td");
      const bar = document.createElement("div");
      bar.className = "compare-bar";
      bar.style.width = (Number(row.output) / Number(max)) * 100 + "%";
      td.append(bar);
      tr.append(td);
      $("comparison-rows").append(tr);
    });
  }
  document
    .querySelectorAll("[data-step]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        setStep(Number(button.dataset.step)),
      ),
    );
  document.querySelectorAll("[data-prediction]").forEach((button) =>
    button.addEventListener("click", () => {
      predicted = true;
      document
        .querySelectorAll("[data-prediction]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      $("prediction-feedback").textContent =
        "预测已记录。接下来执行 100 A 的交换，检查实际结果。";
      $("start-experiment").disabled = false;
      $("next").disabled = false;
    }),
  );
  $("start-experiment").addEventListener("click", () => {
    $("depth").value = "1000";
    $("fee").value = "30";
    $("direction").value = "A";
    $("amount").value = "100";
    reset();
    setStep(1);
  });
  $("next").addEventListener("click", () => {
    if (step < 5) setStep(step + 1);
  });
  $("previous").addEventListener("click", () => {
    if (step > 0) setStep(step - 1);
  });
  $("reset").addEventListener("click", () => reset());
  for (const id of ["depth", "fee"])
    $(id).addEventListener("change", () =>
      reset("实验配置已切换，开始一次新的独立实验。"),
    );
  for (const id of ["amount", "direction", "tolerance"])
    $(id).addEventListener(id === "amount" ? "input" : "change", () => {
      invalidate();
      render();
      status("输入已改变，请重新获取报价。");
    });
  document.querySelectorAll("[data-amount]").forEach((button) =>
    button.addEventListener("click", () => {
      $("amount").value = button.dataset.amount;
      invalidate();
      status("输入已改变，请重新获取报价。");
    }),
  );
  $("quote").addEventListener("click", () => {
    invalidate();
    try {
      quote = M.makeQuote(
        state,
        $("direction").value,
        M.parseAmount($("amount").value),
        Number($("tolerance").value),
      );
      $("quoted-output").textContent = fmt(quote.output);
      $("minimum-output").textContent = fmt(quote.minOutput);
      $("execute").disabled = false;
      $("intervene").disabled = false;
      status("报价已保存，尚未扣款。执行时会重新计算实际输出。", "success");
      motion(
        [$("quoted-output")],
        [
          { color: "#2458df", transform: "translateY(4px)" },
          { color: "#192627", transform: "translateY(0)" },
        ],
      );
    } catch (error) {
      status(error.message, "error");
    }
  });
  $("execute").addEventListener("click", () => {
    try {
      const before = state;
      const result = M.execute(state, quote);
      state = result.state;
      reportTrade(result, before);
      const minimum = quote.minOutput;
      invalidate();
      $("quote-caption").textContent = "本次实际收到";
      $("quoted-output").textContent = fmt(result.output);
      $("minimum-output").textContent = fmt(minimum);
      status("交换成功，资产已完成转移。你可以重新报价，继续观察。", "success");
    } catch (error) {
      status(error.message + " 请重新报价。", "error");
    }
  });
  $("intervene").addEventListener("click", () => {
    try {
      const before = state;
      const result = M.intervene(state, quote.direction, M.parseAmount("200"));
      state = result.state;
      reportTrade(result, before);
      $("intervene").disabled = true;
      status("另一账户已先成交。旧报价仍显示在左侧，试着执行它。");
    } catch (error) {
      status(error.message, "error");
    }
  });
  $("compare-mode").addEventListener("change", renderComparison);
  const questions = [
    {
      title: "1. 输入 100 A、手续费 0.3%，池子里的 A 增加多少？",
      answers: ["99.7 A", "100 A", "100.3 A"],
      correct: 1,
      explanation:
        "完整输入 100 A 进入储备。99.7 A 只用于报价计算，0.3 A 手续费已经包含在这 100 A 中。",
    },
    {
      title: "2. 初始储备比例相同，哪个池子更适合相同规模的交易？",
      answers: ["更浅的池子", "没有区别", "更深的池子"],
      correct: 2,
      explanation:
        "更深的池子中，这笔输入占储备的比例更小，沿价格曲线移动得更少。回看“比深度”的独立对比。",
    },
    {
      title: "3. 别人先交易后，你的旧报价低于最小接收量，会怎样？",
      answers: ["拒绝交易，不扣款", "照原报价成交", "先扣款，再等待"],
      correct: 0,
      explanation:
        "执行时重新计算输出。低于最小接收量时拒绝，原交易不改变账本；另一账户已成功的交易仍然保留。",
    },
  ];
  questions.forEach((question, index) => {
    const section = document.createElement("section");
    section.className = "reflection-question";
    const title = document.createElement("h4");
    title.textContent = question.title;
    section.append(title);
    const choices = document.createElement("div");
    choices.className = "answers";
    const explanation = document.createElement("p");
    explanation.hidden = true;
    question.answers.forEach((answer, i) => {
      const button = document.createElement("button");
      button.textContent = answer;
      button.addEventListener("click", () => {
        choices
          .querySelectorAll("button")
          .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        answered.set(index, i === question.correct);
        explanation.textContent =
          (i === question.correct ? "回答正确。" : "再想一步：") +
          question.explanation;
        explanation.hidden = false;
        const count = Array.from(answered.values()).filter(Boolean).length;
        $("reflection-score").textContent =
          `已回答 ${answered.size} / 3，当前正确 ${count} / 3。可以修改答案，也可以回到实验验证。`;
      });
      choices.append(button);
    });
    section.append(choices, explanation);
    $("reflection-questions").append(section);
  });
  render();
  setStep(0);
  document
    .querySelectorAll("[data-step], [data-prediction]")
    .forEach((button) => {
      button.disabled = false;
    });
  document.body.dataset.ready = "true";
  $("initialization-status").hidden = true;
  $("reload-experiment").hidden = true;
})();
