/** Liste fermée : aucune option ne permet javascript:, data:, file: ou les URL relatives. */
export function safeLink(raw: string): string | null {
  // Les caractères spéciaux TeX doivent être échappés dans les arguments bruts.
  const href = raw.replace(/\\([%#&_])/g, '$1');
  if (!href || /[\u0000-\u0020\u007f\\]/u.test(href)) return null;
  if (href.startsWith('#')) return href;
  if (!/^(https?:\/\/|mailto:)/i.test(href)) return null;
  try {
    const url = new URL(href);
    if (url.username || url.password) return null;
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
