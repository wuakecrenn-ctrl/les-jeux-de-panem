/* =========================================================================
   rng.js — générateur pseudo-aléatoire racinable (mulberry32)
   Une seed = une arène rejouable à l'identique.
   ========================================================================= */
(function (HG) {
  "use strict";

  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Fabrique un objet RNG à partir d'une seed (chaîne).
  HG.makeRng = function (seed) {
    var seedFn = xmur3(String(seed));
    var next = mulberry32(seedFn());

    var rng = {
      seed: String(seed),
      // float [0,1)
      f: function () { return next(); },
      // entier [min, max] inclus
      int: function (min, max) { return Math.floor(next() * (max - min + 1)) + min; },
      // vrai avec probabilité p
      chance: function (p) { return next() < p; },
      // élément au hasard
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      // tirage pondéré : items = [{...,weight}] ou weightKey personnalisé
      weighted: function (items, weightKey) {
        weightKey = weightKey || "weight";
        var total = 0, i;
        for (i = 0; i < items.length; i++) total += (items[i][weightKey] || 0);
        var r = next() * total;
        for (i = 0; i < items.length; i++) {
          r -= (items[i][weightKey] || 0);
          if (r <= 0) return items[i];
        }
        return items[items.length - 1];
      },
      // mélange en place (Fisher-Yates)
      shuffle: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        }
        return arr;
      }
    };
    return rng;
  };

  // Seed lisible au hasard (ex. "GAIA-4917").
  HG.randomSeed = function () {
    var words = ["GALE", "GAIA", "AVOX", "MUTT", "NYX", "CATO", "RUE", "PANEM",
                 "ARENE", "CORNE", "GEAI", "BRAISE", "TESSERA", "MOISSON"];
    var w = words[Math.floor(Math.random() * words.length)];
    return w + "-" + (1000 + Math.floor(Math.random() * 9000));
  };

})(window.HG = window.HG || {});
