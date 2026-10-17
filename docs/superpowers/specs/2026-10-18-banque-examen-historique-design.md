# Lucerna — Banque de QCM, options de lancement, mode examen, historique, impression

Date : 2026-10-18
Statut : à valider (points ouverts tranchés le 2026-10-18)

## Intention

Lucerna sert aujourd'hui à passer un QCM importé à la main depuis un fichier JSON. L'objectif est d'en faire un outil d'entraînement régulier, hébergé sur **GitHub Pages** :

- des QCM disponibles tout de suite, sans chercher de fichier (à commencer par `qcm/ccdv-f.json`, 91 questions) ;
- des conditions d'examen réalistes (minuteur, ordre aléatoire) ;
- un suivi de la progression au fil des tentatives, et des résultats imprimables.

Cela couvre les idées d'évolution n° 2, 3 et 4 du README, plus la banque de QCM et le mélange.

## Objectifs

1. **Banque de QCM** sur l'accueil, alimentée par le dossier `qcm/`.
2. **Options avant de commencer** : mélanger les questions, mélanger les choix, mode examen avec durée.
3. **Mode examen** : minuteur global, soumission automatique à la fin du temps (idée n° 2).
4. **Historique** des tentatives et **impression / PDF** des résultats (idée n° 3).
5. **Filtre « Marquées seulement »** pendant le passage du QCM (idée n° 4).

## Non-objectifs

- Pas de compte, de backend ni de synchronisation entre appareils : tout reste dans le navigateur (`localStorage`).
- Pas d'export en image. L'impression du navigateur (« Enregistrer en PDF ») suffit.
- Pas de filtrage par `category` / `difficulty` (idée n° 1, hors périmètre).
- Pas de build, de framework ni de bibliothèque ajoutée. On garde un seul `index.html`, plus les fichiers de données dans `qcm/`.

## Anti-objectifs (ce qui serait un échec même si « ça marche »)

- L'import manuel d'un JSON cesse de fonctionner, ou la page devient inutilisable quand `qcm/` ne peut pas être chargé (ouverture en `file://`, par exemple).
- Le minuteur repart à zéro au rechargement de la page, ce qui permettrait de tricher sans le vouloir.
- Les lettres affichées dans la correction ne correspondent pas à celles vues pendant le QCM quand les choix ont été mélangés.
- Une session en cours ou l'historique est perdu à cause d'un changement de format non géré.

## Contraintes

- Hébergement sur GitHub Pages : les fichiers de `qcm/` sont servis en statique et chargés par `fetch` avec des chemins **relatifs** (le site peut être servi sous un sous-chemin `/lucerna/`).
- Tout le texte issu des JSON (banque ou import) passe par `esc()` avant insertion dans le HTML.
- L'interface reste en français. On réutilise les jetons CSS (`--accent`, `--gold`, `--danger`…) et les composants existants (`.card`, `.btn`, `.status-pill`, modales `.modal-back`).
- On respecte l'architecture actuelle : objet `state` central, rendu complet via `render()`, actions routées par `data-action`.

## Décisions de ton partenaire humain

### 1. Banque de QCM

- L'accueil affiche une **liste des QCM disponibles**. CCDV-F est le premier, d'autres viendront. L'**import d'un fichier JSON reste disponible à côté** (bouton et glisser-déposer).
- Chaque carte montre le titre, la description et le nombre de questions. Cliquer sur une carte ouvre l'aperçu existant (`importPreview`), puis on lance le QCM.
- Les QCM sont recensés dans un manifeste **`qcm/index.json`**, un tableau de noms de fichiers : `["ccdv-f.json"]`. Ajouter un QCM = déposer le fichier dans `qcm/` et ajouter son nom au manifeste.
- Chaque fichier de la banque passe par `validateQuiz` / `normalizeQuiz`, comme un import. Un fichier invalide ou introuvable n'empêche pas les autres de s'afficher : sa carte n'apparaît pas, ou apparaît en erreur (au choix du builder), avec un `console.warn`.
- Si le manifeste ne peut pas être chargé (`file://`, réseau), la section affiche un message court, par exemple « Banque indisponible hors ligne — importez un fichier JSON », et l'import manuel reste pleinement fonctionnel.
- Le bouton **« Essayer avec un exemple » et `DEMO_QUIZ` sont retirés**.

### 2. Options avant de commencer

Sur l'écran d'aperçu, pour la banque comme pour l'import, juste avant « Commencer le QCM » :

- ☐ Mélanger les questions
- ☐ Mélanger les choix de réponse
- ☐ Mode examen avec minuteur — durée **préremplie à 1 h 30**, modifiable par la personne qui passe l'examen.

### 3. Mode examen

- Le temps restant est visible en permanence dans la barre du haut pendant le QCM et sur l'écran récapitulatif.
- Il change d'apparence à l'approche de la fin (seuil proposé : 5 min restantes).
- **Le minuteur survit au rechargement** : la fin est calculée à partir d'un horodatage absolu (`deadline = startedAt + durée`), pas d'un compte à rebours en mémoire.
- **À la fin du temps** : soumission automatique, sans confirmation. Les questions sans réponse comptent comme « sans réponse ». Les résultats indiquent que la soumission vient de l'expiration du temps et affichent le temps utilisé.
- Sans mode examen : pas de minuteur, comportement actuel.

