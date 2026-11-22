export function download(content, type, filename) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function filename(title) {
  return (
    title
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "khwarizm"
  );
}
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    /* Repli pour Safari/fichier local. */
  }
  const focused = document.activeElement;
  const selection =
    focused instanceof HTMLTextAreaElement ||
    focused instanceof HTMLInputElement
      ? [focused.selectionStart, focused.selectionEnd]
      : null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("aria-label", "Texte à copier");
  field.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
  document.body.append(field);
  field.select();
  const success = document.execCommand("copy");
  field.remove();
  if (focused instanceof HTMLElement) focused.focus({ preventScroll: true });
  if (selection) focused.setSelectionRange(selection[0], selection[1]);
  if (!success)
    throw new Error(
      "Copie refusée par le navigateur. Sélectionnez la source et utilisez Copier.",
    );
}
export function mathml(source, engine) {
  const html = engine.renderToString(source, {
    output: "mathml",
    displayMode: true,
  });
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const math = parsed.querySelector("math");
  if (!math) throw new Error("Impossible de générer le balisage natif.");
  return new XMLSerializer().serializeToString(math);
}
