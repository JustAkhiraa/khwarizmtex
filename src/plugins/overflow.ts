/**
 * Formules centrées trop larges (une grande matrice ne se coupe pas) :
 * on n'ajoute un défilement horizontal que si elles débordent vraiment,
 * pour ne pas rogner l'infobulle des erreurs ni le bouton copier.
 */

let observer: ResizeObserver | null | undefined;

function check(math: Element): void {
  const html = math.querySelector(':scope > .khw-html');
  if (!(html instanceof HTMLElement) || !(math instanceof HTMLElement)) return;
  math.classList.remove('khw-overflow');
  if (html.scrollWidth > math.clientWidth + 1) math.classList.add('khw-overflow');
}

export function watchOverflow(math: Element): void {
  if (observer === undefined) {
    observer =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver((entries) => {
            for (const entry of entries) check(entry.target);
          });
  }
  observer?.observe(math);
  check(math);
}
