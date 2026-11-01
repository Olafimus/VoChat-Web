const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
// Chat-Test: zwei Konten, 5000 Nachrichten (virtualisiert), Echtzeit, Antworten, Reaktionen, Korrektur,
// Bild, Sprachnachricht, Links und Skript-Injektion. Misst DOM-Größe, Ladezeit und Bildrate.
// Voraussetzung: Backend (MEDIA_DRIVER=local, :8787) und Web laufen. BASE_URL z. B. http://localhost:4173 (Preview).
const BASE = process.env.BASE_URL || "http://localhost:5173";
const API = process.env.API_URL || "http://localhost:8787";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
const COUNT = Number(process.env.COUNT || 5000);
const root = path.resolve(__dirname, "../..");

async function register(email, name) {
  const r = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "geheimes-passwort", name, nativeLang: "de" }),
  });
  return r.json();
}
async function login(page, email) {
  await page.goto(BASE + "/profile", { waitUntil: "load" });
  const konto = page.locator("section.card");
  await konto.getByLabel("E-Mail").fill(email);
  await konto.getByLabel(/Passwort/).fill("geheimes-passwort");
  await konto.locator("button.primary").click();
  await page.getByText(/Angemeldet als/).waitFor({ timeout: 15000 });
}
/** Aktionsmenü einer Nachricht öffnen und Eintrag wählen (mit Wiederholung, falls die Liste gerade neu misst). */
async function menu(page, message, item) {
  for (let i = 0; i < 4; i++) {
    await message.scrollIntoViewIfNeeded().catch(() => {});
    await message.locator(".msg-more").click({ force: true });
    const entry = page.getByRole(item.role ?? "menuitem", { name: item.name });
    if (await entry.first().isVisible({ timeout: 1500 }).catch(() => false)) return entry.first().click();
    await page.waitForTimeout(300);
  }
  throw new Error(`Menüeintrag „${item.name}“ nicht gefunden`);
}
const overflow = (page) =>
  page.evaluate(() => (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? `overflow ${document.documentElement.scrollWidth}` : ""));

