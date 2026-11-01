const { chromium } = require("playwright");
// Start: npm i -D playwright && npx playwright install chromium (oder PLAYWRIGHT_CHROMIUM_EXECUTABLE nutzen)
// Voraussetzung: Backend und Web laufen. Ausgabe: SHOTS_DIR (Standard ./e2e-shots)
const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
];
const base = BASE;
const navLink = (page, re) => page.locator("nav a:visible").filter({ hasText: re }).first();
const overflow = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  if (document.documentElement.scrollWidth > vw + 1) out.push(`overflow ${document.documentElement.scrollWidth}>${vw}`);
  document.querySelectorAll(".content *").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed") out.push(`<${el.tagName.toLowerCase()}.${el.className}> ${Math.round(r.right)}`);
  });
  return out.slice(0, 4);
});

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(e.message.slice(0, 120)));
    const shot = async (n) => page.screenshot({ path: `${SHOTS}/${vp.name}-${n}.png`, fullPage: true });
    const report = [];
    try {
      await page.goto(base + "/profile", { waitUntil: "networkidle" });
      await page.getByRole("checkbox", { name: "Persisch", exact: true }).check();
      await page.getByRole("button", { name: "Speichern" }).first().click();
      await page.getByText("Gespeichert.").waitFor({ timeout: 10000 });
      await page.goto(base + "/chat", { waitUntil: "networkidle" });
      await page.getByLabel("Lernsprache").selectOption({ label: "Persisch" });
      await page.getByLabel("Nachricht").fill("آب");
      await page.getByRole("button", { name: "Senden" }).click();
      await page.getByRole("button", { name: "+ Lernen" }).first().waitFor({ timeout: 15000 });
      await shot("chat-lookup");
      await page.getByRole("button", { name: "+ Lernen" }).first().click();
      await page.waitForTimeout(500);
      // Lernen: erst Tippen mit falscher Antwort (Karte bleibt in der Runde), dann Karteikarte
      await page.goto(base + "/learn", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Tippen" }).click();
      await page.getByLabel("Antwort").fill("Hallo");
      await page.getByRole("button", { name: "Prüfen" }).click();
      await page.getByText(/Leider falsch/).waitFor({ timeout: 8000 });
      await shot("learn-typing-wrong");
      report.push("typing:" + (await overflow(page)).join(","));
      await page.getByRole("button", { name: "Weiter" }).click();
      await page.getByLabel("Antwort").waitFor({ timeout: 8000 }); // falsche Karte kommt in der Runde wieder
      await shot("learn-done");
      report.push("learn-done:" + (await overflow(page)).join(","));
      // Lernpfade: Medien + eigene Sammlung mit Abgleich
      await page.goto(base + "/paths", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Meine" }).click();
      await page.getByRole("button", { name: "+ Neue Sammlung" }).click();
      await page.getByLabel("Titel").fill("Mein Lied mit einem sehr langen Titel zum Testen der Umbrüche");
      await page.getByLabel(/Wörter/).fill("آب\nخانه = Haus\nکتاب = Buch\nدرخت = Baum");
      await page.getByRole("button", { name: "Speichern" }).click();
      await page.getByRole("button", { name: /Mein Lied mit einem/ }).click();
      await page.getByText(/Fehlende Wörter lernen/).waitFor({ timeout: 8000 });
      await shot("collection-detail");
      report.push("collection:" + (await overflow(page)).join(","));
      // Anonym: Community ist gesperrt, mit Hinweis
      await page.goto(base + "/community", { waitUntil: "networkidle" });
      await page.getByText(/brauchst du ein Konto|Konto/).first().waitFor({ timeout: 8000 });
      await shot("community-gated");
      report.push("gated:" + (await overflow(page)).join(","));
      // Konto anlegen (Profil), danach die gesperrten Bereiche
      await page.goto(base + "/profile", { waitUntil: "networkidle" });
      const konto = page.locator("section.card");
      await konto.locator(".segmented button").nth(1).click();
      await konto.getByLabel("Name", { exact: true }).fill("Layout Tester");
      await konto.getByLabel("E-Mail").fill(`layout${Date.now()}${vp.name}@example.com`);
      await konto.getByLabel(/Passwort/).fill("geheimes-passwort");
      await konto.locator("button.primary").click();
      await page.getByText(/Angemeldet als/).waitFor({ timeout: 15000 });
      await page.goto(base + "/community", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Vorschlag", exact: true }).click();
      await shot("community-suggest");
      report.push("suggest:" + (await overflow(page)).join(","));
      await page.getByRole("button", { name: "Freunde" }).first().click();
      await page.getByRole("button", { name: /Suchen/ }).click();
      await shot("social-search");
      report.push("social:" + (await overflow(page)).join(","));
      await page.goto(base + "/profile", { waitUntil: "networkidle" });
      await shot("profile-full");
      report.push("profile:" + (await overflow(page)).join(","));
    } catch (e) {
      report.push("FEHLER: " + e.message.split("\n").slice(0,3).join(" / ").slice(0,260));
      await shot("fail");
    }
    console.log(`${vp.name}: ${report.join(" | ")}${errs.length ? " | JS: " + errs.slice(0, 2).join(" ; ") : ""}`);
    await ctx.close();
  }
  await browser.close();
})();
