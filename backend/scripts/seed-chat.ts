/**
 * Entwicklerwerkzeug: füllt einen Direktchat zwischen zwei Konten mit vielen Nachrichten
 * (für Performance-Tests der virtualisierten Chat-Ansicht). Macht die beiden zu Freunden.
 *
 *   npm run seed:chat -w backend -- --a anna@example.com --b ben@example.com --count 5000
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../src/db/index.js";
import { openDm } from "../src/chat.js";

const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((p) => p.trim().split(/\s+/)));
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.DATABASE_URL ?? process.env.DB_PATH ?? "data/vochat.db";
const db = await openDatabase(/^(postgres|pglite:)/.test(target) ? target : resolve(backendDir, target));
const id = async (email: string) => (await db.get<{ id: string }>("SELECT id FROM users WHERE email = ?", [email.toLowerCase()]))?.id;
const a = await id(args.a);
const b = await id(args.b);
if (!a || !b) throw new Error("Konten nicht gefunden (--a, --b)");
const [low, high] = [a, b].sort();
await db.run(
  `INSERT INTO friendships (user_low, user_high, status, requested_by, created_at) VALUES (?, ?, 'accepted', ?, ?)
   ON CONFLICT (user_low, user_high) DO UPDATE SET status = 'accepted'`,
  [low, high, a, Date.now()],
);
const dm = await openDm(db, a, b, Date.now());
if (!dm.ok) throw new Error(dm.error);
const count = Number(args.count ?? 2000);
const words = "hola qué tal muy bien gracias y tú hoy comí paella con mis amigos mañana vamos al cine la película es buena".split(" ");
const start = Date.now() - count * 60_000;
await db.tx(async (t) => {
  for (let i = 0; i < count; i++) {
    const len = 2 + ((i * 7) % 30);
    const body = Array.from({ length: len }, (_, j) => words[(i + j * 3) % words.length]).join(" ") + (i % 9 === 0 ? " 😀" : "") + ` #${i}`;
    await t.run("INSERT INTO chat_messages (conversation_id, author_id, kind, body, created_at) VALUES (?, ?, 'text', ?, ?)", [
      dm.id,
      i % 2 ? a : b,
      body,
      start + i * 60_000,
    ]);
  }
  await t.run("UPDATE conversations SET last_message_at = ? WHERE id = ?", [Date.now(), dm.id]);
});
console.log(JSON.stringify({ conversationId: dm.id, count }));
await db.close?.();
