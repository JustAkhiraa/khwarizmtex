// Serveur de prévisualisation local : seuls les fichiers publics de la démo
// sont exposés, jamais le dépôt, les comptes rendus ou les PDF personnels.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { pdfAssets } from "./pdf-assets.mjs";

const files = new Map([
  ["/demo/", ["demo/index.html", "text/html; charset=utf-8"]],
  ["/demo/index.html", ["demo/index.html", "text/html; charset=utf-8"]],
  ["/demo/demo.js", ["demo/demo.js", "text/javascript; charset=utf-8"]],
  ["/demo/demo.css", ["demo/demo.css", "text/css; charset=utf-8"]],
  [
    "/dist/khwarizmtex.global.js",
    ["dist/khwarizmtex.global.js", "text/javascript; charset=utf-8"],
  ],
  ["/dist/khwarizm.css", ["dist/khwarizm.css", "text/css; charset=utf-8"]],
]);
const onlineFiles = [
  "index.html",
  "online.css",
  "tools.css",
  "app.js",
  "presets.js",
  "model.js",
  "document.js",
  "editor.js",
  "exports.js",
  "catalog.js",
  "tools.js",
  "imports.js",
  "recents.js",
  "slots.js",
  "molecule.js",
  "layout.js",
  "keys.js",
  "molecule-model.js",
  "preview-edit.js",
];
for (const name of onlineFiles) {
  files.set("/online/" + name, [
    "apps/online/" + name,
    name.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : name.endsWith(".css")
        ? "text/css; charset=utf-8"
        : "text/html; charset=utf-8",
  ]);
}
files.set("/online/", ["apps/online/index.html", "text/html; charset=utf-8"]);
for (const prefix of ["/dist/", "/online/engine/"]) {
  for (const name of [
    "khwarizmtex.global.js",
    "khwarizm.css",
    "khwarizm-fonts.css",
  ]) {
    files.set(prefix + name, [
      "dist/" + name,
      name.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : "text/css; charset=utf-8",
    ]);
  }
  for (const name of [
    "STIXTwoMath-Regular.woff2",
    "STIXTwoText-Regular.woff2",
    "STIXTwoText-Italic.woff2",
    "STIXTwoText-Bold.woff2",
    "OFL.txt",
  ]) {
    files.set(prefix + "fonts/" + name, [
      "dist/fonts/" + name,
      name.endsWith(".woff2") ? "font/woff2" : "text/plain; charset=utf-8",
    ]);
  }
}
const entry = process.argv.includes("--online") ? "/online/" : "/demo/";
for (const [name, path] of pdfAssets) {
  files.set("/online/vendor/pdfjs/" + name, [
    path,
    name.endsWith(".mjs")
      ? "text/javascript; charset=utf-8"
      : name.endsWith(".wasm")
        ? "application/wasm"
        : "application/octet-stream",
  ]);
}
const port = Number(process.env.KHW_DEMO_PORT || 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("KHW_DEMO_PORT doit être un entier entre 0 et 65535.");
}
const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  // Liste exacte : aucun chemin utilisateur n'est utilisé pour lire le disque.
  const pathname = (request.url || "/").split("?")[0];
  if (pathname === "/") {
    response.writeHead(302, { Location: entry }).end();
    return;
  }
  const file = files.get(pathname);
  if (!file) {
    response.writeHead(404).end("Page introuvable");
    return;
  }
  try {
    const content = await readFile(
      file[0].startsWith("/")
        ? file[0]
        : new URL("../" + file[0], import.meta.url),
    );
    response.writeHead(200, { "Content-Type": file[1] });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response
      .writeHead(503, { "Content-Type": "text/plain; charset=utf-8" })
      .end("Fichier indisponible. Lancez npm run build puis réessayez.");
  }
});
server.on("error", (error) => {
  console.error("Impossible de lancer la démo : " + error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    "Démo locale : http://127.0.0.1:" + server.address().port + "/demo/",
  );
  console.log(
    "Atelier Online : http://127.0.0.1:" + server.address().port + "/online/",
  );
  console.log(
    "Arrêter avec Ctrl+C. Aucun accès réseau extérieur n’est nécessaire.",
  );
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close());
}
