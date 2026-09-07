# Ajouter des textes au jeu

Tous les textes sont dans des **tableaux de chaînes** en clair, dans 5 fichiers.
Aucun outil : on ouvre le fichier, on ajoute une ligne, on recharge la page.

> Après chaque modif, incrémente `V` dans [`index.html`](index.html)
> (`var V = "13"` → `"14"`…) pour forcer le navigateur à recharger.

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
| `INCIDENTS` | morts solo : chute, baies, noyade, serpent, infection, épuisement, faim, sables |
| `ENVIRON` | morts dues à un grand événement (la clé = l'`id` de l'événement) |

Chaque entrée = `{ line: "...", cause: "..." }`. `{k}` = tueur, `{v}` = victime.
`cause` s'affiche sous le portrait (ex. `"transpercé(e) par une lance"`).

```js
spear: [
  { line: "{k} arme le bras et transperce {v} d'un seul jet de lance.", cause: "transpercé(e) par une lance" },
  { line: "TA LIGNE. {k} … {v} …", cause: "… " },
],
```

## 4. Narration des affrontements & manches calmes — [`src/engine/simulation.js`](src/engine/simulation.js)

- `DRY_LINES` : ce qu'il se passe quand une manche se termine sans mort.
- `APPROACH` (par type) / `POSTURE` / `CLASH` / `STANDOFF` : les étapes narrées
  d'un duel.
- `APPROACH_GROUP` / `OUTNUMBER` / `OUTNUMBERED` : quand un camp est une
  **alliance** (l'avantage du nombre est mis en avant).
- `WEAPON_FAVOURS` / `WEAPON_HAMPERS` : quand l'arme d'un tribut est
  particulièrement adaptée — ou pas — à la situation.

Codes : `{A}` / `{B}` = les deux camps · `{wa}` / `{wb}` = arme portée ·
`{na}` / `{nb}` = effectifs · `{BIG}` / `{SMALL}` = camp majoritaire /
minoritaire · `{nbig}` / `{nsmall}` = leurs effectifs · `{who}` / `{w}` /
`{foe}` (armes) = tribut vedette / son arme / son adversaire.

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
