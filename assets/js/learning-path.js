"use strict";
(() => {
  const C = window.LearningLab,
    $ = (id) => document.getElementById(id),
    key = "blockchain-lab.learning.v1";
  let state = C.createState(),
    id = "hash",
    persist = true;
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function storageStatus(text) {
    $("learning-storage").textContent = text;
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) state = C.decode(raw);
    storageStatus("记录仅保存在当前浏览器；建议导出笔记留存。");
  } catch (error) {
    persist = false;
    storageStatus(
      "无法读取本地记录或格式不兼容：原数据保留，本次仅在页面内记录，请导出笔记。",
    );
  }
  function save() {
    if (!persist) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      persist = false;
      storageStatus(
        "本地保存不可用：本次仅在页面内记录，刷新会丢失本次更改，请导出笔记。",
      );
    }
  }
  function feedback(text, error = false) {
    $("learning-feedback").textContent = text;
    $("learning-feedback").className =
      "feedback " + (error ? "error" : "success");
  }
  function progress() {
    const summary = C.summary(state);
    $("learning-count").textContent = `${summary.completed} / 8`;
    $("learning-stops").replaceChildren(
      ...C.lessons.map((l, index) => {
        const li = el("li"),
          button = el("button"),
          number = el(
            "span",
            String(index + 1).padStart(2, "0"),
            "learning-stop-number",
          ),
          copy = el("span"),
          title = el("strong", l.title),
          status = el(
            "small",
            state.records[l.id].reviewed
              ? "已确认自检"
              : `情景题 ${C.score(state, l.id)} / 2`,
          );
        copy.append(title, status);
        button.append(number, copy);
        button.dataset.lesson = l.id;
        if (l.id === id) button.setAttribute("aria-current", "step");
        button.addEventListener("click", () => choose(l.id, true));
        li.append(button);
        return li;
      }),
    );
    $("learning-confirm").disabled =
      !C.canConfirm(state, id) || state.records[id].reviewed;
    $("learning-next").disabled = id === "security";
    $("learning-completion").textContent = state.records[id].reviewed
      ? "本站已确认自检。修改答案或解释后，需要重新核对。"
      : C.canConfirm(state, id)
        ? "两题已正确且已有解释。请展开标准逐条核对，再确认自检。"
        : "先答对两题并写出解释，再对照标准确认。";
  }
  function updateUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.set("lesson", id);
      url.hash = "learning-workbench";
      history.replaceState(null, "", url);
    } catch (error) {
      /* file URL restrictions do not block learning */
    }
  }
  function choose(next, moveFocus = false) {
    id = C.lesson(next).id;
    const l = C.lesson(id),
      record = state.records[id],
      index = C.lessons.indexOf(l);
    $("learning-chapter").textContent = `第 ${index + 1} / 8 站 · ${l.chapter}`;
    $("learning-title").textContent = l.title;
    $("learning-description").textContent =
      "先运行实验观察账本，再做情景题、写解释与源码练习。";
    $("learning-experiment").href = l.href;
    $("learning-time").textContent =
      `网页实验约 ${l.minutes} 分钟；练习按自己的节奏完成`;
    $("learning-prompt").textContent = l.prompt;
    $("learning-note").value = record.note;
    $("learning-rubric").open = false;
    $("learning-rubric-list").replaceChildren(
      ...l.rubric.map((line) => el("li", line)),
    );
    $("learning-challenge-task").textContent = l.challenge.task;
    $("learning-challenge-expected").textContent =
      "验收：" + l.challenge.expected;
    $("learning-source").href = l.source;
    $("learning-test").href = l.test;
    $("learning-questions").replaceChildren(
      ...l.questions.map((q) => {
        const field = el("fieldset", undefined, "learning-question");
        field.append(el("legend", q.prompt));
        q.choices.forEach((choice, index) => {
          const label = el("label"),
            input = el("input");
          input.type = "radio";
          input.name = q.id;
          input.value = String(index);
          input.checked = record.answers[q.id] === index;
          input.addEventListener("change", () => {
            state = C.answer(state, id, q.id, index);
            save();
            hideChecks();
            feedback("选择已更新，请重新检查并对照解释标准。");
            progress();
          });
          label.append(input, el("span", choice));
          field.append(label);
        });
        const reason = el("p", undefined, "feedback learning-reason");
        reason.id = q.id + "-reason";
        reason.hidden = true;
        reason.setAttribute("role", "status");
        field.append(reason);
        return field;
      }),
    );
    feedback("先判断两个情景，再检查选择。");
    progress();
    updateUrl();
    if (moveFocus) {
      $("learning-title").focus({ preventScroll: true });
      $("learning-title").scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    }
  }
  function hideChecks() {
    for (const q of C.lesson(id).questions) $(q.id + "-reason").hidden = true;
  }
  $("learning-quiz").addEventListener("submit", (event) => {
    event.preventDefault();
    const l = C.lesson(id),
      record = state.records[id];
    for (const q of l.questions) {
      const reason = $(q.id + "-reason"),
        v = record.answers[q.id];
      reason.hidden = false;
      reason.textContent =
        (v === undefined
          ? "尚未选择。"
          : v === q.correct
            ? "判断正确。"
            : "需要复习。") + q.explanation;
      reason.className =
        "feedback learning-reason " + (v === q.correct ? "success" : "error");
    }
    feedback(
      `情景题正确 ${C.score(state, id)} / 2。${C.score(state, id) === 2 ? "接着写出自己的解释。" : "回实验验证，再修改判断。"}`,
      C.score(state, id) !== 2,
    );
  });
  $("learning-note").addEventListener("input", () => {
    state = C.explain(state, id, $("learning-note").value);
    save();
    progress();
  });
  $("learning-confirm").addEventListener("click", () => {
    state = C.confirm(state, id);
    save();
    progress();
  });
  $("learning-next").addEventListener("click", () => {
    const index = C.lessons.findIndex((l) => l.id === id);
    if (index < C.lessons.length - 1) choose(C.lessons[index + 1].id, true);
  });
  $("learning-clear").addEventListener("click", () => {
    if (!confirm("清除本站的答案、解释和自检标记？其他站点保留。")) return;
    state = C.clear(state, id);
    save();
    choose(id);
  });
  $("learning-export").addEventListener("click", () => {
    const blob = new Blob([C.exportMarkdown(state)], {
        type: "text/markdown;charset=utf-8",
      }),
      url = URL.createObjectURL(blob),
      link = el("a");
    link.href = url;
    link.download = "blockchain-learning-notes.md";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document
    .querySelectorAll("button,input,textarea")
    .forEach((n) => (n.disabled = false));
  const requested = new URLSearchParams(location.search).get("lesson");
  choose(
    C.lessons.some((l) => l.id === requested)
      ? requested
      : C.summary(state).next || "security",
  );
  document.body.dataset.ready = "true";
})();
