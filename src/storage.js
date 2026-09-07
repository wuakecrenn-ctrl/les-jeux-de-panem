/* =========================================================================
   storage.js — persistance locale (localStorage uniquement).
   Aucune donnée n'est envoyée sur un serveur. Tout reste sur cet ordinateur.
   ========================================================================= */
(function (HG) {
  "use strict";

  var K_ROSTERS  = "hg.rosters";
  var K_HISTORY  = "hg.history";
  var K_SETTINGS = "hg.settings";

  function read(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false; // quota dépassé, mode privé, etc.
    }
  }

  // Réduit une image (dataURL) à ~256 px de côté pour tenir dans le quota.
  function compressImage(dataUrl, maxSide, cb) {
    maxSide = maxSide || 256;
    var img = new Image();
    img.onload = function () {
      var s = Math.min(1, maxSide / Math.max(img.width, img.height));
      var w = Math.round(img.width * s);
      var h = Math.round(img.height * s);
      var c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      try {
        cb(c.toDataURL("image/jpeg", 0.82));
      } catch (e) {
        cb(dataUrl);
      }
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }

  HG.storage = {
    available: (function () {
      try {
        var t = "__hg_test__";
        window.localStorage.setItem(t, t);
        window.localStorage.removeItem(t);
        return true;
      } catch (e) { return false; }
    })(),

    compressImage: compressImage,

    // --- Groupes d'amis (rosters) ---
    listRosters: function () {
      var r = read(K_ROSTERS, {});
      return Object.keys(r).map(function (name) {
        return { name: name, tributes: r[name].tributes, savedAt: r[name].savedAt };
      }).sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    },

    getRoster: function (name) {
      var r = read(K_ROSTERS, {});
      return r[name] || null;
    },

    // claims = [{ slotId, name, photo|null, emoji|null, portrait }]
    saveRoster: function (name, claims) {
      var r = read(K_ROSTERS, {});
      r[name] = { tributes: claims, savedAt: Date.now() };
      return write(K_ROSTERS, r);
    },

    deleteRoster: function (name) {
      var r = read(K_ROSTERS, {});
      delete r[name];
      return write(K_ROSTERS, r);
    },

    // --- Historique des vainqueurs ---
    listHistory: function () {
      return read(K_HISTORY, []);
    },

    addVictory: function (entry) {
      var h = read(K_HISTORY, []);
      h.unshift(entry);
      if (h.length > 50) h = h.slice(0, 50);
      return write(K_HISTORY, h);
    },

    // --- Réglages ---
    getSettings: function () {
      return read(K_SETTINGS, { sound: true, tone: "cine" });
    },

    saveSettings: function (patch) {
      var s = read(K_SETTINGS, { sound: true, tone: "cine" });
      for (var k in patch) if (patch.hasOwnProperty(k)) s[k] = patch[k];
      return write(K_SETTINGS, s);
    },

    // --- Export / import fichier (portable, à garder sur le Bureau) ---
    exportRoster: function (name) {
      var r = read(K_ROSTERS, {})[name];
      if (!r) return false;
      var payload = {
        format: "jeux-de-panem/roster",
        version: 1,
        name: name,
        savedAt: r.savedAt || Date.now(),
        tributes: r.tributes || []
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "groupe-" + name.replace(/[^\w\-]+/g, "_") + ".jeux-de-panem.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      return true;
    },

    // Importe un fichier exporté → l'enregistre dans le stockage local.
    importRosterFile: function (file, cb) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var tribs = data.tributes || (Array.isArray(data) ? data : null);
          var name = (data.name || file.name.replace(/\.[^.]+$/, "") || "Groupe importé").slice(0, 40);
          if (!tribs || !tribs.length) { cb(false, "Fichier de groupe invalide."); return; }
          var ok = HG.storage.saveRoster(name, tribs);
          cb(ok, ok ? name : "Enregistrement impossible (stockage plein ?).");
        } catch (e) {
          cb(false, "Fichier illisible.");
        }
      };
      reader.onerror = function () { cb(false, "Lecture du fichier impossible."); };
      reader.readAsText(file);
    },

    // --- Tout effacer ---
    wipe: function () {
      try {
        window.localStorage.removeItem(K_ROSTERS);
        window.localStorage.removeItem(K_HISTORY);
        window.localStorage.removeItem(K_SETTINGS);
        return true;
      } catch (e) { return false; }
    }
  };

})(window.HG = window.HG || {});
