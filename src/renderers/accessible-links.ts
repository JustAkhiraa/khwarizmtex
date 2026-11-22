import { childrenOf, type MathNode } from '../ast/nodes';
import { equationHref } from '../references';
import { el, type VElement } from './vnode';

/** La couche HTML cachée aux lecteurs d'écran ne doit pas garder de liens tabulables. */
export function hideInteractiveLinks(tree: VElement): void {
  if (tree.tag === 'a') tree.attrs['tabindex'] = '-1';
  for (const child of tree.children) if (typeof child !== 'string') hideInteractiveLinks(child);
}

/** Le balisage natif n'inclut pas les liens : on fournit des liens HTML frères accessibles. */
export function accessibleLinks(nodes: MathNode[]): VElement[] {
  const links: VElement[] = [];
  const seen = new Set<string>();
  const visit = (node: MathNode): void => {
    const href = node.type === 'link' ? node.href
      : node.type === 'ref' && node.resolved && node.target ? equationHref(node.target) : undefined;
    if (href && !seen.has(href)) {
      seen.add(href);
      const text = node.type === 'ref' ? 'Équation ' + node.text : 'Ouvrir le lien : ' + href;
      links.push(el('a', { class: 'khw-a11y-link', href, rel: 'noopener noreferrer' }, [text]));
    }
    for (const child of childrenOf(node)) visit(child);
  };
  for (const node of nodes) visit(node);
  return links;
}
