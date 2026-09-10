# Ajouter des textes au jeu

Tous les textes sont dans des **tableaux de chaînes** en clair, dans 5 fichiers.
Aucun outil : on ouvre le fichier, on ajoute une ligne, on recharge la page.

> Après chaque modif, incrémente `V` dans [`index.html`](index.html)
> (`var V = "25"` → `"26"`…) pour forcer le navigateur à recharger.

**Aucune phrase n'est répétée dans une même partie** : le jeu pioche sans
remise (`HG.narrPick`). Plus un tableau contient de phrases, moins on risque
d'en revoir une dans les très longues parties — donc n'hésite pas à en ajouter.

---

## 1. Voix de Caesar & de l'annonceur — [`src/engine/commentary.js`](src/engine/commentary.js)

| Tableau | Quand c'est utilisé |
|---|---|
| `CAESAR_INTRO` | petite phrase avant le nom du tribut, plateau de Caesar |
| `CAESAR_BY_PROFILE.career` / `.strong` / `.cunning` / `.charming` / `.small` / `.survivor` / `.plain` | la vanne de Caesar, selon le profil du tribut |
| `CHARIOT_HOT` / `CHARIOT_MID` / `CHARIOT_COLD` | réaction de la foule au défilé des chars (bonne / moyenne / froide) |
| `claudius.presentation` | ouverture de la présentation des tributs |
| `claudius.open`, `.feast`, `.convergence`, `.loversRule`… | annonces ponctuelles des Juges |

Codes : `{name}` = nom du tribut · `{d}` = numéro de district.

```js
charming: [
  "{name} a fait pleurer trois stylistes et rire toute la salle. Un phénomène.",
  "AJOUTE TA LIGNE ICI, avec une virgule à la fin.",
],
```

## 2. Événements d'arène — [`src/engine/events.js`](src/engine/events.js)

