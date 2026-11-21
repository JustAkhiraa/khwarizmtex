# Polices embarquées

STIX Two, version **2.13 b171**, fichiers WOFF2 OpenType non modifiés.
Source : https://github.com/stipub/stixfonts/tree/v2.13b171/fonts/static_otf_woff2

Copyright 2001–2021 The STIX Fonts Project Authors. Distribution sous SIL Open
Font License 1.1 : voir `OFL.txt`. La licence des polices est distincte de celle du code.

Le build copie ces fichiers dans `dist/fonts`. La feuille optionnelle
`dist/khwarizm-fonts.css` les charge depuis le même serveur, jamais depuis un CDN.
La démo et Online l'activent par défaut ; le moteur JavaScript n'embarque pas les
polices et reste utilisable seul. Les métriques du moteur HTML restent des
approximations CSS, pas une exploitation complète des tables OpenType MATH.