(async () => {
  const stamp = Date.now();
  const anna = { email: `anna${stamp}@example.com`, name: "Anna" };
  const ben = { email: `ben${stamp}@example.com`, name: "Ben" };
  await register(anna.email, anna.name);
  await register(ben.email, ben.name);
  const seeded = JSON.parse(
    execFileSync("npm", ["run", "-s", "seed:chat", "-w", "backend", "--", "--a", anna.email, "--b", ben.email, "--count", String(COUNT)], { cwd: root }).toString().trim().split("\n").pop(),
  );
  const conv = seeded.conversationId;
  const report = [];
  const origPush = report.push.bind(report);
  report.push = (...x) => (console.log(...x), origPush(...x));
  const browser = (global.__browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] }));

  // ---- Anna (Desktop) und Ben (Handy) gleichzeitig -------------------------------
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ["microphone"] });
  const ctxB = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, permissions: ["microphone"] });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errors = [];
  let dialogs = 0;
  for (const p of [a, b]) {
    p.on("pageerror", (e) => errors.push(e.message.slice(0, 160)));
    p.on("dialog", (d) => {
      if (!/löschen/i.test(d.message())) dialogs++;
      void d.accept();
    });
  }
  await login(a, anna.email);
  await login(b, ben.email);

  // Öffnen: Zeit bis zur ersten sichtbaren Nachricht, DOM-Größe
  const t0 = Date.now();
  await a.goto(`${BASE}/chat/${conv}`);
  await a.locator(".msg .bubble").last().waitFor({ timeout: 15000 });
  const openMs = Date.now() - t0;
  await a.waitForTimeout(400);
  const dom = await a.evaluate(() => ({ rows: document.querySelectorAll(".chat-row").length, nodes: document.querySelectorAll("*").length }));
  const lastText = await a.locator(".msg .msg-text").last().innerText();
  report.push(`öffnen ${openMs} ms · ${dom.rows} Zeilen im DOM · ${dom.nodes} DOM-Knoten · letzte: „${lastText.slice(-6)}“`);

  // Nach oben scrollen: ältere nachladen, Position halten, Bildrate messen
  const fps = await a.evaluate(async () => {
    const el = document.querySelector(".chat-scroll");
    const frames = [];
    let last = performance.now();
    let running = true;
    const tick = (t) => {
      frames.push(t - last);
      last = t;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    for (let i = 0; i < 60; i++) {
      el.scrollTop -= 400;
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 300));
    running = false;
    const sorted = [...frames].sort((x, y) => x - y);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const avg = frames.reduce((s, f) => s + f, 0) / frames.length;
    return { avgFps: Math.round(1000 / avg), p95: Math.round(p95), long: frames.filter((f) => f > 50).length };
  });
  await a.waitForTimeout(800);
  const loaded = await a.evaluate(() => document.querySelectorAll(".chat-row").length);
  const seenIds = await a.evaluate(() => [...document.querySelectorAll(".msg[data-id]")].map((n) => Number(n.getAttribute("data-id"))));
  report.push(`scrollen: Ø ${fps.avgFps} fps · p95 ${fps.p95} ms/Frame · ${fps.long} Frames > 50 ms · DOM danach ${loaded} Zeilen · älteste sichtbare ID ${Math.min(...seenIds)}`);

  // Ganz nach oben (Infinite Scroll bis zum Anfang)
  const toTop = await a.evaluate(async () => {
    const el = document.querySelector(".chat-scroll");
    const started = performance.now();
    for (let i = 0; i < 400 && !document.querySelector(".chat-start"); i++) {
      el.scrollTop = 0;
      await new Promise((r) => setTimeout(r, 60));
    }
    return { reached: !!document.querySelector(".chat-start"), ms: Math.round(performance.now() - started), rows: document.querySelectorAll(".chat-row").length };
  });
  const first = await a.locator(".msg .msg-text").first().innerText();
  report.push(`bis zum Anfang: ${toTop.reached ? "ja" : "NEIN"} in ${toTop.ms} ms · DOM ${toTop.rows} Zeilen · erste: „${first.slice(-3)}“`);
  await a.screenshot({ path: `${SHOTS}/chat-desktop-top.png` });

  // Zurück nach unten
  await a.evaluate(() => {
    const el = document.querySelector(".chat-scroll");
    el.scrollTop = el.scrollHeight;
  });
  await a.waitForTimeout(300);

  // Ben öffnet denselben Chat (Handy)
  await b.goto(`${BASE}/chat/${conv}`);
  await b.locator(".msg .bubble").last().waitFor({ timeout: 15000 });

  // Anna schreibt: Link, Injektionsversuche, Emoji – Ben sieht es live (ohne Neuladen)
  const box = a.getByLabel("Nachricht schreiben");
  const sendA = async (text) => {
    await box.fill(text);
    await box.press("Enter");
  };
  await sendA("Schau mal https://es.wikipedia.org/wiki/Paella und <img src=x onerror=alert(1)> javascript:alert(2) <script>alert(3)</script>");
  const tLive = Date.now();
  await b.getByText("Schau mal").waitFor({ timeout: 10000 });
  report.push(`Echtzeit: Ben sieht die Nachricht nach ${Date.now() - tLive} ms`);
  const links = await b.locator(".msg-text a").evaluateAll((as) => as.map((x) => ({ href: x.getAttribute("href"), rel: x.getAttribute("rel"), target: x.getAttribute("target") })));
  const injected = await b.evaluate(() => document.querySelectorAll(".msg-text img, .msg-text script").length);
  report.push(`Links: ${JSON.stringify(links.slice(-2))} · eingeschleuste Elemente: ${injected} · Dialoge: ${dialogs}`);
  await sendA("😂🎉");

  // Ben antwortet (Antwort-Funktion), reagiert und korrigiert
  const lastFromAnna = b.locator(".msg.theirs").filter({ hasText: "Schau mal" }).last();
  await menu(b, lastFromAnna, { name: "Antworten" });
  await b.getByLabel("Nachricht schreiben").fill("¡Qué rica! 🥘");
  await b.getByRole("button", { name: "Senden" }).click();
  await a.locator(".reply-quote").last().waitFor({ timeout: 10000 });
  report.push("Antwort mit Zitat: ok");

  await menu(b, lastFromAnna, { role: "button", name: "Mit 👍 reagieren" });
  await a.locator(".reaction").filter({ hasText: "👍" }).last().waitFor({ timeout: 10000 });
  report.push("Reaktion live bei Anna: ok");

  await sendA("Ayer yo comer paella");
  await b.getByText("Ayer yo comer paella").waitFor();
  const wrong = b.locator(".msg.theirs").filter({ hasText: "Ayer yo comer paella" }).last();
  await menu(b, wrong, { name: "Korrigieren" });
  await b.getByLabel("Korrigierter Text").fill("Ayer comí paella");
  await b.getByRole("button", { name: "Senden" }).last().click();
  await a.locator(".msg-correction").last().waitFor({ timeout: 10000 });
  const diff = await a.locator(".msg-correction").last().evaluate((el) => ({
    del: [...el.querySelectorAll("del")].map((x) => x.textContent),
    ins: [...el.querySelectorAll("ins")].map((x) => x.textContent),
  }));
  report.push(`Korrektur-Diff: entfernt ${JSON.stringify(diff.del)} · neu ${JSON.stringify(diff.ins)}`);

  // Bild (wird im Browser verkleinert) und Sprachnachricht
  const png = path.join(SHOTS, "chat-upload.png");
  await a.screenshot({ path: png, clip: { x: 0, y: 0, width: 900, height: 600 } });
  await a.locator('input[type=file][accept="image/*"]').setInputFiles(png);
  await b.locator(".msg-image img").last().waitFor({ timeout: 15000 });
  const img = await b.locator(".msg-image img").last().evaluate((i) => ({ w: i.naturalWidth, src: i.getAttribute("src") }));
  report.push(`Bild bei Ben: ${img.w}px breit, signierter Link: ${/s=/.test(img.src) ? "ja" : "nein"}`);

  await a.getByRole("button", { name: "Sprachnachricht aufnehmen" }).click();
  await a.waitForTimeout(1500);
  await a.getByRole("button", { name: "Senden" }).click();
  await b.locator(".voice").last().waitFor({ timeout: 15000 });
  report.push(`Sprachnachricht bei Ben: ${await b.locator(".voice-time").last().innerText()}`);

  // Gelesen-Häkchen bei Anna, nachdem Ben unten ist
  await b.evaluate(() => {
    const el = document.querySelector(".chat-scroll");
    el.scrollTop = el.scrollHeight;
  });
  await a.locator('.msg.mine .ticks[aria-label="gelesen"]').last().waitFor({ timeout: 10000 });
  report.push("Gelesen-Häkchen ✓✓: ok");

  // Emoji-Auswahl
  await b.getByRole("button", { name: "Emoji" }).click();
  await b.locator(".emoji-grid button").first().click();
  report.push(`Emoji eingefügt: „${await b.getByLabel("Nachricht schreiben").inputValue()}“`);
  await b.getByRole("button", { name: "Emoji" }).click();

  // Offline: Chat öffnet aus dem lokalen Speicher (TanStack DB / IndexedDB; App-Shell vom Service Worker)
  if (/:4173/.test(BASE)) {
    await ctxB.setOffline(true);
    await b.goto(`${BASE}/chat/${conv}`).catch(() => {});
    await b.locator(".msg .bubble").last().waitFor({ timeout: 10000 });
    report.push(`offline: ${await b.locator(".chat-row").count()} Zeilen aus dem lokalen Speicher, letzte „${(await b.locator(".msg .msg-text").last().innerText()).slice(0, 20)}“`);
    await b.screenshot({ path: `${SHOTS}/chat-offline-mobile.png` });
    await ctxB.setOffline(false);
  }

  // Screenshots: Ben (Handy), Anna (Desktop), Tablet, Dunkelmodus, Chat-Liste
  await b.waitForTimeout(400);
  await b.screenshot({ path: `${SHOTS}/chat-mobile.png` });
  report.push("mobil " + ((await overflow(b)) || "ohne Überlauf"));
  await a.screenshot({ path: `${SHOTS}/chat-desktop.png` });
  const ctxT = await browser.newContext({ viewport: { width: 768, height: 1024 }, colorScheme: "dark" });
  const tb = await ctxT.newPage();
  await login(tb, ben.email);
  await tb.goto(`${BASE}/chat/${conv}`);
  await tb.locator(".msg .bubble").last().waitFor({ timeout: 15000 });
  await tb.waitForTimeout(500);
  await tb.screenshot({ path: `${SHOTS}/chat-tablet-dark.png` });
  report.push("tablet " + ((await overflow(tb)) || "ohne Überlauf"));
  await b.goto(`${BASE}/chat`);
  await b.locator(".conv-item").nth(1).waitFor();
  await b.screenshot({ path: `${SHOTS}/chat-list-mobile.png` });

  if (errors.length) console.log("JS-Fehler:", errors.slice(0, 3));
  await browser.close();
})().catch(async (e) => {
  try {
    for (const ctx of (global.__browser?.contexts?.() ?? [])) for (const p of ctx.pages()) await p.screenshot({ path: `${SHOTS}/chat-fail-${ctx.pages().indexOf(p)}-${Math.random().toString(36).slice(2, 5)}.png` });
  } catch {}
  console.error("FEHLER", e.message.split("\n").slice(0, 4).join(" / "));
  process.exit(1);
});
