// Optional developer QA: requires Playwright and a Chromium executable.
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/plain; charset=utf-8",
};
const server = http.createServer((req, res) => {
  try {
    const relative = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = path.resolve(
      root,
      "." + (relative === "/" ? "/index.html" : relative),
    );
    if (!file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      types[path.extname(file)] || "application/octet-stream",
    );
    fs.createReadStream(file)
      .on("error", () => res.writeHead(404).end())
      .pipe(res);
  } catch {
    res.writeHead(400).end();
  }
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
      viewport: { width: 1440, height: 1100 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(base);
    assert.equal(await page.locator("h1").count(), 1);
    const screenshots = path.join(root, "docs", "screenshots");
    fs.mkdirSync(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, "home-desktop.png"),
      fullPage: true,
    });
    await page.getByRole("link", { name: "开始交换实验" }).click();
    await page.getByRole("button", { name: "少于 100 B", exact: true }).click();
    await page.locator("#start-experiment").click();
    await page.locator("#quote").click();
    assert.equal(
      await page.locator("#quoted-output").textContent(),
      "90.661089",
    );
    await page.locator("#execute").click();
    assert.equal(await page.locator("#pool-a").textContent(), "1100");
    assert.equal(await page.locator("#wallet-a").textContent(), "900");
    assert.equal(await page.locator("#total-a").textContent(), "3000");
    assert.equal(await page.locator("#total-b").textContent(), "3000");
    await page.screenshot({
      path: path.join(screenshots, "exchange-desktop.png"),
      fullPage: true,
    });
    await page.locator("#amount").fill("-1");
    await page.locator("#quote").click();
    assert.match(await page.locator("#trade-status").textContent(), /正数/);
    assert.ok(await page.locator("#execute").isDisabled());
    await page.locator('[data-step="2"]').click();
    assert.equal(await page.locator("#comparison-rows tr").count(), 3);
    await page.locator("#compare-mode").selectOption("size");
    assert.equal(await page.locator("#comparison-rows tr").count(), 3);
    await page.locator('[data-step="3"]').click();
    await page.locator("#fee").selectOption("0");
    await page.locator("#amount").fill("100");
    await page.locator("#quote").click();
    assert.equal(
      await page.locator("#quoted-output").textContent(),
      "90.90909",
    );
    await page.locator("#fee").selectOption("30");
    await page.locator('[data-step="4"]').click();
    await page.locator("#amount").fill("100");
    await page.locator("#quote").click();
    await page.locator("#intervene").click();
    const before = await page.locator(".ledger-table").textContent();
    await page.locator("#execute").click();
    assert.match(
      await page.locator("#trade-status").textContent(),
      /最小接收量/,
    );
    assert.equal(await page.locator(".ledger-table").textContent(), before);
    assert.equal(await page.locator("#wallet-a").textContent(), "1000");
    assert.equal(await page.locator("#other-a").textContent(), "800");
    await page.locator("#quote").click();
    await page.locator("#execute").click();
    assert.match(await page.locator("#trade-status").textContent(), /成功/);
    await page.locator('[data-step="5"]').click();
    const correct = ["100 A", "更深的池子", "拒绝交易，不扣款"];
    for (const name of correct)
      await page
        .locator("#reflection-panel")
        .getByRole("button", { name, exact: true })
        .click();
    assert.match(
      await page.locator("#reflection-score").textContent(),
      /正确 3 \/ 3/,
    );
    // Browser computes correctly from a file URL too: no web server is required locally.
    await page.goto(
      "file:///" +
        path
          .join(root, "03-演示文稿", "defi-exchange.html")
          .replaceAll("\\", "/"),
    );
    await page.locator('[data-step="1"]').click();
    await page.locator("#quote").click();
    assert.equal(
      await page.locator("#quoted-output").textContent(),
      "90.661089",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base + "/03-演示文稿/defi-exchange.html");
    for (let step = 0; step < 6; step++) {
      await page.locator(`[data-step="${step}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `mobile overflow at step ${step}`,
      );
    }
    await page.locator('[data-step="1"]').click();
    await page.locator("#quote").click();
    await page.locator("#execute").click();
    await page.screenshot({
      path: path.join(screenshots, "exchange-mobile.png"),
      fullPage: true,
    });
    await page.goto(base);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      "home mobile overflow",
    );
    await page.screenshot({
      path: path.join(screenshots, "home-mobile.png"),
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const delayed = await browser.newPage();
    let releaseScript;
    const scriptGate = new Promise((resolve) => { releaseScript = resolve; });
    await delayed.route("**/assets/js/amm.js", async (route) => {
      await scriptGate;
      await route.continue();
    });
    const delayedNavigation = delayed.goto(base + "/03-演示文稿/defi-exchange.html");
    await delayed.locator('[data-step="1"]').waitFor();
    assert.ok(await delayed.locator('[data-step="1"]').isDisabled(), 'navigation must wait for initialization');
    assert.ok(await delayed.locator('[data-prediction="less"]').isDisabled());
    releaseScript();
    await delayedNavigation;
    await delayed.waitForFunction(() => document.body.dataset.ready === "true");
    assert.ok(await delayed.locator('[data-step="1"]').isEnabled());
    await delayed.close();
    console.log(
      "Browser QA passed: desktop/mobile, integer quote, balances, errors, comparison, fee change, stale quote, quiz, file URL, no overflow or page errors.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
