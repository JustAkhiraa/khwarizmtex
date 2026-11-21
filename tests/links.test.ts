import { describe, expect, it } from 'vitest';
import { parse, renderToString } from '../src/render';
import { safeLink } from '../src/parser/links';

describe('liens à activation explicite', () => {
  it('reste désactivé par défaut et conserve le texte', () => {
    const output = renderToString('\\href{https://example.org}{x}', { output: 'html' });
    expect(output).not.toContain('<a ');
    expect(output).toContain('<var>x</var>');
    expect(parse('\\url{https://example.org}').errors[0]?.message).toMatch(/désactivés/);
  });

  it.each(['https://example.org/a', 'http://example.org/', 'mailto:person@example.org', '#chapitre'])('autorise %s', (url) => {
    const source = '\\href{' + url + '}{x}';
    expect(parse(source, { trustLinks: true }).errors).toEqual([]);
    expect(renderToString(source, { trustLinks: true, output: 'html' })).toContain('<a class="khw-link"');
  });

  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,test', 'file:///etc/passwd',
    '//example.org', '/relative', 'https://user:pass@example.org', 'https:\\example.org',
    'java\nscript:alert(1)', ' https://example.org', 'https://exa\u0000mple.org',
    'javascript&#58;alert(1)'])('refuse %s même avec trustLinks', (url) => {
    expect(safeLink(url)).toBeNull();
  });

  it('échappe les attributs et traite les caractères spéciaux TeX', () => {
    const out = renderToString('\\url{https://example.org/a\\%20b?q=1\\&x=2\\#suite}', { trustLinks: true, output: 'html' });
    expect(out).toContain('href="https://example.org/a%20b?q=1&amp;x=2#suite"');
    const injected = renderToString('\\href{#x"onclick="alert(1)}{x}', { trustLinks: true });
    const tags = injected.match(/<[^>]+>/g) ?? [];
    expect(tags.some((tag) => tag.includes('"onclick="'))).toBe(false);
    expect(injected).toContain('&quot;');
  });
});
