import { MAX_SOURCE, validateState } from "./model.js";

export function parseTextImport(name, text) {
  const extension = name.split(".").pop().toLowerCase();
  const title =
    name.replace(/\.[^.]+$/, "").slice(0, 100) || "Document importé";
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (extension === "json")
    return {
      kind: "backup",
      state: validateState(JSON.parse(text)),
      warning: "Cette sauvegarde remplacera les deux brouillons.",
    };
  if (!["md", "markdown", "txt", "tex"].includes(extension))
    throw new Error(
      "Format non pris en charge. Choisissez .md, .txt, .tex, .json ou .pdf.",
    );
  if (text.length > MAX_SOURCE)
    throw new Error(
      "Le document dépasse 50 000 caractères. Aucun contenu n’a été remplacé.",
    );
  if (text.includes("\0"))
    throw new Error("Ce fichier ne semble pas être du texte UTF-8.");
  if (
    extension === "tex" &&
    /\\(?:documentclass|usepackage)\b|\\begin\s*\{document\}/.test(text)
  ) {
    throw new Error(
      "Ce fichier est un projet de document complet. Importez seulement une formule ; les préambules et packages ne sont pas encore compilés.",
    );
  }
  const mode = extension === "tex" ? "formula" : "document";
  return {
    kind: mode,
    title,
    source: text,
    warning:
      mode === "document"
        ? "Texte, titres, listes et formules sont pris en charge. Images, tableaux et liens Markdown ne sont pas encore interprétés. Le brouillon Document sera remplacé ; Annuler permettra de le retrouver."
        : "Le brouillon Formule sera remplacé ; Annuler permettra de le retrouver.",
  };
}
export function pdfText(items) {
  let text = "";
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    text += item.str;
    text += item.hasEOL ? "\n" : " ";
  }
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPDF(file, signal, progress) {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("PDF trop volumineux : limite de 20 Mo.");
  const data = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-")
    throw new Error("Ce fichier n’est pas un PDF valide.");
  // Chargement à la demande depuis notre hébergement, jamais un CDN.
  const pdfjs = await import("./vendor/pdfjs/pdf.min.mjs");
  if (signal.aborted) throw new Error("Import annulé.");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "./vendor/pdfjs/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const task = pdfjs.getDocument({
    data,
    cMapUrl: new URL("./vendor/pdfjs/cmaps/", import.meta.url).href,
    standardFontDataUrl: new URL(
      "./vendor/pdfjs/standard_fonts/",
      import.meta.url,
    ).href,
    wasmUrl: new URL("./vendor/pdfjs/wasm/", import.meta.url).href,
    useWasm: false,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
    maxImageSize: 0,
    verbosity: 0,
  });
  const cancel = () => {
    void task.destroy();
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100)
      throw new Error("Ce PDF dépasse la limite de 100 pages.");
    let source = "";
    let blank = 0;
    for (let number = 1; number <= pdf.numPages; number++) {
      if (signal.aborted) throw new Error("Import annulé.");
      progress("Extraction locale : page " + number + " / " + pdf.numPages);
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = pdfText(content.items).replace(/\$/g, "\\$");
      if (!text) blank++;
      source +=
        (source ? "\n\n" : "") +
        "## Page " +
        number +
        "\n\n" +
        (text || "[Aucun texte extractible sur cette page.]");
      page.cleanup();
      if (source.length > MAX_SOURCE)
        throw new Error(
          "Le texte du PDF dépasse 50 000 caractères. Importez un document plus court.",
        );
    }
    if (blank === pdf.numPages)
      throw new Error(
        "Aucun texte extractible : ce PDF semble scanné ou composé d’images. Une reconnaissance OCR est nécessaire et n’est pas intégrée.",
      );
    return {
      kind: "document",
      title: file.name.replace(/\.pdf$/i, "").slice(0, 100),
      source,
      warning:
        "Texte extrait, pas de conversion mathématique en source. Les fractions, indices, colonnes et l’ordre de lecture peuvent être altérés : vérifiez et reconstruisez les formules avec la palette. " +
        (blank ? blank + " page(s) sans texte extractible. " : "") +
        "Le brouillon Document sera remplacé après confirmation.",
    };
  } catch (error) {
    if (signal.aborted) throw new Error("Import annulé ou délai dépassé.");
    if (error.name === "PasswordException")
      throw new Error(
        "PDF protégé par mot de passe : importez une copie déverrouillée.",
      );
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    await task.destroy();
  }
}

export function bindImports(onImport) {
  const $ = (id) => document.getElementById(id);
  const dialog = $("document-import-dialog");
  let controller = null;
  let candidate = null;
  let generation = 0;
  function reset() {
    generation++;
    controller?.abort();
    controller = null;
    candidate = null;
    $("document-import-confirm").disabled = true;
  }
  $("document-import-open").addEventListener("click", () => {
    reset();
    $("document-file").value = "";
    $("document-import-status").textContent = "Aucun fichier choisi.";
    $("document-import-warning").hidden = true;
    $("document-import-preview").hidden = true;
    dialog.showModal();
  });
  dialog.addEventListener("close", reset);
  $("document-import-cancel").addEventListener("click", () => dialog.close());
  $("document-file").addEventListener("change", async () => {
    reset();
    const current = generation;
    const file = $("document-file").files[0];
    $("document-import-warning").hidden = true;
    $("document-import-preview").hidden = true;
    if (!file) return;
    controller = new AbortController();
    const active = controller;
    const timer = setTimeout(() => active.abort(), 25000);
    $("document-import-status").textContent = "Lecture locale du fichier…";
    try {
      let result;
      if (/\.pdf$/i.test(file.name))
        result = await extractPDF(file, active.signal, (message) => {
          if (current === generation)
            $("document-import-status").textContent = message;
        });
      else {
        if (file.size > 650000)
          throw new Error("Fichier texte trop volumineux.");
        const text = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
        result = parseTextImport(file.name, text);
      }
      if (current !== generation || active.signal.aborted) return;
      candidate = result;
      $("document-import-status").textContent =
        file.name + " : prêt à importer";
      $("document-import-warning").textContent = result.warning;
      $("document-import-warning").hidden = false;
      $("document-import-preview").value =
        result.kind === "backup"
          ? JSON.stringify(result.state, null, 2)
          : result.source;
      $("document-import-preview").hidden = false;
      $("document-import-confirm").disabled = false;
    } catch (error) {
      if (current === generation)
        $("document-import-status").textContent =
          "Import impossible : " + error.message;
    } finally {
      clearTimeout(timer);
    }
  });
  $("document-import-confirm").addEventListener("click", () => {
    if (!candidate) return;
    const value = candidate;
    dialog.close();
    onImport(value);
  });
}
