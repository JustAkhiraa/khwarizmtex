/**
 * Tables de symboles : commande → caractère Unicode, classe d'atome, rôle.
 *
 * Les listes sont écrites par paires « nom caractère » pour rester lisibles ;
 * elles sont dépliées une seule fois au chargement du module.
 */
import type { AtomClass, MathVariant, SymbolRole } from '../ast/nodes';

export interface SymbolInfo {
  char: string;
  cls: AtomClass;
  role: SymbolRole;
  variant?: MathVariant;
}

export interface OperatorInfo {
  /** Caractère (∑) ou mot (lim). */
  name: string;
  symbol: boolean;
  /** Bornes dessus-dessous en style display (∑, lim) ou en indice (∫, sin). */
  limits: boolean;
}

const SYMBOLS = new Map<string, SymbolInfo>();
const OPERATORS = new Map<string, OperatorInfo>();
/** Caractère tapé directement (≤, α...) → informations. */
const BY_CHAR = new Map<string, SymbolInfo>();

function define(role: SymbolRole, cls: AtomClass, list: string, variant?: MathVariant): void {
  const parts = list.split(/\s+/).filter((p) => p.length > 0);
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const name = parts[i] as string;
    const char = parts[i + 1] as string;
    const info: SymbolInfo = variant ? { char, cls, role, variant } : { char, cls, role };
    SYMBOLS.set('\\' + name, info);
    if (!BY_CHAR.has(char)) BY_CHAR.set(char, info);
  }
}

function defineOps(list: string, symbol: boolean, limits: boolean): void {
  const parts = list.split(/\s+/).filter((p) => p.length > 0);
  if (symbol) {
    for (let i = 0; i + 1 < parts.length; i += 2) {
      const name = parts[i + 1] as string;
      OPERATORS.set('\\' + (parts[i] as string), { name, symbol, limits });
      if (!BY_CHAR.has(name)) BY_CHAR.set(name, { char: name, cls: 'op', role: 'mo' });
    }
  } else {
    for (const word of parts) OPERATORS.set('\\' + word, { name: word, symbol, limits });
  }
}

// Grec : minuscules en italique, majuscules droites (convention de TeX).
define(
  'mi',
  'ord',
  `alpha α beta β gamma γ delta δ epsilon ϵ varepsilon ε zeta ζ eta η theta θ
   vartheta ϑ iota ι kappa κ varkappa ϰ lambda λ mu μ nu ν xi ξ omicron ο pi π
   varpi ϖ rho ρ varrho ϱ sigma σ varsigma ς tau τ upsilon υ phi ϕ varphi φ chi χ
   psi ψ omega ω digamma ϝ`,
);
define(
  'mi',
  'ord',
  `Gamma Γ Delta Δ Theta Θ Lambda Λ Xi Ξ Pi Π Sigma Σ Upsilon Υ Phi Φ Psi Ψ Omega Ω
   Alpha Α Beta Β Epsilon Ε Zeta Ζ Eta Η Iota Ι Kappa Κ Mu Μ Nu Ν Omicron Ο
   Rho Ρ Tau Τ Chi Χ`,
  'normal',
);
define(
  'mi',
  'ord',
  `varGamma Γ varDelta Δ varTheta Θ varLambda Λ varXi Ξ varPi Π varSigma Σ
   varUpsilon Υ varPhi Φ varPsi Ψ varOmega Ω`,
  'italic',
);

// Symboles ordinaires, droits.
define(
  'mi',
  'ord',
  `infty ∞ emptyset ∅ varnothing ∅ hbar ℏ hslash ℏ ell ℓ wp ℘ Re ℜ Im ℑ aleph ℵ
   beth ℶ gimel ℷ daleth ℸ prime ′ backprime ‵ angle ∠ measuredangle ∡
   sphericalangle ∢ triangle △ square □ Box □ blacksquare ■ lozenge ◊ Diamond ◊
   blacklozenge ⧫ diamondsuit ♢ heartsuit ♡ clubsuit ♣ spadesuit ♠ top ⊤ bot ⊥
   nabla ∇ partial ∂ surd √ flat ♭ natural ♮ sharp ♯ checkmark ✓ degree °
   imath ı jmath ȷ eth ð mho ℧ complement ∁ Finv Ⅎ Game ⅁ Bbbk 𝕜 S § P ¶ dag †
   ddag ‡ copyright © circledR ® pounds £ yen ¥ euro € vdots ⋮ ddots ⋱ adots ⋰ iddots ⋰
   bigstar ★ blacktriangle ▲ blacktriangledown ▼ triangledown ▽ diagup ╱
   diagdown ╲ backslash \\ vert | Vert ‖ | ‖ maltese ✠ textdegree °`,
  'normal',
);

