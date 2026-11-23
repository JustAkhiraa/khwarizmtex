# KhwarizmTeX Online

Atelier local de formules et documents, dans le même dépôt que le moteur.
HTML/CSS et modules JavaScript natifs ; aucun CDN, aucune télémétrie,
aucun service de compte. Le moteur mathématique reste sans dépendance.
L’import PDF charge à la demande une copie locale de PDF.js 6.5.438 (Apache-2.0),
isolée du paquet du moteur et incluse dans le site statique.

## Démarrer

À la racine, après `npm ci`, lancer `npm run online`.
Ouvrir http://127.0.0.1:4173/online/. Le serveur n'écoute que sur cet ordinateur.
`KHW_DEMO_PORT=4174 npm run online` permet de choisir un autre port.
L'ouverture par `file://` n'est pas prise en charge pour Online (modules ES).

## Deux modes

- **Formule** : aperçu HTML + balisage natif accessible, insertion de structures,
  suggestions de commandes, annulation/rétablissement, copie, partage par
  fragment d'URL, exports source et balisage natif.
- **Document** : texte, titres et listes, formules inline entre `$`, blocs
  centrés délimités par `$$` sur leurs propres lignes. Les blocs avec `\label`
  sont numérotés ; les `\eqref` inline suivent les modifications du document.
  Export de la source en `.md` et impression / enregistrement PDF via le navigateur.

Les deux brouillons sont sauvegardés dans le stockage local du navigateur.
Ils ne sont pas synchronisés. Une sauvegarde JSON exporte les deux brouillons,
et l'import validé demande confirmation avant remplacement.

## Palette et présentation

**Tous les symboles** ouvre 365 modèles recherchables dans 15 catégories :
structures, grec, relations, ensembles/logique, flèches, fonctions, opérateurs,
accents/vecteurs, délimiteurs, styles, probabilités/statistiques, analyse,
algèbre/géométrie, physique et chimie.
Une sélection remplace le premier carré du modèle ; les autres carrés restent
à compléter. Dans un document, les insertions hors formule sont entourées de `$`.

**Matrices** construit de 1 à 6 lignes/colonnes avec six types de délimiteurs.
**Présentation** insère une couleur et règle la taille/fond de l’aperçu
pour la session. Ces deux derniers réglages ne sont pas sauvegardés.
Les modèles scientifiques utilisent la notation standard, sans mhchem ni siunitx.

## Importer ses documents

1. Cliquer sur **Importer** et choisir un fichier sur l’appareil.
2. Vérifier le contenu et les éventuels avertissements.
3. Confirmer **Remplacer le brouillon**. **Annuler** dans l’éditeur permet de
   retrouver le brouillon précédent pendant la session.

- `.md`, `.markdown`, `.txt` : mode Document ; les formules entre `$` et les
  blocs `$$` sur leurs propres lignes sont conservés. Le sous-ensemble Markdown
  est limité aux titres, listes et texte ; pas d’images, tableaux ou liens rendus.
- `.tex` : mode Formule. Les projets avec préambule/packages sont refusés.
- `.json` : sauvegarde de l’atelier, vérifiée avant remplacement des deux modes.
- `.pdf` : extraction du texte sélectionnable, page par page, dans le navigateur.
  Aucun document n’est envoyé à un service externe. Limites : 20 Mo, 100 pages,
  50 000 caractères extraits et délai de 25 secondes. Les PDF protégés nécessitent
  une copie déverrouillée. Les pages sans texte sont signalées ; un PDF entièrement
  scanné est refusé avec une explication.

**Les formules d’un PDF ne sont pas reconstituÃ©es.** Les symboles présents
dans la couche texte peuvent être extraits, mais les fractions, indices et l’ordre
de lecture peuvent être altérés. Il faut les vérifier et reconstruire les équations
avec la palette. Une reconnaissance OCR mathématique reste à développer.
Le fichier original n’est jamais modifié. Aucun import ne remplace le brouillon
avant confirmation ; un document trop long est refusé, jamais tronqué.

Exemple de document :

```text
## Énergie

Un objet de masse $m$ se déplace à la vitesse $v$.

$$
E_c = \frac{1}{2}mv^2\label{energie}
$$

Voir l’équation $\eqref{energie}$.
```

## Distribution statique

Lancer `npm run build:online`, puis publier le **contenu de `build/online/`**
sur un hébergement statique HTTPS. Les chemins sont relatifs : un sous-répertoire,
comme GitHub Pages, convient. Ce build n'inclut ni les comptes rendus ni le PDF
personnel de diagnostic. Il ne publie rien automatiquement et ne crée pas de second dépôt.

Un lien partagé sur localhost ne fonctionne que sur le même ordinateur.
Une fois le site hébergé, le fragment contient la formule encodée (pas chiffrée) :
quiconque dispose du lien peut la lire. Le serveur ne reçoit normalement pas
ce fragment. Le contenu reste accessible aux extensions du navigateur et aux
personnes ayant accès au profil de l'utilisateur.

## Architecture

- `app.js` : orchestration, événements, dialogue avec le moteur.
- `model.js` : validation des brouillons, stockage, historique borné, partage.
- `document.js` : grammaire de document et construction DOM sûre.
- `editor.js` : structures et autocomplétion, respect de la composition IME.
- `presets.js` : commandes et galerie.
- `catalog.js`, `tools.js` : palette, matrices et présentation.
- `imports.js` : validation, aperçu et extraction PDF chargée à la demande.
- `exports.js` : téléchargements, presse-papiers et balisage natif.

La police STIX Two est locale et sous SIL OFL 1.1 (voir `assets/fonts`).
Le moteur et Online n'ont aucun appel réseau externe à l'exécution.

## Limites explicites

- Le document n'est **pas** un compilateur de documents complet : pas de préambule,
  packages, bibliographie, images, projet multi-fichiers ni collaboration.
- Un numéro par bloc, pas par ligne d'un environnement aligné.
- Les signes `$` littéraux doivent être échappés en `\$`.
- Maximum 50 000 caractères par brouillon, 150 blocs et 300 formules inline.
  Une équation de document est limitée à 6 000 caractères. Ces bornes ne
  constituent pas une isolation CPU ; le rendu reste sur le thread principal.
- L'historique conserve 80 états par mode pendant la session, pas après rechargement.
- L'impression PDF utilise les fonctions du navigateur ; aucun export SVG/PNG
  mathématique natif n'est annoncé.
- Le site statique peut être utilisé sans Internet via le serveur local ; ce
  n'est pas encore une PWA installable avec cache hors ligne.
- Les tests clavier, mobile et balisage natif ne remplacent pas une validation manuelle
  avec VoiceOver/NVDA. La lecture vocale et l'exploration sémantique restent à faire.

## Vérifier

`npm test`, `npm run typecheck`, `npm run test:browser`, `npm run build:online`.
Les tests navigateur couvrent démarrage, largeur 320px, polices locales, thèmes,
brouillons, autocomplétion, historique, références dynamiques, contenu inerte,
galerie, palette, matrices, imports Markdown/PDF et exports. Le rapport contient des captures de contrôle ; il ne s'agit
pas encore de comparaisons pixel par pixel avec des baselines approuvées.
