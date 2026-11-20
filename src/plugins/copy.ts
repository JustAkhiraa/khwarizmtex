/**
 * Copier la formule :
 * - clic sur le petit bouton (option copyButton) : le LaTeX va au presse-papiers ;
 * - sélection de texte contenant des formules puis Ctrl+C : chaque formule
 *   est remplacée par sa source $...$ (au lieu du texte doublé des deux couches).
 */

const enabled = new WeakSet<Document>();

function closestMath(node: Node | null): Element | null {
  const element = node instanceof Element ? node : (node?.parentElement ?? null);
  return element?.closest('.khw[data-latex]') ?? null;
}

function sourceOf(math: Element): string {
  const latex = math.getAttribute('data-latex') ?? '';
  return math.classList.contains('khw-display') ? `$$${latex}$$` : `$${latex}$`;
}

async function writeClipboard(doc: Document, text: string): Promise<boolean> {
  const nav = doc.defaultView?.navigator;
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // Contexte non sécurisé ou permission refusée : on passe à la méthode de secours.
    }
  }
  const area = doc.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  doc.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = doc.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

/** Active le copier (bouton et sélection) pour tout le document. Sans effet la deuxième fois. */
export function enableCopy(doc: Document = document): void {
  if (enabled.has(doc)) return;
  enabled.add(doc);

  doc.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('.khw-copy');
    if (!button) return;
    const math = button.closest('.khw[data-latex]');
    if (!math) return;
    event.preventDefault();
    void writeClipboard(doc, math.getAttribute('data-latex') ?? '').then((ok) => {
      if (!ok) return;
      math.classList.add('khw-copied');
      button.setAttribute('aria-label', 'Formule copiée');
      setTimeout(() => {
        math.classList.remove('khw-copied');
        button.setAttribute('aria-label', 'Copier la formule LaTeX');
      }, 1600);
    });
  });

  doc.addEventListener('copy', (event) => {
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !event.clipboardData) return;
    const range = selection.getRangeAt(0).cloneRange();
    // Une sélection qui commence ou finit dans une formule la prend entière.
    const startMath = closestMath(range.startContainer);
    const endMath = closestMath(range.endContainer);
    if (startMath) range.setStartBefore(startMath);
    if (endMath) range.setEndAfter(endMath);
    const fragment = range.cloneContents();
    const maths = fragment.querySelectorAll('.khw[data-latex]');
    if (maths.length === 0) return;
    maths.forEach((math) => math.replaceWith(doc.createTextNode(sourceOf(math))));
    event.clipboardData.setData('text/plain', fragment.textContent ?? '');
    event.preventDefault();
  });
}
