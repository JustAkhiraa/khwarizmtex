/**
 * Élément HTML natif <khwarizm-math>.
 *
 *   <khwarizm-math>\frac{a}{b}</khwarizm-math>
 *   <khwarizm-math display copy>\sum_{i=1}^n i</khwarizm-math>
 *   <khwarizm-math latex="x^2"></khwarizm-math>
 *
 * Attributs : display (formule centrée), copy (bouton copier), latex (source,
 * prioritaire sur le texte). La propriété .latex lit et change la source.
 */
import { renderToElement } from '../render';
import { enableCopy } from './copy';
import { watchOverflow } from './overflow';
import { injectStyles } from './styles';

export const ELEMENT_NAME = 'khwarizm-math';

/** Déclare l'élément (une seule fois ; sans effet hors navigateur). */
export function defineElement(name: string = ELEMENT_NAME): void {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined') return;
  if (customElements.get(name)) return;

  class KhwarizmMathElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return ['latex', 'display', 'copy'];
    }

    private source: string | null = null;

    get latex(): string {
      return this.source ?? '';
    }

    set latex(value: string) {
      this.setAttribute('latex', String(value));
    }

    connectedCallback(): void {
      injectStyles(this.ownerDocument);
      enableCopy(this.ownerDocument);
      if (this.source === null) {
        const fromAttribute = this.getAttribute('latex');
        const text = this.textContent ?? '';
        // Élément déclaré avant que son texte ne soit lu par le navigateur : on attend.
        if (fromAttribute === null && text.trim() === '' && this.ownerDocument.readyState === 'loading') {
          this.ownerDocument.addEventListener('DOMContentLoaded', () => this.connectedCallback(), { once: true });
          return;
        }
        this.source = fromAttribute ?? text.trim();
      }
      this.draw();
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
      if (name === 'latex' && value !== null) this.source = value;
      if (this.isConnected && this.source !== null) this.draw();
    }

    private draw(): void {
      const display = this.hasAttribute('display');
      renderToElement(this.source ?? '', this, { displayMode: display, copyButton: this.hasAttribute('copy') });
      const math = this.firstElementChild;
      if (display && math) watchOverflow(math);
    }
  }

  customElements.define(name, KhwarizmMathElement);
}