// Opérateurs préfixes (∀ x) : classe ord, mais balisés comme opérateurs.
define('mo', 'ord', `forall ∀ exists ∃ nexists ∄ neg ¬ lnot ¬`);

// Points de suspension : classe inner (légère espace de part et d'autre).
define('mo', 'inner', `ldots … cdots ⋯ mathellipsis …`);

define(
  'mo',
  'bin',
  `pm ± mp ∓ times × div ÷ cdot ⋅ centerdot · ast ∗ star ⋆ circ ∘ bullet ∙
   oplus ⊕ ominus ⊖ otimes ⊗ oslash ⊘ odot ⊙ cap ∩ cup ∪ sqcap ⊓ sqcup ⊔
   uplus ⊎ vee ∨ lor ∨ wedge ∧ land ∧ setminus ∖ smallsetminus ∖ wr ≀ amalg ⨿
   dagger † ddagger ‡ diamond ⋄ bigtriangleup △ bigtriangledown ▽
   triangleleft ◃ triangleright ▹ lhd ⊲ rhd ⊳ unlhd ⊴ unrhd ⊵ bigcirc ◯
   boxplus ⊞ boxminus ⊟ boxtimes ⊠ boxdot ⊡ dotplus ∔ divideontimes ⋇
   ltimes ⋉ rtimes ⋊ curlyvee ⋎ curlywedge ⋏ circledast ⊛ circledcirc ⊚
   circleddash ⊝ intercal ⊺ leftthreetimes ⋋ rightthreetimes ⋌ barwedge ⊼ veebar ⊻ doublebarwedge ⩞ Cap ⋒ Cup ⋓`,
);

define(
  'mo',
  'rel',
  `leq ≤ le ≤ geq ≥ ge ≥ neq ≠ ne ≠ equiv ≡ approx ≈ approxeq ≊ cong ≅ sim ∼
   simeq ≃ propto ∝ varpropto ∝ prec ≺ succ ≻ preceq ⪯ succeq ⪰ ll ≪ gg ≫ lll ⋘
   ggg ⋙ subset ⊂ supset ⊃ subseteq ⊆ supseteq ⊇ subsetneq ⊊ supsetneq ⊋
   nsubseteq ⊈ nsupseteq ⊉ nsubset ⊄ nsupset ⊅ sqsubset ⊏ sqsupset ⊐
   sqsubseteq ⊑ sqsupseteq ⊒ in ∈ ni ∋ owns ∋ notin ∉ perp ⟂ parallel ∥
   nparallel ∦ mid ∣ nmid ∤ shortmid ∣ shortparallel ∥ vdash ⊢ dashv ⊣
   models ⊨ vDash ⊨ Vdash ⊩ doteq ≐ asymp ≍ bowtie ⋈ Join ⋈ smile ⌣ frown ⌢
   leqslant ⩽ geqslant ⩾ lesssim ≲ gtrsim ≳ lessgtr ≶ gtrless ≷ nless ≮ ngtr ≯
   nleq ≰ ngeq ≱ nleqslant ⪇ ngeqslant ⪈ triangleq ≜ coloneqq ≔ coloneq ≔
   eqqcolon ≕ eqcolon ≕ risingdotseq ≓ fallingdotseq ≒ eqsim ≂ backsim ∽
   backsimeq ⋍ thicksim ∼ thickapprox ≈ bumpeq ≏ Bumpeq ≎ circeq ≗
   trianglelefteq ⊴ trianglerighteq ⊵ vartriangleleft ⊲ vartriangleright ⊳
   ntriangleleft ⋪ ntriangleright ⋫ precsim ≾ succsim ≿ lessdot ⋖ gtrdot ⋗
   therefore ∴ because ∵ between ≬ pitchfork ⋔ nsim ≁ ncong ≇ nequiv ≢
   lt < gt > to → gets ← rightarrow → leftarrow ← leftrightarrow ↔
   Rightarrow ⇒ Leftarrow ⇐ Leftrightarrow ⇔ longrightarrow ⟶ longleftarrow ⟵
   longleftrightarrow ⟷ Longrightarrow ⟹ Longleftarrow ⟸ Longleftrightarrow ⟺
   mapsto ↦ longmapsto ⟼ uparrow ↑ downarrow ↓ updownarrow ↕ Uparrow ⇑
   Downarrow ⇓ Updownarrow ⇕ nearrow ↗ searrow ↘ swarrow ↙ nwarrow ↖
   rightharpoonup ⇀ rightharpoondown ⇁ leftharpoonup ↼ leftharpoondown ↽
   upharpoonleft ↿ upharpoonright ↾ downharpoonleft ⇃ downharpoonright ⇂
   rightleftharpoons ⇌ leftrightharpoons ⇋ hookrightarrow ↪ hookleftarrow ↩
   leadsto ⇝ rightsquigarrow ⇝ leftrightsquigarrow ↭ twoheadrightarrow ↠
   twoheadleftarrow ↞ rightarrowtail ↣ leftarrowtail ↢ looparrowright ↬
   looparrowleft ↫ curvearrowright ↷ curvearrowleft ↶ circlearrowright ↻
   circlearrowleft ↺ Rrightarrow ⇛ Lleftarrow ⇚ rightrightarrows ⇉
   leftleftarrows ⇇ rightleftarrows ⇄ leftrightarrows ⇆ upuparrows ⇈
   downdownarrows ⇊ multimap ⊸ nrightarrow ↛ nleftarrow ↚ nRightarrow ⇏
   nLeftarrow ⇍ nleftrightarrow ↮ nLeftrightarrow ⇎ dashrightarrow ⇢
   dashleftarrow ⇠ Lsh ↰ Rsh ↱ leqq ≦ geqq ≧ lneq ⪇ gneq ⪈ lneqq ≨ gneqq ≩
   napprox ≉ doteqdot ≑ Coloneqq ⩴ nvdash ⊬ nvDash ⊭ Vvdash ⊪ nprec ⊀ nsucc ⊁
   preccurlyeq ≼ succcurlyeq ≽ lesseqgtr ⋚ gtreqless ⋛ lessapprox ⪅ gtrapprox ⪆
   notni ∌ Subset ⋐ Supset ⋑ vartriangle △ curlyeqprec ⋞ curlyeqsucc ⋟ restriction ↾ Perp ⫫`,
);

