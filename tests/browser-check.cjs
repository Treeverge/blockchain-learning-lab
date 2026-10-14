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
      animations: "disabled",
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
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/defi-liquidity.html");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.locator("#lp-join").click();
    assert.equal(await page.locator("#lp-share").textContent(), "9.0909%");
    await page.locator('[data-lp-step="1"]').click();
    await page.locator("#lp-trade").click();
    assert.match(await page.locator("#lp-fees").textContent(), /0.3 A/);
    await page.locator('[data-lp-step="2"]').click();
    const reservesBeforePrice = await page
      .locator("#lp-reserve-a")
      .textContent();
    await page.locator("#lp-price").selectOption("4");
    assert.equal(
      await page.locator("#lp-reserve-a").textContent(),
      reservesBeforePrice,
    );
    await page.locator("#lp-arbitrage").click();
    assert.match(await page.locator("#lp-conservation").textContent(), /守恒/);
    assert.ok(
      Number(await page.locator("#lp-reserve-a").textContent()) <
        Number(reservesBeforePrice),
    );
    await page.locator('[data-lp-step="3"]').click();
    const preview = await page.locator("#lp-value").textContent();
    await page.locator("#lp-withdraw").click();
    assert.equal(await page.locator("#lp-value").textContent(), preview);
    assert.ok(await page.locator("#lp-price").isDisabled());
    await page.screenshot({
      path: path.join(screenshots, "liquidity-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#lp-reset").click();
    await page.locator("#lp-fee").selectOption("0");
    await page.locator("#lp-join").click();
    await page.locator('[data-lp-step="2"]').click();
    await page.locator("#lp-price").selectOption("4");
    await page.locator("#lp-arbitrage").click();
    assert.match(
      await page.locator("#lp-difference-percent").textContent(),
      /-20\.0000%/,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 4; i++) {
      await page.locator(`[data-lp-step="${i}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `LP mobile overflow at step ${i}`,
      );
    }
    await page.screenshot({
      path: path.join(screenshots, "liquidity-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path
          .join(root, "03-演示文稿", "defi-liquidity.html")
          .replaceAll("\\", "/"),
    );
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.locator("#lp-join").click();
    assert.equal(await page.locator("#lp-share").textContent(), "9.0909%");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-lp-step="2"]').click();
    await page.locator("#lp-price").selectOption("2");
    await page.locator("#lp-arbitrage").click();
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/defi-lending.html");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.locator("#borrow-provide").click();
    await page.locator('[data-borrow-step="1"]').click();
    await page.locator("#borrow-pledge").click();
    await page.locator("#borrow-take").click();
    assert.equal(await page.locator("#borrow-debt").textContent(), "180 B");
    assert.equal(
      await page.locator("#borrow-health").textContent(),
      "1.333333",
    );
    await page.locator('[data-borrow-step="2"]').click();
    await page.locator('[data-price="75"]').click();
    assert.equal(await page.locator("#borrow-health").textContent(), "1");
    assert.ok(await page.locator("#borrow-liquidate").isDisabled());
    await page.locator('[data-price="70"]').click();
    assert.equal(
      await page.locator("#borrow-pool-cash").textContent(),
      "9820 B",
    );
    await page.locator('[data-borrow-step="3"]').click();
    await page.locator("#borrow-repay").click();
    assert.equal(await page.locator("#borrow-debt").textContent(), "150 B");
    assert.equal(await page.locator("#borrow-health").textContent(), "1.12");
    await page.locator("#borrow-repay-all").click();
    assert.equal(
      await page.locator("#borrow-free-collateral").textContent(),
      "4",
    );
    await page.locator("#borrow-reset").click();
    await page.locator("#borrow-provide").click();
    await page.locator('[data-borrow-step="1"]').click();
    await page.locator("#borrow-pledge").click();
    await page.locator("#borrow-take").click();
    await page.locator('[data-borrow-step="2"]').click();
    await page.locator('[data-price="60"]').click();
    await page.locator('[data-borrow-step="4"]').click();
    assert.equal(
      await page.locator("#borrow-preview-bad").textContent(),
      "8.571429 B",
    );
    await page.locator("#borrow-liquidate").click();
    assert.equal(
      await page.locator("#borrow-preview-label").textContent(),
      "本次清算结果",
    );
    assert.equal(
      await page.locator("#borrow-preview-repaid").textContent(),
      "171.428571 B",
    );
    assert.equal(
      await page.locator("#borrow-bad-debt").textContent(),
      "8.571429 B",
    );
    assert.equal(
      await page.locator("#borrow-book-value").textContent(),
      "9991.428571 B",
    );
    assert.match(
      await page.locator("#borrow-conservation").textContent(),
      /守恒/,
    );
    assert.ok(await page.locator("#borrow-price").isDisabled());
    await page.screenshot({
      path: path.join(screenshots, "lending-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-borrow-step="${i}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `lending overflow at step ${i}`,
      );
    }
    await page.screenshot({
      path: path.join(screenshots, "lending-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path
          .join(root, "03-演示文稿", "defi-lending.html")
          .replaceAll("\\", "/"),
    );
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#borrow-provide").click();
    await page.locator('[data-borrow-step="1"]').click();
    await page.locator("#borrow-pledge").click();
    await page.locator("#borrow-take").click();
    assert.equal(await page.locator("#borrow-debt").textContent(), "180 B");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/chain-lab.html");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.locator('[data-chain-step="1"]').click();
    await page.locator("#chain-tamper").click();
    await page.waitForFunction(
      () => document.querySelector("#chain-tamper").disabled === false,
    );
    assert.equal(await page.locator(".chain-block-invalid").count(), 2);
    await page.locator('[data-chain-step="2"]').click();
    await page.locator("#chain-repair").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#chain-validity").textContent ===
        "整条链通过校验",
    );
    await page.locator('[data-chain-step="3"]').click();
    const nodeTips = await page
      .locator("#chain-nodes tr td:nth-child(3)")
      .allTextContents();
    assert.notEqual(nodeTips[0], nodeTips[1]);
    await page.locator('[data-chain-step="4"]').click();
    await page.locator("#chain-difficulty").selectOption("1");
    await page.locator("#chain-prepare").click();
    await page.waitForFunction(
      () =>
        document.querySelector("#chain-mode").textContent.includes("PoW") &&
        !document.querySelector("#chain-prepare").disabled,
    );
    await page.locator("#chain-tamper").click();
    await page.waitForFunction(
      () => !document.querySelector("#chain-tamper").disabled,
    );
    await page.locator("#chain-repair").click();
    await page.waitForFunction(
      () => !document.querySelector("#chain-repair").disabled,
    );
    await page.locator("#chain-mine").click();
    await page.waitForFunction(
      () => !document.querySelector("#chain-mine").disabled,
    );
    await page.locator("#chain-send").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#chain-node-result")
        .textContent.includes("累计工作相同"),
    );
    await page.locator("#chain-append").click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".chain-block").length === 4 &&
        !document.querySelector("#chain-append").disabled,
    );
    await page.locator("#chain-send").click();
    await page.waitForFunction(() =>
      document
        .querySelector("#chain-node-result")
        .textContent.includes("已切换"),
    );
    const acceptedTips = await page
      .locator("#chain-nodes tr td:nth-child(3)")
      .allTextContents();
    assert.equal(new Set(acceptedTips).size, 1);
    await page.screenshot({
      path: path.join(screenshots, "chain-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-chain-step="${i}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `chain mobile overflow at step ${i}`,
      );
    }
    await page.screenshot({
      path: path.join(screenshots, "chain-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path.join(root, "03-演示文稿", "chain-lab.html").replaceAll("\\", "/"),
    );
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator(".chain-block").count(), 3);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-chain-step="1"]').click();
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/utxo-lab.html");
    await page.waitForFunction(
      () =>
        document.body.dataset.ready === "true" &&
        !document.querySelector("#utxo-next").disabled,
    );
    const idleUTXO = () =>
      page.waitForFunction(
        () => !document.querySelector("#utxo-reset").disabled,
      );
    const checkUTXO = async (label, value) =>
      assert.equal(
        await page
          .locator(".utxo-check")
          .filter({ has: page.getByText(label, { exact: true }) })
          .locator("strong")
          .textContent(),
        value,
      );
    await page.locator('[data-utxo-step="1"]').click();
    await page.locator("#utxo-draft").click();
    await idleUTXO();
    assert.match(
      await page.locator("#utxo-transaction").textContent(),
      /Bob 45 \+ Alice 24/,
    );
    await checkUTXO("真实签名", "未通过");
    await page.locator('[data-utxo-step="2"]').click();
    await page.locator("#utxo-sign").click();
    await idleUTXO();
    await checkUTXO("真实签名", "通过");
    await checkUTXO("输入所有者", "通过");
    await page.locator("#utxo-tamper").click();
    await idleUTXO();
    await checkUTXO("内容 / ID", "通过");
    await checkUTXO("真实签名", "未通过");
    await page.locator('[data-utxo-step="3"]').click();
    await page.locator("#utxo-confirm").click();
    await idleUTXO();
    assert.match(await page.locator("#utxo-status").textContent(), /签名/);
    assert.equal(await page.locator("#utxo-alice").textContent(), "100");
    await page.locator('[data-utxo-step="2"]').click();
    await page.locator("#utxo-eve").click();
    await idleUTXO();
    await checkUTXO("真实签名", "通过");
    await checkUTXO("输入所有者", "未通过");
    await page.locator("#utxo-restore").click();
    await idleUTXO();
    await page.locator('[data-utxo-step="3"]').click();
    await page.locator("#utxo-confirm").click();
    await idleUTXO();
    assert.equal(await page.locator("#utxo-alice").textContent(), "54");
    assert.equal(await page.locator("#utxo-bob").textContent(), "95");
    assert.equal(await page.locator("#utxo-fees").textContent(), "1");
    assert.equal(
      await page.locator("#utxo-tx-tag").textContent(),
      "已确认，输入已消耗",
    );
    await checkUTXO("真实签名", "通过");
    await page.locator('[data-utxo-step="4"]').click();
    await page.locator("#utxo-second").click();
    await idleUTXO();
    assert.match(await page.locator("#utxo-status").textContent(), /已花费/);
    await checkUTXO("真实签名", "通过");
    await checkUTXO("未花费输入", "未通过");
    assert.equal(
      await page.locator("#utxo-confirmed").textContent(),
      "确认 1 笔",
    );
    assert.equal(await page.locator("#utxo-fees").textContent(), "1");
    await page.screenshot({
      path: path.join(screenshots, "utxo-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-utxo-step="${i}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `UTXO overflow at step ${i}`,
      );
    }
    await page
      .locator("#utxo-transaction details")
      .evaluateAll((nodes) => nodes.forEach((n) => (n.open = true)));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "expanded signature fields must fit mobile",
    );
    await page.screenshot({
      path: path.join(screenshots, "utxo-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path.join(root, "03-演示文稿", "utxo-lab.html").replaceAll("\\", "/"),
    );
    await page.waitForFunction(
      () =>
        document.body.dataset.ready === "true" &&
        !document.querySelector("#utxo-next").disabled,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-utxo-step="1"]').click();
    await page.locator("#utxo-fee").fill("0");
    await page.locator("#utxo-draft").click();
    await idleUTXO();
    await page.locator('[data-utxo-step="2"]').click();
    await page.locator("#utxo-sign").click();
    await idleUTXO();
    await page.locator('[data-utxo-step="4"]').click();
    await page.locator("#utxo-second").click();
    await idleUTXO();
    assert.equal(await page.locator("#utxo-eve-balance").textContent(), "45");
    await page.locator("#utxo-first").click();
    await idleUTXO();
    assert.match(await page.locator("#utxo-status").textContent(), /已花费/);
    assert.equal(await page.locator("#utxo-fees").textContent(), "0");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/network-lab.html");
    await page.waitForFunction(
      () =>
        document.body.dataset.ready === "true" &&
        !document.querySelector("#net-reset").disabled,
    );
    const idleNetwork = () =>
      page.waitForFunction(
        () => !document.querySelector("#net-reset").disabled,
      );
    await page.locator("#net-seed").click();
    await idleNetwork();
    assert.equal(await page.locator("#net-bob").textContent(), "50");
    assert.match(await page.locator("#net-pending").textContent(), /X → Bob/);
    await page.locator("#net-transaction").selectOption("Y");
    await page.locator("#net-receive").click();
    await idleNetwork();
    assert.match(await page.locator("#net-status").textContent(), /池内冲突/);
    assert.equal(await page.locator("#net-bob").textContent(), "50");
    await page.locator('[data-net-step="1"]').click();
    await page.locator("#net-fork").click();
    await idleNetwork();
    assert.match(
      await page.locator("#net-agreement").textContent(),
      /当前存在分叉/,
    );
    assert.equal(await page.locator("#net-bob").textContent(), "95");
    assert.equal(await page.locator("#net-fees").textContent(), "1");
    await page.locator('[data-net-node="C"]').click();
    assert.equal(await page.locator("#net-bob").textContent(), "50");
    assert.equal(await page.locator("#net-eve").textContent(), "45");
    await page.locator('[data-net-node="A"]').click();
    await page.locator('[data-net-step="2"]').click();
    await page.locator("#net-tie").click();
    await idleNetwork();
    assert.match(
      await page.locator("#net-status").textContent(),
      /累计工作相同/,
    );
    assert.equal(await page.locator("#net-bob").textContent(), "95");
    await page.locator('[data-net-step="3"]').click();
    await page.locator("#net-extend").click();
    await idleNetwork();
    assert.equal(await page.locator("#net-bob").textContent(), "95");
    await page.locator("#net-converge").click();
    await idleNetwork();
    assert.equal(await page.locator("#net-bob").textContent(), "50");
    assert.equal(await page.locator("#net-eve").textContent(), "45");
    assert.equal(await page.locator("#net-alice").textContent(), "54");
    assert.equal(await page.locator("#net-fees").textContent(), "1");
    assert.match(
      await page.locator("#net-agreement").textContent(),
      /末块相同/,
    );
    assert.match(
      await page.locator("#net-reorg-summary").textContent(),
      /撤下 1 块，接入 2 块/,
    );
    assert.match(
      await page.locator("#net-reorg-detail").textContent(),
      /签名仍有效.*已花费/,
    );
    await page.locator('[data-net-step="4"]').click();
    await page.locator("#net-attack").click();
    await idleNetwork();
    assert.match(
      await page.locator("#net-attack-report").textContent(),
      /48 证明工作，0 有效工作/,
    );
    assert.match(
      await page.locator("#net-attack-report").textContent(),
      /真实验签：通过；输入所有者：未通过/,
    );
    assert.match(await page.locator("#net-status").textContent(), /所有者/);
    assert.match(await page.locator("#net-mining").textContent(), /挖矿已完成/);
    assert.equal(
      await page.locator("#net-ledger-tag").textContent(),
      "高度 2 · 工作 32",
    );
    assert.equal(await page.locator("#net-fees").textContent(), "1");
    await page.screenshot({
      path: path.join(screenshots, "network-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-net-step="${i}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `network overflow at step ${i}`,
      );
    }
    await page.locator(".network-hashes").evaluate((n) => (n.open = true));
    await page
      .locator("#net-ledger details")
      .evaluateAll((nodes) => nodes.forEach((n) => (n.open = true)));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "expanded network hashes must fit mobile",
    );
    await page.screenshot({
      path: path.join(screenshots, "network-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path
          .join(root, "03-演示文稿", "network-lab.html")
          .replaceAll("\\", "/"),
    );
    await page.waitForFunction(
      () =>
        document.body.dataset.ready === "true" &&
        !document.querySelector("#net-reset").disabled,
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#net-receive").click();
    await idleNetwork();
    await page.locator('[data-net-step="1"]').click();
    await page.locator("#net-mine").click();
    await idleNetwork();
    assert.match(
      await page.locator("#net-agreement").textContent(),
      /节点尚未同步/,
    );
    assert.equal(await page.locator("#net-bob").textContent(), "95");
    await page.locator('[data-net-step="2"]').click();
    await page.locator("#net-source").selectOption("A");
    await page.locator("#net-node").selectOption("B");
    await page.locator("#net-send").click();
    await idleNetwork();
    assert.equal(await page.locator("#net-bob").textContent(), "95");
    await page.locator('[data-net-step="1"]').click();
    await page.locator("#net-node").selectOption("C");
    for (let i = 0; i < 2; i++) {
      await page.locator("#net-mine").click();
      await idleNetwork();
    }
    await page.locator('[data-net-step="2"]').click();
    await page.locator("#net-source").selectOption("C");
    await page.locator("#net-node").selectOption("A");
    await page.locator("#net-send").click();
    await idleNetwork();
    assert.equal(await page.locator("#net-alice").textContent(), "100");
    assert.equal(await page.locator("#net-bob").textContent(), "50");
    assert.equal(await page.locator("#net-fees").textContent(), "0");
    assert.match(await page.locator("#net-pending").textContent(), /X → Bob/);
    assert.match(
      await page.locator("#net-reorg-detail").textContent(),
      /恢复待确认 1 笔/,
    );
    await page.locator('[data-net-step="1"]').click();
    await page.locator("#net-mine").click();
    await idleNetwork();
    assert.equal(await page.locator("#net-bob").textContent(), "95");
    assert.equal(await page.locator("#net-fees").textContent(), "1");
    // Slow real SHA-256 to exercise the cancellation control without replacing the computation.
    await page.evaluate(() => {
      const digest = crypto.subtle.digest.bind(crypto.subtle);
      crypto.subtle.digest = async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return digest(...args);
      };
    });
    const beforeStop = await page.locator("#net-ledger-tag").textContent();
    await page.locator("#net-mine").click();
    await page.locator("#net-stop").click();
    await idleNetwork();
    assert.match(await page.locator("#net-status").textContent(), /停止/);
    assert.equal(
      await page.locator("#net-ledger-tag").textContent(),
      beforeStop,
    );
    assert.equal(await page.locator("#net-fees").textContent(), "1");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/account-lab.html");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    const accountRow = (name) =>
      page
        .locator("#account-accounts tr")
        .filter({ has: page.getByText(name, { exact: true }) });
    await page.locator("#account-transfer").click();
    assert.equal(await page.locator("#account-alice-lab").textContent(), "90");
    assert.equal(
      await accountRow("Alice").locator("td").first().textContent(),
      "0.96",
    );
    assert.equal(
      await accountRow("Alice").locator("td").last().textContent(),
      "1",
    );
    assert.match(
      await page.locator("#account-fee-metrics").textContent(),
      /最大预算0.07 G.*实际费用0.04 G/,
    );
    await page.locator('[data-account-step="1"]').click();
    await page.locator("#account-build").click();
    await page.locator("#account-submit").click();
    assert.equal(await page.locator("#account-alice-lab").textContent(), "80");
    await page.locator("#account-submit").click();
    assert.equal(
      await page.locator("#account-receipt-tag").textContent(),
      "纳入前拒绝",
    );
    assert.equal(
      await accountRow("Alice").locator("td").first().textContent(),
      "0.92",
    );
    await page.locator("#account-future").click();
    assert.match(
      await page.locator("#account-status").textContent(),
      /尚未轮到/,
    );
    await page.locator('[data-account-step="2"]').click();
    await page.locator("#account-memory").click();
    assert.equal(await page.locator("#account-counter").textContent(), "0");
    assert.match(
      await page.locator("#account-memory-result").textContent(),
      /临时返回 9/,
    );
    await page.locator("#account-store").click();
    assert.equal(await page.locator("#account-counter").textContent(), "9");
    await page.locator('[data-account-step="3"]').click();
    await page.locator("#account-fail").click();
    assert.equal(
      await page.locator("#account-receipt-tag").textContent(),
      "业务已回滚",
    );
    assert.equal(await page.locator("#account-counter").textContent(), "9");
    assert.equal(await page.locator("#account-alice-lab").textContent(), "80");
    assert.equal(
      await accountRow("Alice").locator("td").first().textContent(),
      "0.825",
    );
    assert.equal(
      await accountRow("Alice").locator("td").last().textContent(),
      "4",
    );
    assert.match(
      await page.locator("#account-trace").textContent(),
      /临时写入 counter = 10/,
    );
    assert.match(
      await page.locator("#account-log-count").textContent(),
      /回执提交日志 0 条/,
    );
    await page.locator('[data-account-step="4"]').click();
    await page.locator("#account-approve").click();
    assert.match(
      await page.locator("#account-allowance").textContent(),
      /20 LAB/,
    );
    assert.equal(await page.locator("#account-alice-lab").textContent(), "80");
    await page.locator("#account-delegate").click();
    assert.equal(await page.locator("#account-alice-lab").textContent(), "65");
    assert.equal(await page.locator("#account-bob-lab").textContent(), "85");
    assert.match(
      await page.locator("#account-allowance").textContent(),
      /5 LAB/,
    );
    assert.equal(
      await accountRow("Eve").locator("td").first().textContent(),
      "0.95",
    );
    await page.locator("#account-delegate").click();
    assert.equal(
      await page.locator("#account-receipt-tag").textContent(),
      "业务已回滚",
    );
    assert.equal(
      await accountRow("Eve").locator("td").first().textContent(),
      "0.9",
    );
    assert.equal(await page.locator("#account-alice-lab").textContent(), "65");
    await page.screenshot({
      path: path.join(screenshots, "account-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 5; i++) {
      await page.locator(`[data-account-step="${i}"]`).click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `account overflow at ${i}`,
      );
    }
    await page.screenshot({
      path: path.join(screenshots, "account-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path
          .join(root, "03-演示文稿", "account-lab.html")
          .replaceAll("\\", "/"),
    );
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-account-step="3"]').click();
    await page.locator("#account-failure-mode").selectOption("gas");
    await page.locator("#account-fail").click();
    assert.equal(
      await page.locator("#account-receipt-tag").textContent(),
      "执行上限耗尽",
    );
    assert.equal(
      await accountRow("Alice").locator("td").first().textContent(),
      "0.97",
    );
    assert.equal(await page.locator("#account-alice-lab").textContent(), "100");
    await page.locator("#account-limit").fill("20000");
    await page.locator("#account-failure-mode").selectOption("deliberate");
    await page.locator("#account-fail").click();
    assert.equal(
      await page.locator("#account-receipt-tag").textContent(),
      "纳入前拒绝",
    );
    assert.equal(
      await accountRow("Alice").locator("td").first().textContent(),
      "0.97",
    );
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/03-演示文稿/security-lab.html");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-cash").textContent(), "3");
    assert.equal(await page.locator("#security-claims").textContent(), "3");
    assert.equal(await page.locator("#security-gap").textContent(), "0");
    assert.match(
      await page.locator("#security-frame-index").textContent(),
      /帧 1/,
    );
    await page.locator("#security-frame-next").click();
    assert.match(
      await page.locator("#security-frame").textContent(),
      /进入 withdraw/,
    );
    await page.locator("#security-frame-end").click();
    assert.match(
      await page.locator("#security-frame").textContent(),
      /最终提交/,
    );
    await page.locator('[data-security-step="1"]').click();
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-cash").textContent(), "0");
    assert.equal(await page.locator("#security-received").textContent(), "6");
    assert.equal(await page.locator("#security-gap").textContent(), "5");
    await page
      .locator("#security-timeline button")
      .filter({ hasText: "Attacker.receive" })
      .first()
      .click();
    assert.match(
      await page.locator("#security-frame").textContent(),
      /Attacker债权 1 G \/ 已收 1 G/,
    );
    await page.screenshot({
      path: path.join(screenshots, "security-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.locator("#security-honest-after").click();
    assert.equal(
      await page.locator("#security-receipt-tag").textContent(),
      "提款已回滚",
    );
    assert.equal(await page.locator("#security-cash").textContent(), "0");
    assert.equal(await page.locator("#security-gap").textContent(), "5");
    await page.locator('[data-security-step="2"]').click();
    for (const mode of ["cei", "lock"]) {
      await page.locator("#security-mode").selectOption(mode);
      await page.locator("#security-run").click();
      assert.equal(await page.locator("#security-received").textContent(), "1");
      assert.equal(await page.locator("#security-cash").textContent(), "5");
      await page
        .locator("#security-timeline button")
        .filter({ hasText: "Attacker.receive" })
        .first()
        .click();
      assert.match(
        await page.locator("#security-frame").textContent(),
        mode === "cei" ? /Attacker债权 0 G/ : /Attacker债权 1 G.*锁 占用/,
      );
    }
    assert.match(
      await page.locator("#security-run-config").textContent(),
      /单独重入锁/,
    );
    await page.locator("#security-mode").selectOption("vulnerable");
    assert.match(
      await page.locator("#security-status").textContent(),
      /属于上次运行/,
    );
    assert.match(
      await page.locator("#security-run-config").textContent(),
      /单独重入锁/,
    );
    assert.equal(await page.locator("#security-cash").textContent(), "5");
    await page.locator("#security-run").click();
    assert.match(
      await page.locator("#security-run-config").textContent(),
      /漏洞版本/,
    );
    assert.equal(await page.locator("#security-cash").textContent(), "0");
    await page.locator('[data-security-step="3"]').click();
    await page.locator("#security-run").click();
    assert.equal(
      await page.locator("#security-receipt-tag").textContent(),
      "提款已回滚",
    );
    assert.equal(await page.locator("#security-received").textContent(), "0");
    assert.equal(await page.locator("#security-cash").textContent(), "6");
    await page.locator("#security-catch").selectOption("catch");
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-received").textContent(), "1");
    await page.locator("#security-reject").selectOption("yes");
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-cash").textContent(), "6");
    await page.locator("#security-reject").selectOption("no");
    await page.locator("#security-mode").selectOption("vulnerable");
    await page.locator("#security-limit").fill("7");
    await page.locator("#security-catch").selectOption("bubble");
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-received").textContent(), "0");
    await page.locator("#security-catch").selectOption("catch");
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-received").textContent(), "6");
    await page.locator("#security-limit").fill("9");
    await page.locator("#security-run").click();
    assert.match(await page.locator("#security-status").textContent(), /1至8/);
    assert.equal(await page.locator("#security-received").textContent(), "6");
    await page.setViewportSize({ width: 390, height: 844 });
    for (let i = 0; i < 4; i++) {
      await page.locator(`[data-security-step="${i}"]`).click();
      await page.locator("#security-run").click();
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `security overflow ${i}`,
      );
    }
    await page
      .locator(".under-hood details")
      .last()
      .evaluate((n) => (n.open = true));
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: path.join(screenshots, "security-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(
      "file:///" +
        path
          .join(root, "03-演示文稿", "security-lab.html")
          .replaceAll("\\", "/"),
    );
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('[data-security-step="1"]').click();
    await page.locator("#security-run").click();
    assert.equal(await page.locator("#security-gap").textContent(), "5");
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.goto(base + "/learning-path.html?lesson=hash");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(await page.locator("#learning-stops button").count(), 8);
    assert.ok(await page.locator("#learning-confirm").isDisabled());
    const quiz = await page.evaluate(
      () => LearningLab.lesson("hash").questions,
    );
    await page
      .locator(
        `input[name="${quiz[0].id}"][value="${(quiz[0].correct + 1) % 3}"]`,
      )
      .check();
    await page.locator("#learning-check").click();
    assert.match(
      await page.locator("#learning-feedback").textContent(),
      /正确 0 \/ 2/,
    );
    for (const q of quiz)
      await page.locator(`input[name="${q.id}"][value="${q.correct}"]`).check();
    await page.locator("#learning-check").click();
    assert.ok(await page.locator("#learning-confirm").isDisabled());
    const note =
      "重算证明链接自洽；真实PoW仍要校验，等工作不换链；业务事实需要链外证据。";
    await page.locator("#learning-note").fill(note);
    await page.locator("#learning-rubric summary").click();
    assert.ok(await page.locator("#learning-confirm").isEnabled());
    await page.locator("#learning-confirm").click();
    assert.equal(await page.locator("#learning-count").textContent(), "1 / 8");
    await page.locator("#learning-note").fill(note + "补充解释");
    assert.equal(await page.locator("#learning-count").textContent(), "0 / 8");
    await page.locator("#learning-confirm").click();
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(
      await page.locator("#learning-note").inputValue(),
      note + "补充解释",
    );
    assert.equal(await page.locator("#learning-count").textContent(), "1 / 8");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#learning-export").click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), "blockchain-learning-notes.md");
    const exportPath = path.join(root, ".validation-temp", "learning-notes.md");
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    await download.saveAs(exportPath);
    const exported = fs.readFileSync(exportPath, "utf8");
    assert.ok(exported.includes(note + "补充解释"));
    assert.match(exported, /不是掌握认证/);
    await page.screenshot({
      path: path.join(screenshots, "learning-desktop.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(base + "/learning-path.html");
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.match(page.url(), /lesson=utxo/);
    await page.locator('[data-lesson="hash"]').click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#learning-clear").click();
    assert.equal(await page.locator("#learning-count").textContent(), "1 / 8");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#learning-clear").click();
    assert.equal(await page.locator("#learning-count").textContent(), "0 / 8");
    assert.equal(await page.locator("#learning-note").inputValue(), "");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const curriculum = require("../assets/js/curriculum.js");
    for (const l of curriculum.lessons) {
      await page.locator(`[data-lesson="${l.id}"]`).click();
      assert.equal(
        await page.locator("#learning-title").textContent(),
        l.title,
      );
      assert.equal(
        await page.locator("#learning-experiment").getAttribute("href"),
        l.href,
      );
      await page.locator("#learning-check").click();
      await page.locator("#learning-rubric").evaluate((n) => (n.open = true));
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `learning overflow ${l.id}`,
      );
      assert.equal(await page.locator("#learning-rubric-list li").count(), 3);
      // Each experiment's return link routes to the correct station.
      const response = await page.request.get(base + "/" + l.href);
      assert.equal(response.status(), 200);
      assert.ok(
        (await response.text()).includes(
          "../learning-path.html?lesson=" + l.id + "#learning-workbench",
        ),
      );
    }
    assert.ok(await page.locator("#learning-next").isDisabled());
    await page.screenshot({
      path: path.join(screenshots, "learning-mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
    await page.goto(
      "file:///" +
        path.join(root, "learning-path.html").replaceAll("\\", "/") +
        "?lesson=lp",
    );
    await page.waitForFunction(() => document.body.dataset.ready === "true");
    assert.equal(
      await page.locator("#learning-title").textContent(),
      curriculum.lesson("lp").title,
    );
    const blocked = await browser.newPage();
    blocked.on("pageerror", (e) => errors.push(e.message));
    await blocked.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("denied", "SecurityError");
        },
      });
    });
    await blocked.goto(base + "/learning-path.html?lesson=account");
    await blocked.waitForFunction(() => document.body.dataset.ready === "true");
    assert.match(
      await blocked.locator("#learning-storage").textContent(),
      /页面内记录/,
    );
    await blocked.locator("#learning-note").fill("不能保存仍可以填写解释");
    assert.equal(
      await blocked.locator("#learning-note").inputValue(),
      "不能保存仍可以填写解释",
    );
    await blocked.close();
    const corrupt = await browser.newPage();
    corrupt.on("pageerror", (e) => errors.push(e.message));
    await corrupt.addInitScript(() =>
      localStorage.setItem("blockchain-lab.learning.v1", '{"version":99}'),
    );
    await corrupt.goto(base + "/learning-path.html");
    await corrupt.waitForFunction(() => document.body.dataset.ready === "true");
    await corrupt.locator("#learning-note").fill("不能静默覆盖旧数据");
    assert.equal(
      await corrupt.evaluate(() =>
        localStorage.getItem("blockchain-lab.learning.v1"),
      ),
      '{"version":99}',
    );
    assert.match(
      await corrupt.locator("#learning-storage").textContent(),
      /原数据保留/,
    );
    await corrupt.close();
    const quota = await browser.newPage();
    quota.on("pageerror", (e) => errors.push(e.message));
    await quota.addInitScript(() => {
      Storage.prototype.setItem = function () {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    await quota.goto(base + "/learning-path.html");
    await quota.waitForFunction(() => document.body.dataset.ready === "true");
    await quota.locator("#learning-note").fill("保存失败不丢掉页面内解释");
    assert.match(
      await quota.locator("#learning-storage").textContent(),
      /保存不可用/,
    );
    await quota.close();
    assert.deepEqual(errors, []);
    const networkDelayed = await browser.newPage();
    let releaseNetwork;
    const networkGate = new Promise((resolve) => {
      releaseNetwork = resolve;
    });
    await networkDelayed.route("**/assets/js/network.js", async (route) => {
      await networkGate;
      await route.continue();
    });
    const networkNavigation = networkDelayed.goto(
      base + "/03-演示文稿/network-lab.html",
    );
    // A closing browser must not mask a failed initialization assertion with an unhandled navigation rejection.
    networkNavigation.catch(() => {});
    await networkDelayed.locator('[data-net-step="1"]').waitFor();
    assert.ok(await networkDelayed.locator('[data-net-step="1"]').isDisabled());
    assert.ok(await networkDelayed.locator("#net-seed").isDisabled());
    assert.ok(await networkDelayed.locator("#net-node").isDisabled());
    releaseNetwork();
    await networkNavigation;
    await networkDelayed.waitForFunction(
      () =>
        document.body.dataset.ready === "true" &&
        !document.querySelector("#net-seed").disabled,
    );
    await networkDelayed.close();
    const delayed = await browser.newPage();
    let releaseScript;
    const scriptGate = new Promise((resolve) => {
      releaseScript = resolve;
    });
    await delayed.route("**/assets/js/amm.js", async (route) => {
      await scriptGate;
      await route.continue();
    });
    const delayedNavigation = delayed.goto(
      base + "/03-演示文稿/defi-exchange.html",
    );
    await delayed.locator('[data-step="1"]').waitFor();
    assert.ok(
      await delayed.locator('[data-step="1"]').isDisabled(),
      "navigation must wait for initialization",
    );
    assert.ok(await delayed.locator('[data-prediction="less"]').isDisabled());
    releaseScript();
    await delayedNavigation;
    await delayed.waitForFunction(() => document.body.dataset.ready === "true");
    assert.ok(await delayed.locator('[data-step="1"]').isEnabled());
    await delayed.emulateMedia({ reducedMotion: "reduce" });
    await delayed.locator('[data-step="1"]').click();
    await delayed.locator("#quote").click();
    await delayed.locator("#execute").click();
    assert.equal(
      await delayed.locator("#quoted-output").textContent(),
      "90.661089",
    );
    assert.equal(await delayed.locator("#flow-input").textContent(), "100 A →");
    assert.equal(
      await delayed.evaluate(() => document.getAnimations().length),
      0,
      "reduced motion must disable effects without hiding results",
    );
    await delayed.close();
    console.log(
      "Browser QA passed: eight experiments and learning workbook; self-review, persistence failures, export, desktop/mobile, file URLs, reduced motion, no overflow or page errors.",
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
