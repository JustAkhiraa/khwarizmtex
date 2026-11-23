/**
 * Chimie (\ce) et unités (\SI) : le texte saisi est traduit en commandes
 * ordinaires, que le parseur lit ensuite comme le reste de la formule.
 */

const ARROWS: [string, string, string][] = [
  ['<=>', '\\rightleftharpoons', '\\xrightleftharpoons'],
  ['<->', '\\leftrightarrow', '\\xleftrightarrow'],
  ['->', '\\longrightarrow', '\\xrightarrow'],
  ['<-', '\\longleftarrow', '\\xleftarrow'],
];
const STATES = ['aq', 's', 'l', 'g'];

function digitsAt(s: string, i: number): string {
  let j = i;
  while (j < s.length && (s[j] as string) >= '0' && (s[j] as string) <= '9') j++;
  return s.slice(i, j);
}

/** Argument d'un exposant ou d'un indice : {…}, ou tout jusqu'à un séparateur. */
function scriptAt(s: string, i: number): { text: string; next: number } {
  if (s[i] === '{') {
    const end = s.indexOf('}', i);
    if (end > 0) return { text: s.slice(i + 1, end), next: end + 1 };
  }
  let j = i;
  while (j < s.length && /[0-9+-]/.test(s[j] as string)) {
    j++;
    if (s[j - 1] === '+' || s[j - 1] === '-') break;
  }
  if (j === i) j = Math.min(s.length, i + 1);
  return { text: s.slice(i, j), next: j };
}

/** « 2H2 + O2 -> 2H2O » → source ordinaire ; null si un signe n'est pas compris. */
export function chemistry(input: string): string | null {
  const s = input.trim();
  let out = '';
  // Vrai juste après un atome, une parenthèse ou un indice : un chiffre est alors un indice.
  let attached = false;
  for (let i = 0; i < s.length; ) {
    const c = s[i] as string;
    const arrow = ARROWS.find(([mark]) => s.startsWith(mark, i));
    if (arrow) {
      i += arrow[0].length;
      const labels: string[] = [];
      while (s[i] === '[' && labels.length < 2) {
        const end = s.indexOf(']', i);
        if (end < 0) return null;
        const label = chemistry(s.slice(i + 1, end));
        if (label === null) return null;
        labels.push(label);
        i = end + 1;
      }
      out += labels.length
        ? arrow[2] + (labels[1] ? `[{${labels[1]}}]` : '') + `{${labels[0]}}`
        : arrow[1] + ' ';
      attached = false;
    } else if (c === ' ') {
      // « ↓ » et « ↑ » : v ou ^ isolé.
      if ((s[i + 1] === 'v' || s[i + 1] === '^') && (i + 2 >= s.length || s[i + 2] === ' ')) {
        out += s[i + 1] === 'v' ? '\\downarrow ' : '\\uparrow ';
        i += 2;
      } else i++;
      attached = false;
    } else if (c >= 'A' && c <= 'Z') {
      const next = s[i + 1] ?? '';
      const name = next >= 'a' && next <= 'z' ? c + next : c;
      out += `\\mathrm{${name}}`;
      i += name.length;
      attached = true;
    } else if (c >= '0' && c <= '9') {
      const n = digitsAt(s, i);
      i += n.length;
      if (attached) out += `_{${n}}`;
      else {
        out += n;
        if (s[i] === '/' && digitsAt(s, i + 1)) {
          const d = digitsAt(s, i + 1);
          out = out.slice(0, out.length - n.length) + `\\frac{${n}}{${d}}`;
          i += 1 + d.length;
        }
        out += '\\,';
      }
    } else if (c === '^' || c === '_') {
      const arg = scriptAt(s, i + 1);
      if (!/^[0-9A-Za-z+\-., ]*$/.test(arg.text)) return null;
      if (!attached) out += '{}';
      out += `${c}{\\mathrm{${arg.text}}}`;
      i = arg.next;
      attached = true;
    } else if ((c === '+' || c === '-') && attached) {
      out += `^{${c}}`;
      i++;
    } else if (c === '(') {
      const state = STATES.find((name) => s.startsWith(`(${name})`, i));
      if (state) {
        out += `{}_{\\mathrm{(${state})}}`;
        i += state.length + 2;
        attached = false;
      } else {
        out += '(';
        i++;
        attached = false;
      }
    } else if (c === ')' || c === ']') {
      out += c;
      i++;
      attached = true;
    } else if (c === '[') {
      out += c;
      i++;
      attached = false;
    } else if (c === '+' || c === '-' || c === '=') {
      // Entre deux atomes collés, « - » et « = » sont des liaisons.
      out += c;
      i++;
      attached = false;
    } else if (c === '#') {
      out += '\\equiv ';
      i++;
      attached = false;
    } else if (c === '*' || c === '.') {
      out += '\\cdot ';
      i++;
      attached = false;
    } else if (c >= 'a' && c <= 'z') {
      out += c === 'e' ? '\\mathrm{e}' : c;
      i++;
      attached = c === 'e';
    } else if (c === '\\') {
      // Seules les lettres grecques usuelles en chimie : \Delta, \alpha...
      const greek = /^\\(Delta|alpha|beta|gamma|delta|mu|nu|pi|sigma|lambda)(?![A-Za-z])/.exec(s.slice(i, i + 12));
      if (!greek) return null;
      out += greek[0] + ' ';
      i += greek[0].length;
      attached = false;
    } else if (c === '{' || c === '}') i++;
    else if (c === ',') {
      out += c;
      i++;
    } else return null;
  }
  return out;
}

