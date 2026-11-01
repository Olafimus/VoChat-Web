// Kopiert Tesseract.js (Worker, WASM-Kern, Sprachdaten) nach public/tesseract,
// damit die Texterkennung ohne CDN und offline funktioniert.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(web, "public", "tesseract");
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`));

mkdirSync(join(out, "core"), { recursive: true });
mkdirSync(join(out, "lang"), { recursive: true });
const copy = (from, to) => {
  if (!existsSync(to)) copyFileSync(from, to);
};
copy(join(pkgDir("tesseract.js"), "dist", "worker.min.js"), join(out, "worker.min.js"));
const core = pkgDir("tesseract.js-core");
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  for (const ext of [".wasm.js", ".wasm", ".js"]) {
    const file = `tesseract-core-${variant}${ext}`;
    copy(join(core, file), join(out, "core", file));
  }
}
for (const lang of ["deu", "eng", "spa", "fas", "jpn"]) {
  copy(join(pkgDir(`@tesseract.js-data/${lang}`), "4.0.0_best_int", `${lang}.traineddata.gz`), join(out, "lang", `${lang}.traineddata.gz`));
}
console.log("OCR-Dateien bereit:", out);