define('mo', 'punct', `colon : ldotp . cdotp ⋅`);

define(
  'mo',
  'open',
  `lbrace { { { langle ⟨ lfloor ⌊ lceil ⌈ lbrack [ lvert | lVert ‖ lgroup ⟮
   lmoustache ⎰ llbracket ⟦ ulcorner ⌜ llcorner ⌞ lparen (`,
);
define(
  'mo',
  'close',
  `rbrace } } } rangle ⟩ rfloor ⌋ rceil ⌉ rbrack ] rvert | rVert ‖ rgroup ⟯
   rmoustache ⎱ rrbracket ⟧ urcorner ⌝ lrcorner ⌟ rparen )`,
);

// Symboles de contrôle d'un seul caractère : \# \$ \% \& \_
for (const ch of ['#', '$', '%', '&', '_']) {
  SYMBOLS.set('\\' + ch, { char: ch, cls: 'ord', role: 'mi', variant: 'normal' });
}

// Grands opérateurs.
defineOps(
  `sum ∑ prod ∏ coprod ∐ bigcup ⋃ bigcap ⋂ bigvee ⋁ bigwedge ⋀ bigoplus ⨁
   bigotimes ⨂ bigodot ⨀ biguplus ⨄ bigsqcup ⨆`,
  true,
  true,
);
defineOps(`int ∫ iint ∬ iiint ∭ iiiint ⨌ oint ∮ oiint ∯ oiiint ∰ intop ∫ smallint ∫`, true, false);

// Noms de fonctions en romain.
defineOps(`lim max min sup inf det gcd lcm pgcd ppcm Pr injlim projlim`, false, true);
defineOps(
  `sin cos tan cot sec csc arcsin arccos arctan arccot sinh cosh tanh coth sech csch arcsinh arccosh arctanh argsh argch argth
   cotan tg ch sh th sgn erf exp log
   ln lg arg deg dim hom ker`,
  false,
  false,
);
OPERATORS.set('\\liminf', { name: 'lim inf', symbol: false, limits: true });
OPERATORS.set('\\limsup', { name: 'lim sup', symbol: false, limits: true });

/** Caractères ASCII tapés directement en mode mathématique. */
const ASCII: Record<string, SymbolInfo> = {
  '+': { char: '+', cls: 'bin', role: 'mo' },
  '-': { char: '−', cls: 'bin', role: 'mo' },
  '*': { char: '∗', cls: 'bin', role: 'mo' },
  '/': { char: '/', cls: 'ord', role: 'mo' },
  '=': { char: '=', cls: 'rel', role: 'mo' },
  '<': { char: '<', cls: 'rel', role: 'mo' },
  '>': { char: '>', cls: 'rel', role: 'mo' },
  ':': { char: ':', cls: 'rel', role: 'mo' },
  ',': { char: ',', cls: 'punct', role: 'mo' },
  ';': { char: ';', cls: 'punct', role: 'mo' },
  '.': { char: '.', cls: 'ord', role: 'mo' },
  '!': { char: '!', cls: 'close', role: 'mo' },
  '?': { char: '?', cls: 'close', role: 'mo' },
  '(': { char: '(', cls: 'open', role: 'mo' },
  ')': { char: ')', cls: 'close', role: 'mo' },
  '[': { char: '[', cls: 'open', role: 'mo' },
  ']': { char: ']', cls: 'close', role: 'mo' },
  '|': { char: '|', cls: 'ord', role: 'mo' },
  '@': { char: '@', cls: 'ord', role: 'mi', variant: 'normal' },
  '"': { char: '″', cls: 'ord', role: 'mo' },
  '`': { char: '‘', cls: 'ord', role: 'mo' },
};

