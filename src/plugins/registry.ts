/**
 * Plugins : ajouter des macros, des symboles, des commandes ou des
 * environnements, une fois pour tous les rendus de la page.
 *
 * registerPlugin({
 *   name: 'vecteurs',
 *   macros: { '\\vect': '\\overrightarrow{#1}' },
 *   symbols: { '\\euro': { char: '€' } },
 * });
 */
import type { AtomClass, SymbolRole } from '../ast/nodes';
import { KhwarizmError } from '../errors';
import { addGlobalMacro } from '../macros/expander';
import { addEnvironment, addFunction, type CommandHandler, type EnvironmentSpec } from '../parser/functions';
import { addSymbol } from '../symbols/symbols';

export interface PluginSymbol {
  char: string;
  /** Classe d'atome (espacement) : 'ord' par défaut, 'rel' pour une relation... */
  class?: AtomClass;
  /** 'mi' (identifiant, par défaut), 'mo' (opérateur) ou 'mn' (nombre). */
  role?: SymbolRole;
}

export interface KhwarizmPlugin {
  name: string;
  macros?: Record<string, string>;
  symbols?: Record<string, PluginSymbol>;
  functions?: Record<string, CommandHandler>;
  environments?: Record<string, EnvironmentSpec>;
}

const registered: string[] = [];

/** Une commande : une barre oblique inverse suivie de lettres (\vect). */
function checkCommand(plugin: string, name: string): void {
  if (!/^\\[a-zA-Z]+$/.test(name)) {
    throw new KhwarizmError(`Plugin « ${plugin} » : nom de commande invalide « ${name} » (attendu : \\nom).`);
  }
}

export function registerPlugin(plugin: KhwarizmPlugin): void {
  if (!plugin || typeof plugin.name !== 'string' || plugin.name.trim() === '') {
    throw new KhwarizmError('Un plugin doit avoir un nom.');
  }
  for (const [name, source] of Object.entries(plugin.macros ?? {})) {
    checkCommand(plugin.name, name);
    addGlobalMacro(name, String(source));
  }
  for (const [name, symbol] of Object.entries(plugin.symbols ?? {})) {
    checkCommand(plugin.name, name);
    addSymbol(name, { char: symbol.char, cls: symbol.class ?? 'ord', role: symbol.role ?? 'mi' });
  }
  for (const [name, handler] of Object.entries(plugin.functions ?? {})) {
    checkCommand(plugin.name, name);
    if (typeof handler !== 'function') throw new KhwarizmError(`Plugin « ${plugin.name} » : ${name} n'est pas une fonction.`);
    addFunction(name, handler);
  }
  for (const [name, spec] of Object.entries(plugin.environments ?? {})) {
    if (!/^[a-zA-Z]+\*?$/.test(name)) {
      throw new KhwarizmError(`Plugin « ${plugin.name} » : nom d'environnement invalide « ${name} ».`);
    }
    addEnvironment(name, spec);
  }
  if (!registered.includes(plugin.name)) registered.push(plugin.name);
}

/** Noms des plugins enregistrés, dans l'ordre. */
export function registeredPlugins(): string[] {
  return registered.slice();
}
