const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
// Korrektur-Benachrichtigung: Wort in der Sammlung, Experte korrigiert die Bedeutung → Lernende sehen den
// genauen Diff, entscheiden über Übernehmen/Ignorieren und ob der Lernstand bleibt.
const BASE = process.env.BASE_URL || "http://localhost:5173";
const API = process.env.API_URL || "http://localhost:8787";
const SHOTS = process.env.SHOTS_DIR || "e2e-shots";
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const log = (...x) => console.log(...x);
  const email = `corr${Date.now()}@example.com`;
  await page.goto(BASE + "/profile", { waitUntil: "load" });
  await page.getByRole("checkbox", { name: "Spanisch", exact: true }).check();
  await page.getByRole("button", { name: "Speichern" }).first().click();
  const konto = page.locator("section.card");
  await konto.locator(".segmented button").nth(1).click();
  await konto.getByLabel("Name", { exact: true }).fill("Korrektur-Test");
  await konto.getByLabel("E-Mail").fill(email);
  await konto.getByLabel(/Passwort/).fill("geheimes-passwort");
  await konto.locator("button.primary").click();
  await page.getByText(/Angemeldet als/).waitFor({ timeout: 15000 });

  // Ein Wort aus dem Top-500-Pfad, einmal lernen
  await page.goto(BASE + "/paths", { waitUntil: "load" });
  await page.getByRole("button", { name: /Top 500/ }).first().click();
  await page.getByRole("button", { name: "+ Lernen" }).first().click();
  await page.waitForTimeout(600);
  await page.goto(BASE + "/learn", { waitUntil: "load" });
  await page.getByRole("button", { name: "Bedeutung zeigen" }).click();
  await page.locator(".grade").nth(2).click();
  await page.waitForTimeout(500);

  // Welche Karte? Lemma + Lexem aus dem lokalen Speicher
  const token = await page.evaluate(() => Object.entries(localStorage).find(([k]) => /token/i.test(k))?.[1]);
  await page.goto(BASE + "/vocab", { waitUntil: "load" });
  const lemma = (await page.locator(".word-view .lemma, .word-view [lang]").first().innerText()).trim();
  log("Karte:", lemma);

  // Experte (hier dieselbe Person mit Rolle) korrigiert die englische Bedeutung
  execFileSync("npm", ["run", "-s", "admin:grant", "-w", "backend", "--", "--email", email, "--role", "expert", "--lang", "es"], {
    cwd: path.resolve(__dirname, "../.."),
    stdio: "ignore",
  });
  const auth = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  let entry = null;
  for (let off = 0; off < 400 && !entry; off += 50) {
    const q = await (await fetch(`${API}/review/queue?lang=es&filter=open&limit=50&offset=${off}`, { headers: auth })).json();
    entry = q.entries.find((e) => e.lemma === lemma);
  }
  const sense = entry.senses.find((s) => s.glossLang === "en");
  const corrected = `${sense.gloss} (corrected meaning)`;
  const r = await fetch(`${API}/review/lexemes/${entry.id}`, { method: "POST", headers: auth, body: JSON.stringify({ action: "editSense", senseId: sense.id, gloss: corrected }) });
  log("Experte korrigiert:", r.status, `„${sense.gloss}“ → „${corrected}“`);

  // Lernende: Abgleich → Vorschlag mit Diff
  await page.getByRole("button", { name: "Mit Wörterbuch abgleichen" }).click();
  await page.locator(".updates").waitFor({ timeout: 15000 });
  const ins = await page.locator(".updates ins").allInnerTexts();
  const reset = await page.locator(".updates input[type=checkbox]").isChecked();
  log("Diff neu:", JSON.stringify(ins), "· Lernstand zurücksetzen vorausgewählt:", reset);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/corrections-mobile.png`, fullPage: false });
  await page.goto(BASE + "/", { waitUntil: "load" });
  log("Startseite:", (await page.locator(".notice-link").innerText().catch(() => "fehlt")).replace(/\s+/g, " "));
  await page.goto(BASE + "/vocab", { waitUntil: "load" });
  await page.locator(".updates").getByRole("button", { name: "Übernehmen" }).click();
  await page.waitForTimeout(500);
  log("Panel nach Übernehmen:", (await page.locator(".updates").count()) === 0 ? "weg" : "noch da");
  const glossNow = await page.locator(".word-view .gloss").first().innerText();
  log("Bedeutung jetzt:", glossNow);
  await browser.close();
})().catch((e) => {
  console.error("FEHLER", e.message.split("\n").slice(0, 3).join(" / "));
  process.exit(1);
});
