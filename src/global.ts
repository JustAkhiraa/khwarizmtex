/**
 * Point d'entrée du fichier autonome (khwarizmtex.global.js), pour une page
 * qui le charge par <script src>. Tout est exposé dans window.KhwarizmTeX
 * et l'élément <khwarizm-math> est déclaré d'office.
 */
import { defineElement } from './plugins/element';

export * from './index';

if (typeof window !== 'undefined') defineElement();
