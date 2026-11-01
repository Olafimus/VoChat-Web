const { chromium } = require("playwright");
const path = require("node:path");
// Produktions-Build (vite preview mit nginx-CSP): CSP-Verstöße, Service Worker, Manifest/Installierbarkeit,
// Offline-Start und Texterkennung unter CSP. BASE_URL z. B. http://localhost:4173
const BASE = process.env.BASE_URL || "http://localhost:4173";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  const csp = [];
  const errors = [];
  page.on("console", (m) => /Content Security Policy|Refused to/.test(m.text()) && csp.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
  await page.goto(BASE + "/", { waitUntil: "load" });
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: !!reg.active };
  });
  console.log("Service Worker:", JSON.stringify(sw));
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href");
    const m = href ? await (await fetch(href)).json() : null;
    return m && { name: m.name, display: m.display, icons: m.icons.map((i) => `${i.sizes}/${i.purpose}`), shortcuts: m.shortcuts.length };
  });
  console.log("Manifest:", JSON.stringify(manifest));
  // Installierbarkeit: Chrome meldet Fehler über CDP
  const cdp = await ctx.newCDPSession(page);
  const install = await cdp.send("Page.getInstallabilityErrors").catch((e) => ({ error: e.message }));
  console.log("Installierbarkeit:", JSON.stringify(install));

  // Offline-Start aus dem Cache
  await page.reload({ waitUntil: "load" });
  await ctx.setOffline(true);
  await page.goto(BASE + "/learn").catch(() => {});
  await page.waitForTimeout(800);
  console.log("Offline-Start:", (await page.locator("nav.tabs-mobile").count()) > 0 ? "App lädt" : "FEHLT");
  await page.screenshot({ path: `${SHOTS}/pwa-offline.png` });
  await ctx.setOffline(false);

  // Texterkennung unter CSP (WASM + Worker)
  await page.goto(BASE + "/profile", { waitUntil: "load" });
  await page.getByRole("checkbox", { name: "Spanisch", exact: true }).check();
  await page.goto(BASE + "/scan", { waitUntil: "load" });
  const img = path.resolve(SHOTS, "scan-input.png");
  await page.locator("input[type=file]").nth(1).setInputFiles(img);
  await page.getByText(/Sicherheit \d+ %/).waitFor({ timeout: 90000 });
  console.log("OCR unter CSP:", JSON.stringify((await page.locator("textarea").inputValue()).slice(0, 40)));
  console.log("CSP-Verstöße:", csp.length ? csp : "keine");
  if (errors.length) console.log("JS-Fehler:", errors);
  await browser.close();
})().catch((e) => {
  console.error("FEHLER", e.message.split("\n").slice(0, 3).join(" / "));
  process.exit(1);
});
