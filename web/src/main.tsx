import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { SessionProvider } from "./session";
import "@fontsource-variable/figtree";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/vazirmatn";
import "./index.css";
import { applyTheme } from "./lib/theme";
import { registerServiceWorker } from "./lib/pwa";

applyTheme();
void registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