**Reprise et sortie d'un examen** :
- Un rechargement pendant un examen en cours ramène **directement** dans le QCM (ou dans le récapitulatif), sans bannière « Reprendre / Ignorer ».
- Si la page est ouverte après l'échéance, l'examen est **soumis et enregistré dans l'historique dès le chargement**, puis on arrive sur les résultats avec la mention « temps écoulé ».
- Un bouton **« Abandonner l'examen »** (pendant le QCM et dans le récapitulatif) demande une confirmation, puis **soumet et enregistre** la tentative avec les réponses données. Il n'existe aucun moyen de quitter un examen sans qu'il soit enregistré, en dehors de vider les données du site.
- Hors mode examen : la bannière « Reprendre / Ignorer » et le comportement actuel d'« Ignorer » (suppression sans historique) restent inchangés.
- Une tentative n'est enregistrée qu'une seule fois, même en cas de rechargement sur l'écran de résultats.

### 4. Mélange

- Le mélange est tiré **une seule fois au lancement** et enregistré dans la session : la reprise et le rechargement gardent le même ordre.
- « Recommencer ce QCM » réapplique les mêmes options, avec un nouveau tirage.
- **Mélange des choix** : les lettres affichées (A, B, C, D) suivent la position à l'écran, comme aujourd'hui (`choiceLetter(i)`). La correction détaillée doit utiliser **les mêmes lettres positionnelles** que celles vues pendant le QCM, et non les `id` d'origine du JSON. Les `id` internes et `correctAnswers` restent inchangés, donc le calcul du score n'est pas touché.
- Sans mélange : les lettres positionnelles coïncident avec l'ordre du fichier, aucun changement visible.
- **Explications** : les explications des JSON citent les lettres d'origine (les 91 de CCDV-F, par exemple « Why D is correct… »). Elles ne sont pas réécrites. Quand les choix ont été mélangés, la correction affiche pour chaque réponse (« Votre réponse » et « Bonne réponse ») la lettre vue à l'écran **suivie de la lettre d'origine**, par exemple « B (D dans l'explication) ». Le rappel n'apparaît que si les deux lettres diffèrent.
- La lettre d'origine est la position du choix dans le fichier (`choiceLetter` de l'index d'origine), ce qui coïncide avec l'`id` pour CCDV-F.

### 5. Historique (suivi de progression)

- À chaque soumission (manuelle ou par expiration du temps), une tentative est enregistrée : identifiant du QCM, titre, date, score %, nombre de bonnes / mauvaises / sans réponse / total, mode examen oui/non, temps utilisé, options de mélange.
- Stockage dans `localStorage`, sous une clé dédiée versionnée, distincte de la session en cours.
- Sur l'accueil :
  - chaque carte de la banque affiche « Dernier : X % · Meilleur : Y % » s'il existe des tentatives pour ce QCM ;
  - une section « Mes résultats » liste les tentatives, la plus récente en premier ;
  - un petit graphique d'évolution du score par QCM ;
  - un bouton « Effacer l'historique », avec confirmation.
- Les QCM importés à la main apparaissent aussi dans l'historique.
- Limite connue, à mentionner dans le README : l'historique reste local à ce navigateur et à cet appareil.

### 6. Impression / PDF

- Bouton « Imprimer / PDF » sur l'écran de résultats → `window.print()`.
- Une feuille de style `@media print` produit une page propre : titre du QCM, date, score, répartition, mention « temps écoulé » le cas échéant, puis la **correction détaillée complète**, quel que soit le filtre actif à l'écran. Les boutons, la barre du haut, le sélecteur de thème et les modales sont masqués.
- L'impression se fait en thème clair, même si l'écran est en sombre.

### 7. Filtre « Marquées seulement »

- Pendant le QCM, un bouton bascule « Marquées seulement » restreint la grille de navigation **et** les boutons Précédent / Suivant (ainsi que les flèches du clavier) aux questions marquées.
- S'il n'y a aucune question marquée, le bouton est désactivé, ou affiche un état vide explicite.
- Si l'on retire le marquage de la question courante alors que le filtre est actif, on reste sur la question. La navigation suivante saute simplement aux questions marquées.

## Laissé au builder

- Mise en page exacte de l'accueil (ordre et disposition banque / import / historique), dans le style visuel existant.
- Format de saisie de la durée (heures + minutes, ou minutes), bornes raisonnables (par ex. 1 min – 10 h) et validation.
- Forme du graphique d'évolution : SVG en ligne, sans bibliothèque, qui fonctionne en thème clair et sombre.
- Identifiant d'un QCM dans l'historique : nom de fichier pour la banque, titre (ou hash du contenu) pour un import.
- Migration de la session en cours : bumper `lucerna:quiz-session:v1` en `v2`, ou lire l'ancien format avec des valeurs par défaut. L'essentiel est qu'une ancienne session ne fasse pas planter l'app.
- Limite éventuelle de taille de l'historique.
- Mises à jour du README (fonctionnalités, format de `qcm/index.json`, retrait de l'exemple, idées d'évolution réalisées) et de `CLAUDE.md`.

## Vérification attendue

Pas de suite de tests dans le projet. La vérification est manuelle, dans un navigateur, via un serveur statique local (`python -m http.server`) pour simuler GitHub Pages :

- banque chargée, import manuel OK, page en `file://` toujours utilisable ;
- mélange questions et choix, correction cohérente avec les lettres vues ;
- minuteur : rechargement en cours d'examen, expiration (avec une durée courte), réouverture après l'échéance ;
- historique alimenté, meilleur et dernier score sur la carte, effacement ;
- aperçu d'impression ;
- filtre « Marquées seulement » ;
- thème clair et sombre, mobile.
