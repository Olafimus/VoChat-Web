import { useState } from "react";
import { prefs } from "../../lib/prefs";

const CATEGORIES: { label: string; icon: string; emojis: string }[] = [
  { label: "Smileys", icon: "😀", emojis: "😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕" },
  { label: "Gesten", icon: "👍", emojis: "👍 👎 👌 🤌 🤏 ✌️ 🤞 🫶 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👋 🤚 🖐️ ✋ 🖖 👏 🙌 👐 🤲 🙏 ✍️ 💪 🧠 👀 👂 👃 👄 💋" },
  { label: "Herzen", icon: "❤️", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉" },
  { label: "Lernen", icon: "📚", emojis: "📚 📖 📝 ✏️ 🖊️ 📌 📎 🔖 🗂️ 📅 ⏰ ⏳ 💡 🔍 🎯 ✅ ☑️ ❌ ❓ ❗ ⚠️ 🔤 🔠 🗣️ 💬 💭 🌍 🌎 🌏 🗺️ 🇩🇪 🇬🇧 🇺🇸 🇪🇸 🇮🇷 🇯🇵 🇦🇹 🇨🇭" },
  { label: "Essen", icon: "🍕", emojis: "🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🥔 🍞 🥐 🥨 🧀 🥚 🍳 🥞 🥓 🍗 🍔 🍟 🍕 🌭 🥪 🌮 🍜 🍣 🍱 🍰 🎂 🍫 🍩 🍪 ☕ 🍵 🧃 🍺 🍷" },
  { label: "Natur", icon: "🌸", emojis: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🐝 🦋 🐢 🐍 🐙 🐬 🐳 🌸 🌼 🌻 🌹 🌷 🌱 🌳 🍀 🍁 🌈 ☀️ 🌙 ⛅ 🌧️ ❄️ ⚡" },
  { label: "Dinge", icon: "⚽", emojis: "⚽ 🏀 🏈 ⚾ 🎾 🏐 🎮 🎲 🧩 🎨 🎬 🎤 🎧 🎵 🎶 🎸 🎹 📱 💻 ⌚ 📷 🎥 📺 📻 🚗 🚕 🚌 🚲 ✈️ 🚀 🏠 🏫 🏥 ⛺ 🏖️ 🗽 🗼 🕌" },
];
const RECENT_KEY = "vochat.emojiRecent";

export function recentEmojis(): string[] {
  try {
    return JSON.parse(prefs.get(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function remember(e: string) {
  prefs.set(RECENT_KEY, JSON.stringify([e, ...recentEmojis().filter((x) => x !== e)].slice(0, 24)));
}

/** Leichter Emoji-Auswähler ohne Fremdbibliothek: Kategorien, zuletzt benutzt, Escape schließt. */
export function EmojiPicker({ onPick, onClose }: { onPick: (emoji: string) => void; onClose: () => void }) {
  const recent = recentEmojis();
  const [tab, setTab] = useState(recent.length ? -1 : 0);
  const list = tab === -1 ? recent : CATEGORIES[tab].emojis.split(" ");
  return (
    <div className="emoji-picker" role="dialog" aria-label="Emoji auswählen" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="emoji-tabs" role="tablist">
        {recent.length > 0 && (
          <button type="button" role="tab" aria-selected={tab === -1} className={tab === -1 ? "on" : ""} onClick={() => setTab(-1)} title="Zuletzt">
            🕘
          </button>
        )}
        {CATEGORIES.map((c, i) => (
          <button key={c.label} type="button" role="tab" aria-selected={tab === i} className={tab === i ? "on" : ""} onClick={() => setTab(i)} title={c.label}>
            {c.icon}
          </button>
        ))}
      </div>
      <div className="emoji-grid">
        {list.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              remember(e);
              onPick(e);
            }}
            aria-label={e}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
