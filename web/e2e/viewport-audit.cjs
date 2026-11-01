const { chromium } = require("playwright");
// Start: npm i -D playwright && npx playwright install chromium (oder PLAYWRIGHT_CHROMIUM_EXECUTABLE nutzen)
// Voraussetzung: Backend und Web laufen. Ausgabe: SHOTS_DIR (Standard ./e2e-shots)
const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: "tablet", width: 768, height: 1024, isMobile: false },
  { name: "desktop", width: 1280, height: 800, isMobile: false },
];
const ROUTES = ["/chat", "/vocab", "/learn", "/paths", "/community", "/profile"];

async function audit(page, label) {
  return page.evaluate((label) => {
    const vw = document.documentElement.clientWidth;
    const issues = [];
    if (document.documentElement.scrollWidth > vw + 1) issues.push(`horizontal overflow ${document.documentElement.scrollWidth}>${vw}`);
    // Elemente, die über den rechten Rand ragen
    const wide = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && cs.display !== "none" && cs.visibility !== "hidden" && (r.right > vw + 1 || r.left < -1) && !el.closest(".tabs-mobile");
    });
    wide.slice(0, 5).forEach((el) => issues.push(`overflows: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(el.getBoundingClientRect().right)}px`));
    // Elemente, die unter der mobilen Navigation verschwinden
    const nav = document.querySelector(".tabs-mobile");
    if (nav && getComputedStyle(nav).display !== "none") {
      const navTop = nav.getBoundingClientRect().top;
      const hidden = [...document.querySelectorAll(".content button, .content input, .content textarea")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.bottom > navTop + 2 && r.top < navTop && getComputedStyle(el).position !== "fixed";
      });
      if (hidden.length) issues.push(`${hidden.length} Eingabeelemente unter mobiler Navigation`);
    }
    // Mobile Navigation: jeder Tab muss vollständig im Viewport liegen
    if (nav && getComputedStyle(nav).display !== "none") {
      const links = [...nav.querySelectorAll("a")];
      const off = links.filter((a) => { const r = a.getBoundingClientRect(); return r.right > vw + 0.5 || r.left < -0.5; });
      if (off.length) issues.push(`Navigation abgeschnitten: ${off.map((a) => a.textContent.trim()).join(", ")}`);
      const clipped = links.filter((a) => a.scrollWidth > a.clientWidth + 1);
      if (clipped.length) issues.push(`Navigationsbeschriftung abgeschnitten: ${clipped.map((a) => a.textContent.trim()).join(", ")}`);
    }
    // Checkbox-Zeilen: Label neben dem Feld
    const boxes = [...document.querySelectorAll("label.inline input[type=checkbox]")];
    boxes.forEach((b) => { if (b.getBoundingClientRect().width > 40) issues.push("Checkbox zu breit"); });
    // Topbar-Umbruch
    const top = document.querySelector(".topbar");
    if (top && top.scrollWidth > top.clientWidth + 1) issues.push(`topbar scrolls ${top.scrollWidth}>${top.clientWidth}`);
    return { label, vw, issues };
  }, label);
}

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("${BASE}/profile", { waitUntil: "networkidle" });
    // Profil: Lernsprachen wählen, lokal speichern
    await page.getByRole("checkbox", { name: "Persisch" }).check();
    await page.getByRole("checkbox", { name: "Spanisch" }).check();
    await page.getByRole("button", { name: "Speichern" }).first().click();
    await page.getByText("Gespeichert.").waitFor({ timeout: 10000 });
    // Chat: Wort suchen & als Karte speichern
    await page.goto("${BASE}/chat", { waitUntil: "networkidle" });
    await page.getByLabel("Lernsprache").selectOption({ label: "Persisch" });
    await page.getByLabel("Nachricht").fill("آب");
    await page.getByRole("button", { name: "Senden" }).click();
    await page.getByRole("button", { name: "+ Lernen" }).first().waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "+ Lernen" }).first().click();
    await page.waitForTimeout(1000); // Speichern in IndexedDB abwarten, bevor neu geladen wird
    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const name = route.slice(1);
      await page.screenshot({ path: `${SHOTS}/${vp.name}-${name}.png`, fullPage: true });
      report.push(await audit(page, `${vp.name} ${route}`));
    }
    // Chat mit Lookup-Treffer aufgeklappt
    await page.goto("${BASE}/chat", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SHOTS}/${vp.name}-chat-view.png`, fullPage: false });
    if (errors.length) report.push({ label: `${vp.name} errors`, issues: errors.slice(0, 3) });
    await context.close();
  }
  for (const r of report) {
    console.log(`${r.label}: ${r.issues && r.issues.length ? r.issues.join(" | ") : "ok"}`);
  }
  await browser.close();
})().catch((e) => { console.error("FEHLER", e.message.split("\n")[0]); process.exit(1); });
