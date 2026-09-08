# Les Jeux de Panem

Jeu de soirée pour le salon, en **hommage au film Hunger Games** (aucun but commercial).
Un seul écran (TV / ordinateur portable) que tout le groupe regarde, façon retransmission
du Capitole. On crée des tributs à son nom, on lance la Moisson, et on suit les 74ᵉ Hunger
Games manche après manche : présentation, défilé, plateau de Caesar, puis l'arène —
événements des Juges, incidents, coups de canon, cérémonie des disparus, un vainqueur.

## Lancer le jeu

Le jeu est 100 % local, sans build ni installation.

- **Le plus simple :** ouvrez `index.html` dans un navigateur (Chrome, Edge, Firefox).
- **Recommandé (petit serveur local)** — évite toute limitation du mode `file://`
  (musique, voix, import de fichier) :

  ```bash
  python -m http.server 4202
  ```

  puis ouvrez `http://localhost:4202`. (Configuration déjà prête dans `.claude/launch.json`.)

> Après une modification du code, incrémentez `V` dans `index.html` (`var V = "22"`) et les
> `?v=22` des feuilles de style, pour forcer le navigateur à recharger.
>
> Pour **ajouter vos propres répliques** (Caesar, annonceur, événements, morts) :
> voir [`TEXTES.md`](TEXTES.md).

Plein écran (bouton ⤢ en bas à droite, ou F11) pour l'affichage sur une TV.

## Modes de jeu (choix sur l'accueil)

- **Simple** — chaque tribut a des statistiques cachées (Force, Agilité, Ruse, Charisme,
  Survie). Idéal pour découvrir.
- **Avancé** — en plus des stats, chaque tribut a **2 compétences** (Archerie, Maître
  d'armes, Force herculéenne, Furtivité, Piégeur, Grimpeur, Nageur, Botaniste, Guérisseur,
  Endurance, Pisteur, Chouchou du Capitole). Elles changent le système de combat (bonus
  selon le type de rencontre) et la survie dans l'arène (résistance aux chutes, au poison,
  à la noyade, aux mutations…). Les joueurs choisissent les leurs à la création ; les
  tributs du film en reçoivent 2 automatiquement, cohérentes avec leur district.

## Déroulé d'une partie

