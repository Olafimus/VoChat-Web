const { chromium } = require("playwright");
// Startseite, Lernplaner („warum?“, Intervall-Vorschau), Statistik, Lernverlauf einer Karte und
// eigene Aufnahme (simuliertes Mikrofon). Voraussetzung: Backend mit MEDIA_DRIVER=local und Web laufen.
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
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, permissions: ["microphone"] });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
    const shot = (n) => page.screenshot({ path: `${SHOTS}/${vp.name}-${n}.png`, fullPage: true });
    const report = [];
    try {
      // Spanisch lernen, Konto anlegen
      await page.goto(BASE + "/profile", { waitUntil: "networkidle" });
      await page.getByRole("checkbox", { name: "Spanisch", exact: true }).check();
      await page.getByRole("button", { name: "Speichern" }).first().click();
      const konto = page.locator("section.card");
      await konto.locator(".segmented button").nth(1).click();
      await konto.getByLabel("Name", { exact: true }).fill(`Lerner ${vp.name}`);
      await konto.getByLabel("E-Mail").fill(`learn${Date.now()}${vp.name}@example.com`);
      await konto.getByLabel(/Passwort/).fill("geheimes-passwort");
      await konto.locator("button.primary").click();
      await page.getByText(/Angemeldet als/).waitFor({ timeout: 15000 });

      // Wörter aus dem Top-500-Pfad
      await page.goto(BASE + "/paths", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Top 500/ }).first().click();
      await page.getByRole("button", { name: /Fehlende Wörter lernen|lernen \(/ }).first().click();
      await page.waitForTimeout(800);

      // Startseite
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await page.getByText(/Heute lernen/).waitFor();
      report.push("home:" + (await page.locator(".block-numbers").first().innerText()).replace(/\s+/g, " "));
      await shot("home");
      report.push("homeOv:" + (await overflow(page)).join(","));

      // Lernblock: neue Wörter nach Wichtigkeit, warum?, Intervall-Vorschau
      await page.getByRole("button", { name: /Lernblock starten/ }).first().click();
      await page.getByRole("button", { name: /warum\?/ }).click();
      report.push("why:" + (await page.locator(".why-list li").first().innerText()));
      await page.getByRole("button", { name: "Bedeutung zeigen" }).click();
      report.push("grades:" + (await page.locator(".grade small").allInnerTexts()).join("/"));
      await shot("learn-why");
      report.push("learnOv:" + (await overflow(page)).join(","));
      for (let i = 0; i < 3; i++) {
        if (i > 0) await page.getByRole("button", { name: "Bedeutung zeigen" }).click();
        await page.locator(".grade").nth(i === 1 ? 0 : 2).click();
        await page.waitForTimeout(300);
      }

      // Statistik
      await page.goto(BASE + "/stats", { waitUntil: "networkidle" });
      await page.getByText("Fällige Wiederholungen").waitFor();
      report.push("tiles:" + (await page.locator(".tile-value").allInnerTexts()).join("|"));
      await shot("stats");
      report.push("statsOv:" + (await overflow(page)).join(","));

      // Lernverlauf einer Karte + Aufnahme
      await page.goto(BASE + "/vocab", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: /Bearbeiten/ }).first().click();
      await page.getByText("Lernstand").waitFor();
      await page.locator("summary", { hasText: "Verlauf" }).first().click().catch(() => {});
      const rec = page.getByRole("button", { name: /einsprechen|Neu aufnehmen/ });
      await rec.waitFor({ timeout: 8000 });
      await rec.click();
      await page.getByRole("button", { name: /Stopp/ }).waitFor();
      await page.waitForTimeout(1200);
      await page.getByRole("button", { name: /Stopp/ }).click();
      const recBox = page.locator(".recordings");
      await recBox.getByRole("button", { name: /Anhören/ }).waitFor({ timeout: 8000 });
      await recBox.getByRole("button", { name: "Speichern" }).click();
      await page.getByText(/Gespeichert/).last().waitFor({ timeout: 8000 });
      report.push("rec:" + (await page.locator(".recordings [role=status]").innerText()));
      await shot("card-learning");
      report.push("cardOv:" + (await overflow(page)).join(","));
    } catch (e) {
      report.push("FEHLER: " + e.message.split("\n").slice(0, 3).join(" / ").slice(0, 260));
      await shot("fail");
    }
    console.log(`${vp.name}: ${report.join(" | ")}${errs.length ? " | JS: " + errs.slice(0, 2).join(" ; ") : ""}`);
    await ctx.close();
  }
  await browser.close();
})();
