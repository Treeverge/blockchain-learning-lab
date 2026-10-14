(() => {
  "use strict";
  const slides = [...document.querySelectorAll(".slide")];
  const select = document.querySelector("#deck-select");
  const previous = document.querySelector("#deck-prev");
  const next = document.querySelector("#deck-next");
  const counter = document.querySelector("#deck-count");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;
  function activate(index) {
    current = index;
    slides.forEach((slide, i) =>
      slide.toggleAttribute("data-active", i === index),
    );
    select.value = slides[index].id;
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    counter.textContent = `${String(index + 1).padStart(2, "0")} / ${slides.length}`;
  }
  function go(index, history = true) {
    index = Math.max(0, Math.min(slides.length - 1, index));
    activate(index);
    if (history && location.hash !== `#${slides[index].id}`)
      location.hash = slides[index].id;
    slides[index].scrollIntoView({
      behavior: reduced.matches ? "instant" : "smooth",
      block: "start",
    });
  }
  function fromHash() {
    const index = slides.findIndex((slide) => `#${slide.id}` === location.hash);
    if (index >= 0) go(index, false);
    else if (!location.hash) go(0, false);
  }
  previous.addEventListener("click", () => go(current - 1));
  next.addEventListener("click", () => go(current + 1));
  select.addEventListener("change", () =>
    go(slides.findIndex((slide) => slide.id === select.value)),
  );
  document
    .querySelector("#deck-print")
    .addEventListener("click", () => window.print());
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.target.closest(
        "button,a,input,select,textarea,summary,[contenteditable]",
      )
    )
      return;
    const commands = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: slides.length - 1,
    };
    if (!(event.key in commands)) return;
    event.preventDefault();
    go(commands[event.key]);
  });
  let scheduled = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const marker = Math.min(innerHeight * 0.3, 200);
        let index = 0;
        slides.forEach((slide, i) => {
          if (slide.getBoundingClientRect().top <= marker) index = i;
        });
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4)
          index = slides.length - 1;
        if (index !== current) activate(index);
      });
    },
    { passive: true },
  );
  window.addEventListener("hashchange", fromHash);
  [select, previous, next, document.querySelector("#deck-print")].forEach(
    (control) => (control.disabled = false),
  );
  activate(0);
  fromHash();
})();