1. **La Moisson** — cliquez sur une place de tribut pour l'incarner : nom d'un ami, photo
   facultative (reste sur l'ordinateur), emblème, et en mode Avancé ses 2 compétences.
   Les places libres = tributs du film. « Jouer avec les tributs du film » saute cette
   étape. « Sauvegarder » enregistre le groupe ; « Exporter le fichier » télécharge un
   `.json` à déposer sur le Bureau, rechargeable via « Importer un fichier de groupe ».
2. **Présentation des tributs** — l'annonceur ouvre les Jeux, puis chaque district défile
   (portraits + noms).
3. **Défilé des chars** — réactions de la foule → premiers points de sponsor.
4. **Séances privées** — notes des Juges (1 à 12).
5. **Plateau de Caesar Flickerman** — interviews, district par district (celui des joueurs
   d'abord), avec la voix de Caesar et sa musique de thème pour les joueurs.
6. **Le bain de sang** — phase interactive : chaque joueur choisit foncer / attraper-fuir /
   fuir, et forme des alliances. Les alliances déjà en place (meute des Carrières, groupes
   de joueurs) sont affichées ; on ne peut **pas relier deux clans ennemis** (être avec la
   meute *et* avec ceux qui la fuient). Un joueur qui incarne un **Carrière** (D1/2/4)
   choisit lui aussi : « Foncer » = rester avec la meute, tout autre choix = la quitter.
   Puis : **compte à rebours** sur les plaques (vidéo), la **corne de brume** (*War Horn*)
   lâche les tributs, et le bain de sang commence.
7. **Les manches d'arène** — l'action défile **message par message**. Chaque manche : un
   événement des Juges parmi ~30, des **incidents** (chute de falaise, baies empoisonnées,
   noyade, morsure venimeuse, infection, épuisement…), des rencontres — 2 phrases (une
   ouverture, puis un développement **choisi selon l'issue** pour rester cohérent),
   accumulées dans la même fenêtre ; le dénouement (mort, blessure) arrive comme temps
   fort **séparé**. **Aucune phrase n'est répétée dans la partie.** La page défile toute
   seule pour suivre le texte. Chaque tribut porte **une arme** (montrée à la Moisson et
   à la Corne, joueurs
   d'abord) qui le suit toute la partie et qui **compte selon la situation** : un arc écrase
   à distance et ne vaut rien au corps-à-corps, une lance tient l'ennemi à distance, des
   pièges ne servent qu'en embuscade… Les **alliances sont un vrai avantage** — le texte le
   dit (tenaille, arrières couverts, un contre trois). La meute des Carrières, des trahisons.
   À chaque mort : gros plan du tribut **en noir et blanc**, tampon rouge **◆ ÉLIMINÉ ·
   par X**, la **façon dont il tombe** (transpercé par une lance, coup de couteau, hache,
   faucille, flèche, piège à contrepoids…) et la **cause exacte**. Aucun son de canon
   pendant les manches — seulement un bref halo. Après chaque manche, le salon vote (à main
   levée) pour envoyer un **parachute** à un tribut : un clic sur sa carte, un parachute
   descend, et **l'avantage du cadeau** (soin, +Force, +Survie…) s'affiche en clair.
8. **Ceux qui sont tombés** — chaque nuit, portraits des disparus dans le ciel nocturne, un
   **coup de canon (avec son)** par tribut, rapprochés. Bouton **« Passer les canons »**
   pour aller droit au tableau de tous les disparus du jour.
9. **Le dénouement** — dernier tribut, ou **double victoire des amants maudits** (une paire
   de joueurs ou du District 12, du même district, alliée — la règle est annoncée en cours
   de partie et se joue si les deux sont les derniers). **Une partie ne dépasse jamais
   7 jours** : les Juges resserrent l'arène à l'approche (le plus souvent, ça se termine
   au jour 5 ou 6). Récapitulatif : chronologie, éliminations, chouchou du salon, graine
   d'arène pour rejouer.

## Lecture (barre du bas, pendant la présentation)

Les messages et événements **défilent tout seuls** au rythme choisi. On ne saute
**jamais** automatiquement d'un écran à l'autre : chaque passage se fait au clic sur le
bouton du bas.

- **Cliquer n'importe où sur l'écran** (sauf la barre du bas) = passer au message suivant
  (ou révéler la phrase suivante dans une fenêtre à plusieurs lignes). Espace / → au
  clavier aussi. ⏮ pour revoir le passage précédent.
- La page **défile toute seule** pour garder le texte visible quand les phrases
  s'accumulent : pas besoin de toucher à la molette.
- **⏸ Pause / ▶ Reprendre** — fige le déroulé sur n'importe quelle page. Touche **P**.
- **Vitesse** — 7 crans, de *Très lent* (~10 s par message) à *Rapide* (~2 s). Règle aussi
  le débit des voix. Le curseur et son libellé ne bougent plus quand on change de cran.
- Une fine **barre de progression** (fil d'Ariane) court sur le haut de la barre du bas —
  elle ne se décale jamais avec le texte.

## Identité visuelle par phase

Chaque étape a sa propre couleur d'ambiance et un rideau de transition qui l'annonce :
Moisson (acier), Présentation (violet), Défilé (or), Plateau de Caesar (magenta), Séances
(turquoise), Bain de sang (rouge), Arène de jour (or), Arène de nuit (bleu froid),
Cérémonie (bleu pâle), Sacre (or). Pendant l'arène, la barre du bas et les boutons son/voix
s'effacent pour ne pas casser l'ambiance.

## Réglages (boutons en bas à droite)

- **♪ Son** — sons et musique. Canon, **sifflet du geai moqueur** (seule annonce du
  vainqueur — pas de fanfare) et **corne de brume** (*War Horn*, fin du compte à rebours)
  = fichiers de `assets/sounds/` ; thème de Caesar = `assets/sounds/caesar-theme.mp3` ;
  compte à rebours = `assets/video/countdown.mp4` ; parachute, gong (doux) et un **clic
  d'interface discret et moderne** = synthétisés (Web Audio). Repli automatique si un
  fichier manque (le compte à rebours devient un décompte animé).
- **🗣 Voix** — synthèse vocale du navigateur (voix françaises de Windows) pour Caesar et
  l'annonceur. Se coupe d'un clic.
- **⤢ Plein écran.** `prefers-reduced-motion` est respecté.

Le jeu est **fidèle à l'esprit du film** (PG-13) — pas de réglage de ton.

## Vie privée

Tout se passe sur cet ordinateur. Tributs, photos importées, palmarès et réglages sont
enregistrés **uniquement dans le stockage local du navigateur** (ou dans un fichier `.json`
que vous exportez vous-même). Aucune donnée n'est envoyée sur Internet. Bouton « Effacer
mes données locales » sur l'accueil.

## Structure du projet

```
index.html                 point d'entrée + chargeur de scripts (?v=N pour le cache)
styles/                     thème « Capitole » (sans-serif) + animations, couleurs par phase
src/
  data.js                   districts, roster des 24 tributs, compétences, cadeaux, modes
  rng.js                    aléatoire racinable (une graine = une arène rejouable)
  audio.js                  sons synthétisés + lecture des fichiers son / musique
  voice.js                  synthèse vocale (Caesar / annonceur)
  storage.js                localStorage + compression photo + export/import fichier
  state.js                  état de partie (mode, cap 7 jours) + anti-répétition + helpers
  ui.js                     routeur d'écrans, scène « beat par beat », barre de lecture,
                            barre d'actions (retour / continuer), transitions de phase
  engine/
    weapons.js              armes des tributs (bonus/malus de combat selon la situation)
    tributes.js             génération des tributs, stats cachées, compétences, arme, puissance
    events.js               deck d'événements d'arène (~30) + incidents
    combat.js               résolution des affrontements (compétences incluses)
    deaths.js               narration des éliminations + incidents (chutes, poison…)
    commentary.js           répliques de Caesar Flickerman & de l'annonceur
    odds.js                 cotes des parieurs
    simulation.js           orchestration : bain de sang + manches (produit des « beats »)
  screens/                  home, roster, prelude, bloodbath, round, fallen, victory
assets/tributes/            les 24 portraits (d1m.png … d12f.png)
assets/sounds/              canon, geai moqueur, corne de brume, thème de Caesar (mp3)
assets/video/               compte à rebours de la Corne d'abondance (mp4)
assets/capitole-seal.png    sceau officiel du Capitole (accueil) — recoloré en or

TEXTES.md                   guide : ajouter ses propres répliques / événements
PLAYERS/  SOUNDS/  UTILS/    fichiers d'origine (sources de assets/)
```

## Droits d'auteur

Projet **personnel, non commercial, hommage de fan** au film *Hunger Games*.
Les portraits (`assets/tributes/`, `PLAYERS/`), les sons et musiques
(`assets/sounds/`, `SOUNDS/`), la vidéo du compte à rebours (`assets/video/`,
`UTILS/`), le sceau du Capitole et les noms *Hunger Games / Panem / Capitole* et
des personnages restent la propriété de **Lionsgate / Suzanne Collins**. Ils ne
sont inclus ici que pour un usage privé entre amis — **dépôt privé, aucune
diffusion publique, aucune vente**. Le **code** (`src/`, `styles/`) est, lui,
librement réutilisable.