/** Symbole d'une commande (\alpha, \leq...), ou undefined. */
export function lookupSymbol(command: string): SymbolInfo | undefined {
  return SYMBOLS.get(command);
}

/** Grand opérateur ou nom de fonction (\sum, \sin...), ou undefined. */
export function lookupOperator(command: string): OperatorInfo | undefined {
  return OPERATORS.get(command);
}

/** Symbole d'un caractère tapé directement (+, ≤, α...), ou undefined. */
export function lookupChar(char: string): SymbolInfo | undefined {
  return ASCII[char] ?? BY_CHAR.get(char);
}

/** Toutes les commandes connues des tables (pour l'autocomplétion de la démo). */
export function symbolCommands(): string[] {
  return [...SYMBOLS.keys(), ...OPERATORS.keys()];
}

/** Ajout par un plugin. */
export function addSymbol(command: string, info: SymbolInfo): void {
  SYMBOLS.set(command, info);
  if (!BY_CHAR.has(info.char)) BY_CHAR.set(info.char, info);
}

/**
 * Délimiteurs acceptés par \left, \right, \middle et \big :
 * commande ou caractère → caractère affiché ('' pour le délimiteur nul « . »).
 */
const DELIMITERS: Record<string, string> = {
  '(': '(',
  ')': ')',
  '[': '[',
  ']': ']',
  '\\{': '{',
  '\\}': '}',
  '\\lbrace': '{',
  '\\rbrace': '}',
  '\\lbrack': '[',
  '\\rbrack': ']',
  '|': '|',
  '\\|': '‖',
  '\\vert': '|',
  '\\Vert': '‖',
  '\\lvert': '|',
  '\\rvert': '|',
  '\\lVert': '‖',
  '\\rVert': '‖',
  '\\langle': '⟨',
  '\\rangle': '⟩',
  '<': '⟨',
  '>': '⟩',
  '\\lt': '⟨',
  '\\gt': '⟩',
  '\\lfloor': '⌊',
  '\\rfloor': '⌋',
  '\\lceil': '⌈',
  '\\rceil': '⌉',
  '\\llbracket': '⟦',
  '\\rrbracket': '⟧',
  '\\lgroup': '⟮',
  '\\rgroup': '⟯',
  '/': '/',
  '\\backslash': '\\',
  '.': '',
  '\\uparrow': '↑',
  '\\downarrow': '↓',
  '\\updownarrow': '↕',
  '\\Uparrow': '⇑',
  '\\Downarrow': '⇓',
  '\\Updownarrow': '⇕',
  '⟨': '⟨',
  '⟩': '⟩',
  '⌊': '⌊',
  '⌋': '⌋',
  '⌈': '⌈',
  '⌉': '⌉',
  '‖': '‖',
  '⟦': '⟦',
  '⟧': '⟧',
};

/** Caractère d'un délimiteur, '' pour « . », undefined si ce n'en est pas un. */
export function lookupDelimiter(text: string): string | undefined {
  return DELIMITERS[text];
}

/** Relations barrées par \not : forme précomposée quand elle existe. */
const NEGATIONS: Record<string, string> = {
  '=': '≠',
  '<': '≮',
  '>': '≯',
  '≤': '≰',
  '≥': '≱',
  '∈': '∉',
  '∋': '∌',
  '⊂': '⊄',
  '⊃': '⊅',
  '⊆': '⊈',
  '⊇': '⊉',
  '≡': '≢',
  '∼': '≁',
  '≃': '≄',
  '≅': '≇',
  '≈': '≉',
  '∣': '∤',
  '∥': '∦',
  '≺': '⊀',
  '≻': '⊁',
  '→': '↛',
  '←': '↚',
  '↔': '↮',
  '⇒': '⇏',
  '⇐': '⇍',
  '⇔': '⇎',
  '∃': '∄',
};

export function negate(char: string): string {
  return NEGATIONS[char] ?? char + '̸';
}