`HG.EVENTS` = la liste. Le champ **`announce`** est le texte dit par l'annonceur :
une chaîne, **ou un tableau de chaînes** (tirées au hasard). Ajoute-en autant que
tu veux. Pour un nouvel événement, copie un bloc entier et change `id` / `title` /
`announce` (l'en-tête du fichier liste tous les champs).

```js
{
  id: "blizzard", title: "Tempête de neige", phase: "night", weight: 5,
  exposure: 0.5, envDeath: 0.1, envWound: 0.35,
  announce: [
    "Les Juges lâchent le blizzard. En quelques minutes, on ne voit plus à trois pas.",
    "La neige tombe à l'horizontale. Le feu devient une question de vie ou de mort.",
  ]
},
```

## 3. Façons de mourir — [`src/engine/deaths.js`](src/engine/deaths.js)

| Tableau | Contenu |
|---|---|
| `BY_WEAPON.<arme>` | mort par arme : `blade`, `knife`, `spear`, `axe`, `arrow`, `mace`, `trident`, `sickle`, `sling`, `trap`, `hands` |
| `ENCOUNTER.<type>` | par type de rencontre : `melee`, `ranged`, `ambush`, `hunt`, `betrayal`, `pack_turn`, `duel` |
| `INCIDENTS` | morts solo : chute, baies, noyade, serpent, infection, épuisement, **déshydratation**, sables |
| `ENVIRON` | morts dues à un grand événement (la clé = l'`id` de l'événement) |

> **On ne meurt jamais de faim dans l'arène** — les Jeux durent quelques jours,
> pas des semaines. La mort par privation, c'est la **déshydratation**
> (`INCIDENTS` → `dehydration`). Évite donc « affamé » / « la faim » comme
> cause de mort ; « assoiffé » / « la soif », oui.

Chaque entrée = `{ line: "...", cause: "..." }`. `{k}` = tueur, `{v}` = victime.
`cause` s'affiche sous le portrait (ex. `"transpercé(e) par une lance"`).

```js
spear: [
  { line: "{k} arme le bras et transperce {v} d'un seul jet de lance.", cause: "transpercé(e) par une lance" },
  { line: "TA LIGNE. {k} … {v} …", cause: "… " },
],
```

## 4. Narration des affrontements & manches calmes — [`src/engine/simulation.js`](src/engine/simulation.js)

Une rencontre = **2 lignes** (parfois 3), puis l'issue (mort / blessure) comme
message **séparé**. La 2e ligne est choisie **selon le résultat** — elle ne
contredit jamais l'issue. Ajoutez autant de phrases que vous voulez, tant que
vous respectez le **contrat** du pool (indiqué en commentaire dans le fichier).

> **Règle d'orientation — `{A}` est toujours le camp qui prend l'ascendant.**
> Les phrases de traque, d'embûche et de tir supposent que `{A}` mène la
> rencontre ; `narrateClash()` échange donc les deux camps si besoin avant de
> remplir le modèle. Écris tes phrases dans ce sens-là.
> **Exception :** quand un camp est un groupe (`APPROACH_GROUP`, `GROUP_MID`,
> `GROUP_STANDOFF`), `{A}` est le camp le **plus nombreux**, parce que ces
> phrases mettent `{A}` au pluriel.

| Pool | Rôle | Codes autorisés |
|---|---|---|
| `APPROACH.{melee,ranged,ambush,hunt,flight}` | comment ça commence (pas d'arme, pas d'issue) | `{A}` `{B}` |
| `APPROACH_GROUP` | idem, un camp est un groupe. `{A}` = le plus nombreux (pluriel) | `{A}` `{B}` `{DEUX}` |
| `NUMBERS_WIN` | l'alliance a tranché : le camp le plus nombreux gagne et quelqu'un meurt. **`{SMALL}` y est toujours UN seul tribut** | `{BIG}` `{SMALL}` `{nbig}` `{nsmall}` |
| `NUMBERS_WIN_MANY` | pareil, mais les DEUX camps sont des groupes : **aucun verbe ne porte sur `{SMALL}`** | `{BIG}` `{SMALL}` `{nbig}` `{nsmall}` |
| `WEAPON_WIN` / `WEAPON_LOSE` | l'arme a tranché. **Jamais d'adjectif accordé sur `{w}`** | `{who}` `{w}` `{foe}` |
| `EXCHANGE` / `GROUP_MID` | échange neutre (repli ou petite victoire) | `{A}` `{B}` `{tB}` |
| `TIGHT` | combat très serré (3e ligne, rare) | `{A}` `{B}` `{DEUX}` |
| `STANDOFF` / `GROUP_STANDOFF` | fin sans mort | `{A}` `{B}` `{DEUX}` |
| `DRY_LINES` | manche qui se termine sans un canon | — |

Codes : `{A}` / `{B}` = les deux camps (nom déjà mis en forme) · `{DEUX}` =
« les deux (camps) » (à utiliser au lieu de « {A} et {B} » — sinon ça casse
quand un camp est un groupe) · `{na}` / `{nb}` = effectifs · `{BIG}` /
`{SMALL}` / `{nbig}` / `{nsmall}` = camp majoritaire / minoritaire et leurs
effectifs · `{who}` / `{w}` (arme au **singulier** : « l'arc », « la lance ») /
`{foe}`. La 1re lettre est mise en majuscule automatiquement ; « à/de le/les »
deviennent « au/aux/du/des » automatiquement dans les phrases d'arme et de
nombre.

**`{tB}` — accord des verbes sur `{B}`.** Dans les pools de groupe, `{B}` peut
désigner un tribut **ou plusieurs**. Colle `{tB}` à la fin du verbe : il devient
`« »` au singulier et `« nt »` au pluriel. Comme le procédé n'ajoute que
« nt », **n'utilise que des verbes du 1er groupe** sur `{B}` (recule/reculent,
compte/comptent, tombe/tombent…) — jamais « met », « sent », « disparaît ».

```js
"{A} avancent en ligne, méthodiques. {B} recule{tB} sans trouver d'ouverture.",
```

### Alliances et trahisons à l'écran

Un « beat » peut encadrer ses portraits par camp — on voit alors **qui se bat
avec qui**. Côté code : `camps: true` sur le beat, et `camp: "a" | "b" |
"traitor" | "victim"` sur chaque portrait (`campPorts()` s'en charge, avec une
pastille « +N » au-delà de 3). `stamp: { text: "Trahison", kind: "betray" }`
pose le grand bandeau rouge, et `betray: true` sur un beat de mort change
l'étiquette en « ◆ TRAHI ».

## 5. Armes — [`src/engine/weapons.js`](src/engine/weapons.js)

`HG.WEAPONS` : chaque arme a un `name` (« une lance »), un `the` (« la lance »),
une catégorie `cat` (relie aux morts de `deaths.js`), un `tag` (montré sur les
cartes) et des `kinds` = bonus/malus de combat **selon la situation**
(`melee`, `ranged`, `ambush`, `hunt`, `flight`, `duel`). Un arc : `ranged: +5`,
`melee: -3`. `SIGNATURE` fixe les armes « film » (Katniss → arc, Clove →
couteaux…) ; le reste est déduit du district / des compétences / des stats.

---

Règle d'or : garder le **ton du film** (PG-13, tendu mais sans gore). Une virgule
à la fin de chaque ligne, sauf la dernière du tableau (les deux marchent).
