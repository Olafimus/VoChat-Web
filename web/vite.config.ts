import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

/** Dieselben Sicherheits-Header wie nginx (security-headers.conf) – damit `vite preview` die CSP mittestet. */
const securityHeaders = Object.fromEntries(
  [...readFileSync(new URL("./security-headers.conf", import.meta.url), "utf8").matchAll(/^add_header ([\w-]+) "([^"]+)"/gm)].map((m) => [m[1], m[2]]),
);

// Entwicklung: /api wird ans Backend (Port 8787) weitergeleitet.
export default defineConfig({
  plugins: [
    react(),
    // Installierbare Web-App: Manifest + Service Worker (App-Shell offline, Updates auf Nachfrage).
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["logo.svg", "icons/apple-touch-icon.png"],
      manifest: {
        name: "VoChat – Vokabeln lernen",
        short_name: "VoChat",
        description: "Vokabeln lernen mit Chat, Wörterbuch, Foto-Scan und Freunden – funktioniert auch offline.",
        lang: "de",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f8f6f2",
        theme_color: "#5b3df5",
        categories: ["education", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Lernen", short_name: "Lernen", url: "/learn", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Chats", short_name: "Chats", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Foto scannen", short_name: "Scan", url: "/scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // Texterkennung (groß) nicht vorab laden, sondern beim ersten Scan zwischenspeichern
        globIgnores: ["tesseract/**"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/tesseract/"),
            handler: "CacheFirst",
            options: { cacheName: "ocr", expiration: { maxEntries: 30 } },
          },
          {
            // Zeichendaten (Kana/Kanji, Strichpfade) – blockweise beim ersten Öffnen laden, danach offline
            urlPattern: ({ url }) => url.pathname.startsWith("/glyphs/"),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "glyphs", expiration: { maxEntries: 60 } },
          },
          {
            // Öffentliche Aussprache-Aufnahmen (Wikimedia) – einmal geladen, offline abspielbar
            urlPattern: ({ url }) => url.hostname === "upload.wikimedia.org",
            handler: "CacheFirst",
            options: { cacheName: "audio-commons", expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 90 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  preview: { port: 4173, headers: securityHeaders },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_URL ?? "http://localhost:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
