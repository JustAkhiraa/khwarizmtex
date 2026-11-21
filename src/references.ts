/** Identifiant déterministe, y compris pour une source UTF-16 mal formée. */
export function equationId(name: string): string {
  let encoded = '';
  for (const char of name) {
    const code = char.charCodeAt(0);
    encoded += char.length === 1 && code >= 0xd800 && code <= 0xdfff
      ? `%u${code.toString(16)}`
      : encodeURIComponent(char);
  }
  return `khw-eq-${encoded}`;
}

/** Le navigateur décode le fragment une fois pour retrouver l'id littéral. */
export function equationHref(id: string): string {
  return `#${encodeURIComponent(id)}`;
}
