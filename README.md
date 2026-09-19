# Lucerna

Lucerna est une application web mono-fichier permettant de **passer un QCM importé depuis un fichier JSON** : navigation libre entre les questions, marquage pour révision, récapitulatif avant soumission, score final et correction détaillée.

Aucune installation, aucun backend, aucune dépendance à builder : `lucerna.html` s'ouvre directement dans un navigateur.

---

## Sommaire

- [Démarrage rapide](#démarrage-rapide)
- [Fonctionnalités](#fonctionnalités)
- [Parcours utilisateur](#parcours-utilisateur)
- [Format du fichier JSON](#format-du-fichier-json)
- [Validation du JSON](#validation-du-json)
- [Calcul du score](#calcul-du-score)
- [Sauvegarde et reprise](#sauvegarde-et-reprise)
- [Thème clair / sombre](#thème-clair--sombre)
- [Responsive](#responsive)
- [Architecture technique](#architecture-technique)
- [Limites connues](#limites-connues)
- [Idées d'évolution](#idées-dévolution)

---

## Démarrage rapide

1. Ouvrez `lucerna.html` dans un navigateur (double-clic, ou glisser-déposer dans une fenêtre de navigateur).
2. Sur la page d'accueil, importez un fichier `.json` respectant le [format attendu](#format-du-fichier-json), ou cliquez sur **« Essayer avec un exemple »** pour tester avec un QCM de démonstration.
3. Une fois le fichier validé, cliquez sur **« Commencer le QCM »**.

Aucun serveur n'est requis : tout s'exécute côté navigateur.

---

## Fonctionnalités

- **Import drag & drop** ou bouton classique, avec validation stricte du JSON et messages d'erreur explicites.
- **Aperçu avant lancement** : titre, description, nombre de questions détectées.
- **Questions à choix unique ou multiple**, détectées automatiquement selon le nombre de bonnes réponses (`correctAnswers`).
- **Navigation libre** : boutons Précédent / Suivant, grille de numéros cliquables, raccourcis clavier (flèches gauche/droite).
- **États visuels distincts** pour chaque question (répondue, non répondue, marquée, en cours) — combinant couleur, icônes et formes pour rester accessible sans dépendre uniquement de la couleur.
- **Marquage « Flag / Review »** indépendant du fait d'avoir répondu ou non.
- **Écran de récapitulatif** avant soumission : compteurs (total, répondues, non répondues, marquées) et liste cliquable de toutes les questions.
- **Confirmation de soumission** si des questions restent sans réponse.
- **Résultats** avec anneau de score animé, pourcentage et répartition correct / incorrect / sans réponse.
- **Correction détaillée** question par question : réponse donnée, bonne réponse, statut, explication (si fournie), avec un filtre « Incorrectes seulement ».
- **Sauvegarde automatique** de la progression dans le navigateur (reprise possible après fermeture).
- **Mode clair / sombre**, bascule manuelle + détection des préférences système.
- **Responsive** : desktop, tablette, mobile.

---

## Parcours utilisateur

```
Accueil → Import JSON → Validation → Aperçu → Lancement du QCM
   → Réponses aux questions → Navigation libre → Marquage (optionnel)
   → Récapitulatif → (Confirmation si incomplet) → Soumission
   → Résultats → Correction détaillée
```

---

## Format du fichier JSON

```json
{
  "title": "ServiceNow Fundamentals",
  "description": "QCM de préparation",
  "questions": [
    {
      "id": 1,
      "question": "What is a Business Rule?",
      "image": "https://exemple.com/image.png",
      "category": "Plateforme",
      "difficulty": "facile",
      "choices": [
        { "id": "A", "text": "A server-side script" },
        { "id": "B", "text": "A client-side script" },
        { "id": "C", "text": "A database" },
        { "id": "D", "text": "A UI component" }
      ],
      "correctAnswers": ["A"],
      "explanation": "A Business Rule is a server-side script..."
    }
  ]
}
```

### Champs

| Champ | Niveau | Obligatoire | Description |
|---|---|---|---|
| `title` | QCM | non | Titre affiché dans l'application. Par défaut : « QCM sans titre ». |
| `description` | QCM | non | Courte description affichée sur l'aperçu d'import. |
| `questions` | QCM | **oui** | Liste des questions (au moins une). |
| `id` | question | **oui** | Identifiant unique de la question. |
| `question` | question | **oui** | Énoncé de la question. |
| `image` | question | non | URL d'une image associée à la question. |
| `category` | question | non | Catégorie libre (réservé pour usage futur). |
| `difficulty` | question | non | Niveau de difficulté libre (réservé pour usage futur). |
| `choices` | question | **oui** | Liste d'au moins 2 choix, chacun avec `id` et `text`. |
| `correctAnswers` | question | **oui** | Liste des `id` de choix corrects. Une seule entrée = question à choix unique ; plusieurs entrées = question à choix multiple. |
| `explanation` | question | non | Texte affiché dans la correction pour justifier la bonne réponse. |

---

## Validation du JSON

À l'import, l'application vérifie que :

- le fichier est un JSON syntaxiquement valide ;
- `questions` est un tableau non vide ;
- chaque question a un `id` et un `question` ;
- chaque question a au moins 2 `choices`, chacun avec `id` et `text` ;
- `correctAnswers` est non vide et référence uniquement des `id` présents dans `choices`.

En cas d'erreur, la liste complète des problèmes détectés (question par question) est affichée pour permettre une correction rapide du fichier.

---

## Calcul du score

Pour chaque question :

- **Sans réponse** : comptée dans « sans réponse ».
- **Correcte** : l'ensemble des choix sélectionnés est strictement identique à `correctAnswers` (peu importe l'ordre).
- **Incorrecte** : une réponse a été donnée mais ne correspond pas exactement à `correctAnswers` (y compris une sélection partielle sur une question à choix multiple).

Le pourcentage de réussite est calculé comme `correctes / total × 100`, arrondi à l'entier le plus proche.

---

## Sauvegarde et reprise

La progression (quiz chargé, réponses, marquages, question courante) est enregistrée automatiquement dans le `localStorage` du navigateur à chaque interaction. Si l'utilisateur revient sur la page d'accueil avec une session en cours non terminée, une bannière propose de **reprendre** ou d'**ignorer** cette session.

> La sauvegarde est locale au navigateur/appareil utilisé : elle n'est pas partagée entre appareils et est effacée si l'utilisateur vide les données du site.

---

## Thème clair / sombre

Un bouton (icône soleil/lune) permet de basculer manuellement entre les deux thèmes. Par défaut, l'application suit la préférence système (`prefers-color-scheme`) tant que l'utilisateur n'a pas fait de choix explicite ; ce choix est ensuite mémorisé.

---

## Responsive

L'interface s'adapte à la largeur d'écran :

- **Desktop / tablette large** : question et grille de navigation côte à côte.
- **Mobile / tablette étroite** : mise en page en une colonne, grille de statistiques resserrée, correction en une seule colonne.

---

## Architecture technique

Choix délibéré : **un seul fichier HTML autoportant**, sans build ni framework.

- **HTML/CSS** : mise en page en CSS natif (variables CSS pour la palette light/dark), quelques utilitaires Tailwind (chargé via CDN) pour la mise en page rapide.
- **JavaScript vanilla** (IIFE) : un objet d'état central (`state`) et des fonctions de rendu par écran (`renderHome`, `renderQuiz`, `renderReview`, `renderResults`), avec un re-rendu complet du conteneur `#app` à chaque changement d'état — largement suffisant pour ce volume de données et cette fréquence d'interaction.
- **Délégation d'événements** : un seul écouteur de clic sur `document`, qui route les actions via des attributs `data-action`.
- **Polices** : Fraunces (titres) + Manrope (interface), via Google Fonts.
- **Sécurité** : tout le texte provenant du JSON importé (titres, questions, choix, explications) est échappé avant insertion dans le DOM, pour éviter toute injection HTML via un fichier importé.

Ce choix évite la complexité d'un framework (React, Vue…) et d'une étape de build pour une application qui reste, fonctionnellement, un formulaire d'état à plusieurs écrans — au bénéfice de la portabilité (un seul fichier à partager ou héberger).

---

## Limites connues

- La sauvegarde de progression est locale au navigateur (pas de compte utilisateur, pas de synchronisation).
- Un seul QCM actif à la fois (pas d'historique multi-QCM conservé).
- Les champs `category` et `difficulty` sont acceptés dans le JSON mais ne sont pas encore exploités dans l'interface (filtrage, affichage).

## Idées d'évolution

- Filtrage des questions par catégorie ou difficulté.
- Mode examen avec minuteur global et arrêt automatique.
- Export du résultat (PDF ou image) et historique des QCM passés.
- Bouton « voir uniquement les questions flaggées » pendant le passage du QCM.