const UNITS: Record<string, string> = {
  metre: 'm', meter: 'm', gram: 'g', kilogram: 'kg', second: 's', ampere: 'A', kelvin: 'K', mole: 'mol',
  candela: 'cd', hertz: 'Hz', newton: 'N', pascal: 'Pa', joule: 'J', watt: 'W', coulomb: 'C', volt: 'V',
  farad: 'F', ohm: '\\Omega ', siemens: 'S', weber: 'Wb', tesla: 'T', henry: 'H', lumen: 'lm', lux: 'lx',
  becquerel: 'Bq', minute: 'min', hour: 'h', day: 'd', litre: 'L', liter: 'L', tonne: 't', bar: 'bar',
  electronvolt: 'eV', decibel: 'dB', bit: 'bit', byte: 'B', percent: '\\%', degree: '{}^{\\circ}',
  celsius: '{}^{\\circ}C', degreeCelsius: '{}^{\\circ}C', radian: 'rad',
};
const PREFIXES: Record<string, string> = {
  pico: 'p', nano: 'n', micro: '\\mu ', milli: 'm', centi: 'c', deci: 'd', deca: 'da', hecto: 'h',
  kilo: 'k', mega: 'M', giga: 'G', tera: 'T', peta: 'P', kibi: 'Ki', mebi: 'Mi', gibi: 'Gi',
};

/** « 3.0e8 », « -1,5 » → source ; null si ce n'est pas un nombre. */
export function scientificNumber(input: string): string | null {
  const m = /^([+-]?)(\d*)(?:([.,])(\d+))?(?:[eE]([+-]?\d+))?$/.exec(input.replace(/\s/g, ''));
  if (!m || (!m[2] && !m[4] && !m[5])) return null;
  // Groupes de trois chiffres à partir de cinq chiffres.
  const whole = (m[2] ?? '').length > 4 ? (m[2] as string).replace(/\B(?=(\d{3})+$)/g, '\\,') : (m[2] ?? '');
  let out = (m[1] ?? '') + whole;
  if (m[4]) out += `{${m[3]}}${m[4]}`;
  if (m[5]) out += (m[2] || m[4] ? '\\times ' : '') + `10^{${m[5].replace(/^\+/, '')}}`;
  return out;
}

/** « m/s^2 », « kg.m », « \kilo\metre\per\second » → source ; null si illisible. */
export function unitSource(input: string): string | null {
  let out = '';
  let needDot = false;
  let per = false;
  let power = '';
  const s = input.trim();
  const add = (symbol: string): void => {
    if (needDot) out += '\\cdot ';
    out += `\\mathrm{${symbol}}`;
    const exponent = (per ? '-' : '') + (power || (per ? '1' : ''));
    if (exponent) out += `^{${exponent}}`;
    per = false;
    power = '';
    needDot = true;
  };
  let prefix = '';
  for (let i = 0; i < s.length; ) {
    const c = s[i] as string;
    const command = /^\\([A-Za-z]+)/.exec(s.slice(i, i + 30))?.[1];
    if (command) {
      i += command.length + 1;
      if (Object.prototype.hasOwnProperty.call(PREFIXES, command)) prefix += PREFIXES[command];
      else if (Object.prototype.hasOwnProperty.call(UNITS, command)) {
        add(prefix + UNITS[command]);
        prefix = '';
      } else if (command === 'per') per = true;
      else if (command === 'square') power = '2';
      else if (command === 'cubic') power = '3';
      else if (command === 'squared' || command === 'cubed') {
        out += `^{${command === 'squared' ? 2 : 3}}`;
      } else return null;
    } else if (/[A-Za-zµΩ°%]/.test(c)) {
      const word = (/^[A-Za-zµΩ°%]+/.exec(s.slice(i)) as RegExpExecArray)[0];
      add(word.replace(/%/g, '\\%').replace(/°/g, '{}^{\\circ}').replace(/µ/g, '\\mu ').replace(/Ω/g, '\\Omega '));
      i += word.length;
    } else if (c === '^') {
      const m = /^\^\{?([+-]?\d+)\}?/.exec(s.slice(i));
      if (!m) return null;
      out += `^{${m[1]}}`;
      i += m[0].length;
    } else if (c === '/') {
      out += '/';
      needDot = false;
      i++;
    } else if (c === '.' || c === '~' || c === ' ' || c === '*') i++;
    else return null;
  }
  return prefix || per ? null : out;
}
