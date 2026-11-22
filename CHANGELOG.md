# Journal des changements

Ce projet suit le versionnement sémantique : les versions publiées prennent la forme
`MAJEURE.MINEURE.CORRECTIF`.

## À paraître

- Online : palette de 277 symboles/modèles recherchables, 12 catégories,
  matrices personnalisées jusqu’à 6 × 6, couleurs et réglages d’aperçu.
- Import local avec aperçu et confirmation des fichiers Markdown, texte,
  formules, sauvegardes JSON et texte de PDF via PDF.js chargé à la demande.
  L’extraction PDF n’inclut ni OCR ni reconstruction des formules.
- Insertion dans les documents : détection des blocs mathématiques, des titres
  et des dollars échappés pour éviter d’ajouter des délimiteurs incorrects.
- KhwarizmTeX Online : atelier Formule/Document, vues ordinateur et téléphone,
  thèmes, galerie, structures, suggestions, historique, brouillons locaux,
  partage de formule, exports source/balisage natif/JSON et impression épurée.
- `renderAllToNodes()` : rendu groupé directement dans le DOM et recalcul des
  références pour les documents éditables, sans interprétation de HTML.
- Polices STIX Two 2.13 b171 embarquées, optionnelles pour les intégrateurs,
  activées dans la démo et Online ; licence OFL fournie.
- Build statique d'Online dans `build/online`, indépendant du paquet du moteur.
- Démo : lancement local avec `npm run demo`, diagnostic visible en cas d'échec de chargement et message sans JavaScript (notamment pour le diagnostic Safari).
- Ajout de `\tag`, `\tag*`, `\label`, `\ref` et `\eqref`.
- Ajout de `renderAll()` : rendu groupé, cache des formules identiques et index des
  références, y compris lorsqu’une équation est déclarée après sa référence.
- Correction des ancres encodées, labels multiples, doublons et noms hérités d'Object.
- `\notag` et `\nonumber` désactivent la numérotation automatique de la formule.
- Diagnostics par formule exposés dans `renderAll().errors`.
- `\href` et `\url` avec activation explicite et liste fermée de protocoles.
- Limite de source `maxLength`, contrôle des récursions de style et des arbres issus d'exposants répétés.
- Correction du HTML seul caché aux lecteurs d'écran ; liens accessibles au clavier dans les sorties en balisage natif.
- Tests reproductibles sur 500 entrées aléatoires.
- Tests navigateur : géométrie, navigation, clavier et mobile.
- Modèle de CI Node 22/24 et vérification des artefacts Node 18/20/22/24 fourni ; activation GitHub séparée requise.
- Mise à jour des outils de développement pour corriger les alertes de dépendances.
- Ajout d’une matrice publique de compatibilité.
