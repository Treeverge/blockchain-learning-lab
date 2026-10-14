// Optional browser QA, using the same Playwright / Chromium setup as browser-check.cjs.
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
fs.mkdirSync(path.join(root, ".validation-temp"), { recursive: true });
const files = [
  "index.html",
  "learning-path.html",
  "02-演讲稿/演讲稿（对外版）.html",
  ...fs
    .readdirSync(path.join(root, "03-演示文稿"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => "03-演示文稿/" + f),
];
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".md": "text/plain; charset=utf-8",
};
const server = http.createServer((req, res) => {
  const file = path.resolve(
    root,
    "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
  );
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (error, content) => {
    if (error) return res.writeHead(404).end();
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    res.end(content);
  });
});
(async () => {
  let browser;
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    const errors = [],
      requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    page.on("request", (r) => requests.push(r.url()));
    const shots = path.join(root, "docs/screenshots");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const file of files) {
        await page.goto(base + "/" + file);
        await page.locator("body").waitFor();
        const style = await page.evaluate(() => {
          const css = getComputedStyle(document.body);
          return {
            background: css.backgroundColor,
            ink: css.color,
            shared: [...document.styleSheets].some((s) =>
              s.href?.endsWith("/assets/css/lab.css"),
            ),
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
        assert.equal(style.shared, true, `${file}: shared styles`);
        assert.equal(style.background, "rgb(246, 245, 241)", `${file}: paper`);
        assert.equal(style.ink, "rgb(25, 38, 39)", `${file}: ink`);
        assert.equal(
          style.overflow,
          false,
          `${file}: page overflow at ${width}`,
        );
        // Check inner panels as well: body overflow-x:hidden must not hide clipping.
        for (const section of await page
          .locator(".slide, .legacy-demo .section")
          .all()) {
          await section.evaluate((el) =>
            el.scrollIntoView({ behavior: "instant" }),
          );
          const clipping = await section.evaluate((el) => {
            const nodes = [
              el,
              ...el.querySelectorAll(
                ".section-inner, .deck-columns, .legacy-note, .phase-cards, .keys, .value-grid",
              ),
            ];
            return nodes
              .filter((n) => n.scrollWidth > n.clientWidth + 2)
              .map((n) => n.className);
          });
          assert.deepEqual(clipping, [], `${file}: clipped panels ${width}`);
        }
        const links = await page
          .locator("a[href]")
          .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
        for (const href of links) {
          const parsed = new URL(href, base + "/" + file);
          if (parsed.origin !== base) continue;
          const target = path.join(root, decodeURIComponent(parsed.pathname));
          assert.ok(fs.existsSync(target), `${file}: missing ${href}`);
          if (parsed.hash && path.extname(target) === ".html") {
            const html = fs.readFileSync(target, "utf8");
            assert.ok(
              html.includes(`id="${decodeURIComponent(parsed.hash.slice(1))}"`),
              `${file}: missing anchor ${href}`,
            );
          }
        }
        const restyled =
          /blockchain-presentation|demo-(chain|signature|trace)|演讲稿/.test(
            file,
          );
        if (restyled) {
          await page.evaluate(() => {
            window.scrollTo(0, 0);
            const main = document.querySelector("#main");
            if (main) main.scrollTop = 0;
          });
          const name = file.includes("演讲稿")
            ? "manuscript"
            : path.basename(file, ".html");
          await page.screenshot({
            path: path.join(
              shots,
              `${name}-${width === 390 ? "mobile" : "desktop"}.png`,
            ),
            animations: "disabled",
          });
        }
      }
    }
    assert.deepEqual(errors, [], "No page errors or missing resources");
    assert.equal(
      requests.some((url) => !url.startsWith(base)),
      false,
      "All page resources load locally",
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    const deck = base + "/03-演示文稿/blockchain-presentation.html";
    await page.goto(deck + "#s11");
    assert.equal(await page.locator("#deck-select").inputValue(), "s11");
    await page.locator("#deck-next").click();
    await page.waitForURL("**#s12");
    await page.goBack();
    await page.waitForURL("**#s11");
    await page.locator("#deck-select").selectOption("s2");
    await page.waitForURL("**#s2");
    await page.locator("#deck-prev").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      new URL(page.url()).hash,
      "#s2",
      "Button focus does not trigger global slide shortcuts",
    );
    await page.locator("#deck-prev").evaluate((el) => el.blur());
    await page.keyboard.press("ArrowRight");
    await page.waitForURL("**#s3");
    await page.keyboard.press("End");
    await page.waitForURL("**#s14");
    assert.equal(await page.locator("#deck-next").isDisabled(), true);
    await page.keyboard.press("Home");
    await page.waitForURL("**#s1");
    assert.equal(await page.locator("#deck-prev").isDisabled(), true);
    await page.locator("#deck-select").selectOption("s13");
    await page.screenshot({
      path: path.join(shots, "presentation-ledger-desktop.png"),
      animations: "disabled",
    });
    assert.equal(
      await page
        .locator("#s13 h2")
        .evaluate((el) => getComputedStyle(el, "::after").animationName),
      "none",
    );
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator(".deck-rail").isVisible(), false);
    assert.equal(await page.locator("#s1").isVisible(), true);
    assert.equal(await page.locator("#s14").isVisible(), true);
    await page.pdf({
      path: path.join(root, ".validation-temp/presentation.pdf"),
      preferCSSPageSize: true,
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
    // Original interactive diagrams still operate after the style migration.
    await page.goto(base + "/03-演示文稿/demo-signature.html");
    await page.locator("#btnKey").click();
    await page.locator("#keysBox").waitFor({ state: "visible" });
    await page.locator("#btnSign").click();
    await page.locator("#signInfo").waitFor({ state: "visible" });
    await page.goto(base + "/03-演示文稿/demo-chain.html");
    await page.locator("#traitorSlider").fill("2");
    assert.match(await page.locator("#traitorCount").textContent(), /2/);
    await page.locator("#traitorSlider").fill("0");
    await page.locator("#btnVote").click();
    await page.waitForFunction(
      () => document.querySelector("#btnVote").disabled === false,
      null,
      { timeout: 15000 },
    );
    await page.goto(base + "/03-演示文稿/demo-trace.html");
    await page.locator("#nodePick button").first().click();
    await page.locator("#btnApply").click();
    assert.match(
      await page.locator("#alertBanner").getAttribute("class"),
      /show/,
    );
    await page.locator("#btnRestore").click();
    await page.locator("#btnScan").click();
    await page.locator("#scanResult").waitFor({ state: "visible" });
    // Local file operation and no-script fallbacks.
    await page.goto(
      pathToFileURL(path.join(root, "03-演示文稿/blockchain-presentation.html"))
        .href + "#s12",
    );
    assert.equal(await page.locator("#deck-select").inputValue(), "s12");
    const staticPage = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    for (const file of [
      "03-演示文稿/blockchain-presentation.html",
      "02-演讲稿/演讲稿（对外版）.html",
      "03-演示文稿/demo-chain.html",
    ]) {
      await staticPage.goto(base + "/" + file);
      const heading = staticPage.locator("h1,h2").first();
      assert.equal(await heading.isVisible(), true);
      assert.equal(
        await heading.evaluate(
          (el) => getComputedStyle(el.parentElement).opacity,
        ),
        "1",
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      `Sharing QA passed: ${files.length} pages share tokens, desktop/mobile, links, resources, navigation, original interactions, print, local file, no-script.`,
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
