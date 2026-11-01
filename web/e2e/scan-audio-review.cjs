const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
// Foto → Vokabeln (echte OCR), Aussprache-Knopf, Challenges und Expertenseite auf drei Viewports.
// Voraussetzung: Backend (data/vochat.db) und Web laufen. Ausgabe: SHOTS_DIR (Standard ./e2e-shots)
const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];
const overflow = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return document.documentElement.scrollWidth > vw + 1 ? [`overflow ${document.documentElement.scrollWidth}>${vw}`] : [];
  });

(async () => {
  const browser = await chromium.launch();
  // Testbild: gedruckter spanischer Text, als PNG fotografiert.
  const img = path.resolve(SHOTS, "scan-input.png");
  {
    const p = await browser.newPage({ viewport: { width: 900, height: 360 } });
    await p.setContent(`<body style="margin:40px;font:34px Georgia;background:#fbf8f0;color:#222">
      <p>Ayer comí pan con mi hermana. Hoy como manzanas en la casa y leo un libro.</p></body>`);
    await p.screenshot({ path: img });
    await p.close();
  }
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
    const shot = (n) => page.screenshot({ path: `${SHOTS}/${vp.name}-${n}.png`, fullPage: true });
    const report = [];
    try {
      const email = `scan${Date.now()}${vp.name}@example.com`;
      await page.goto(BASE + "/profile", { waitUntil: "load" });
      await page.getByRole("checkbox", { name: "Spanisch", exact: true }).check();
      await page.getByRole("button", { name: "Speichern" }).first().click();
      const konto = page.locator("section.card");
      await konto.locator(".segmented button").nth(1).click();
      await konto.getByLabel("Name", { exact: true }).fill(`Scan ${vp.name}`);
      await konto.getByLabel("E-Mail").fill(email);
      await konto.getByLabel(/Passwort/).fill("geheimes-passwort");
      await konto.locator("button.primary").click();
      await page.getByText(/Angemeldet als/).waitFor({ timeout: 15000 });
      execFileSync("npm", ["run", "-s", "admin:grant", "-w", "backend", "--", "--email", email, "--role", "expert", "--lang", "es"], {
        cwd: path.resolve(__dirname, "../.."),
        stdio: "ignore",
      });

      // Foto → Vokabeln
      await page.goto(BASE + "/scan", { waitUntil: "load" });
      await page.getByLabel("Sprache des Textes").selectOption("es");
      await page.locator('input[type=file]').nth(1).setInputFiles(img);
      await page.getByText(/Sicherheit \d+ %/).waitFor({ timeout: 90000 });
      const text = await page.locator("textarea").inputValue();
      report.push(`ocr:${JSON.stringify(text.slice(0, 60))}`);
      await page.getByRole("button", { name: "Wörter auswerten" }).click();
      await page.getByText(/kennst du ·/).waitFor({ timeout: 15000 });
      report.push("result:" + (await page.getByText(/kennst du ·/).innerText()).replace(/\s+/g, " "));
      const forms = await page.getByText(/im Text:/).allInnerTexts();
      report.push("forms:" + forms.join(";"));
      await shot("scan-result");
      report.push("scan:" + (await overflow(page)).join(","));

      // Aussprache-Knopf: Aufnahme oder erzeugt (Headless hat keine Gerätestimme)
      const audioReq = page.waitForResponse((r) => /\/audio\/(tts|lexemes)/.test(r.url()), { timeout: 15000 });
      await page.getByRole("button", { name: /anhören/ }).first().click();
      const r = await audioReq;
      report.push(`audio:${r.status()} ${new URL(r.url()).pathname}`);
      await page.getByRole("button", { name: /ausgewählte lernen/ }).click();

      // Challenges + Expertenseite
      await page.goto(BASE + "/community", { waitUntil: "load" });
      await page.getByText(/Wörter · bis/).first().waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Mitmachen" }).last().click();
      await page.getByText("Rangliste").waitFor({ timeout: 10000 });
      await shot("challenges");
      report.push("challenges:" + (await overflow(page)).join(","));
      await page.getByRole("button", { name: "Experten" }).click();
      await page.locator(".review-card").first().waitFor({ timeout: 15000 });
      await page.getByRole("button", { name: "Verlauf" }).first().click();
      await shot("review");
      report.push("review:" + (await overflow(page)).join(","));
    } catch (e) {
      report.push("FEHLER: " + e.message.split("\n").slice(0, 3).join(" / ").slice(0, 260));
      await shot("fail");
    }
    console.log(`${vp.name}: ${report.join(" | ")}${errs.length ? " | JS: " + errs.slice(0, 2).join(" ; ") : ""}`);
    await ctx.close();
  }
  await browser.close();
})();
