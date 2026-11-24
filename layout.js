// Mise en page : menu, hauteur réellement visible, clavier du téléphone.
const $ = (id) => document.getElementById(id);
export const coarse = () => matchMedia("(pointer: coarse)").matches;

export function bindLayout() {
  const root = document.documentElement;
  const view = window.visualViewport;
  let tallest = 0;
  let width = 0;
  // Safari ne réduit pas la page quand le clavier s'ouvre : on suit la partie visible.
  function measure() {
    const height = view ? view.height : innerHeight;
    if (innerWidth !== width) {
      width = innerWidth;
      tallest = 0;
    }
    tallest = Math.max(tallest, height, innerHeight);
    // Un zoom au doigt réduit aussi la partie visible : on n'y touche pas.
    if (view && view.scale > 1.05) return;
    root.style.setProperty("--app-height", Math.round(height) + "px");
    root.style.setProperty("--app-top", Math.round(view ? view.offsetTop : 0) + "px");
    const field = document.activeElement;
    const writing = field?.matches?.("textarea, input:not([type=range], [type=color], [type=file])");
    root.classList.toggle("keyboard-open", Boolean(writing) && height < tallest - 140);
  }
  view?.addEventListener("resize", measure);
  view?.addEventListener("scroll", measure);
  addEventListener("resize", measure);
  const places = { source: "source", "inplace-input": "inplace", "palette-search": "search" };
  document.addEventListener("focusin", (event) => {
    root.dataset.writing = places[event.target.id] || "";
    measure();
  });
  document.addEventListener("focusout", () =>
    setTimeout(() => {
      root.dataset.writing = places[document.activeElement?.id] || "";
      measure();
      // Safari laisse parfois la page décalée après la fermeture du clavier.
      if (!root.dataset.writing && scrollY) scrollTo(0, 0);
    }, 80),
  );
  measure();

  const menu = $("menu");
  function toggle(open, focus = true) {
    menu.hidden = !open;
    $("menu-veil").hidden = !open;
    $("menu-open").setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector("button").focus({ preventScroll: true });
    else if (focus) $("menu-open").focus({ preventScroll: true });
  }
  $("menu-open").addEventListener("click", () => toggle(menu.hidden));
  $("menu-veil").addEventListener("click", () => toggle(false));
  menu.addEventListener("click", (event) => {
    if (event.target.closest("button")) toggle(false, !document.querySelector("dialog[open]"));
  }, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) toggle(false);
  });
  $("title").addEventListener("keydown", (event) => {
    if (event.key === "Enter") toggle(false);
  });
  // Toucher à côté d'une fenêtre la referme, comme partout ailleurs sur téléphone.
  for (const dialog of document.querySelectorAll("dialog"))
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog || dialog.id === "molecule-dialog") return;
      const r = dialog.getBoundingClientRect();
      if (event.clientY < r.top || event.clientY > r.bottom || event.clientX < r.left || event.clientX > r.right) dialog.close();
    });
}
