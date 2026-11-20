/**
 * Ajoute la feuille de style dans la page, pour qui charge seulement le
 * script (élément <khwarizm-math>, fichier autonome). Sans effet si elle y
 * est déjà, en <link> ou en <style>.
 */
import { STYLESHEET } from '../styles/stylesheet';

export function injectStyles(doc: Document = document): void {
  const present = doc.querySelector('style[data-khwarizm], link[data-khwarizm], link[href*="khwarizm"]');
  if (present) return;
  const style = doc.createElement('style');
  style.setAttribute('data-khwarizm', '');
  style.textContent = STYLESHEET;
  doc.head.appendChild(style);
}
