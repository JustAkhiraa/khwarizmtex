// Seul Online utilise PDF.js. Le paquet du moteur n'inclut pas ces fichiers.
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const root = dirname(require.resolve("pdfjs-dist/package.json"));
export const pdfAssets = [
  ["pdf.min.mjs", join(root, "build/pdf.min.mjs")],
  ["pdf.worker.min.mjs", join(root, "build/pdf.worker.min.mjs")],
  ["LICENSE", join(root, "LICENSE")],
];
for (const folder of ["cmaps", "standard_fonts", "wasm"]) {
  for (const entry of readdirSync(join(root, folder), {
    withFileTypes: true,
  })) {
    if (entry.isFile() && !entry.name.endsWith(".map"))
      pdfAssets.push([
        folder + "/" + entry.name,
        join(root, folder, entry.name),
      ]);
  }
}
