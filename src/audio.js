/* =========================================================================
   audio.js — sons entièrement synthétisés (Web Audio API).
   Aucun fichier son externe. Le contexte démarre au premier clic.
   ========================================================================= */
(function (HG) {
  "use strict";

  var ctx = null;
  var master = null;
  var enabled = true;

  // --- Échantillons réels (fichiers locaux) avec repli sur la synthèse ---
  var SAMPLE_SRC = {
    cannon: "assets/sounds/cannon.mp3",
    mockingjay: "assets/sounds/mockingjay.mp3",
    warhorn: "assets/sounds/war-horn.mp3"
  };
  var samples = {};
  var samplesReady = {};

  function loadSamples() {
    Object.keys(SAMPLE_SRC).forEach(function (key) {
      try {
        var a = new Audio(SAMPLE_SRC[key]);
        a.preload = "auto";
        a.addEventListener("canplaythrough", function () { samplesReady[key] = true; }, { once: true });
        a.addEventListener("error", function () { samplesReady[key] = false; });
        a.load();
        samples[key] = a;
      } catch (e) { samplesReady[key] = false; }
    });
  }

  // Joue l'échantillon si disponible. Renvoie true si un son a été lancé.
  function playSample(key, volume) {
    if (!enabled) return false;
    var base = samples[key];
    if (!base || samplesReady[key] === false) return false;
    try {
      var node = base.cloneNode(true);
      node.volume = volume == null ? 0.85 : volume;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
      return true;
    } catch (e) { return false; }
  }

  // --- Musique de fond (fichiers locaux) -------------------------------
  var MUSIC_SRC = { caesar: "assets/sounds/caesar-theme.mp3", fallen: "assets/sounds/fallen.mp3" };
  var musicEl = null;
  var musicFade = null;

  function stopMusic(fadeMs) {
    if (!musicEl) return;
    var el = musicEl; musicEl = null;
    if (musicFade) { clearInterval(musicFade); musicFade = null; }
    if (!fadeMs) { try { el.pause(); } catch (e) {} return; }
    var steps = 12, i = 0, v0 = el.volume;
    musicFade = setInterval(function () {
      i++;
      el.volume = Math.max(0, v0 * (1 - i / steps));
      if (i >= steps) { clearInterval(musicFade); musicFade = null; try { el.pause(); } catch (e) {} }
    }, fadeMs / steps);
  }

  function playMusic(key, opts) {
    opts = opts || {};
    stopMusic(0);
    if (!enabled) return;
    var src = MUSIC_SRC[key];
    if (!src) return;
    try {
      var el = new Audio(src);
      el.loop = opts.loop !== false;
      var target = opts.volume == null ? 0.4 : opts.volume;
      el.volume = opts.fadeIn ? 0 : target;
      var p = el.play();
      if (p && p.catch) p.catch(function () {});
      musicEl = el;
      if (opts.fadeIn) {
        var steps = 14, i = 0;
        musicFade = setInterval(function () {
          i++;
          if (!musicEl) { clearInterval(musicFade); musicFade = null; return; }
          el.volume = Math.min(target, target * (i / steps));
          if (i >= steps) { clearInterval(musicFade); musicFade = null; }
        }, opts.fadeIn / steps);
      }
    } catch (e) {}
  }

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  function now() { return ctx.currentTime; }

  function noiseBuffer(dur) {
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function env(node, t0, a, peak, d, sus, rel, susLevel) {
    var g = node.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + a);
    g.exponentialRampToValueAtTime(Math.max(susLevel || 0.0001, 0.0001), t0 + a + d);
    g.setValueAtTime(Math.max(susLevel || 0.0001, 0.0001), t0 + a + d + sus);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d + sus + rel);
  }

  function tone(freq, t0, dur, type, gain, dest) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }

  var API = {
    isEnabled: function () { return enabled; },

    setEnabled: function (v) {
      enabled = !!v;
      if (enabled) { ensure(); if (!Object.keys(samples).length) loadSamples(); }
      else { stopMusic(0); }
      if (master) master.gain.value = enabled ? 0.9 : 0.0;
      try { HG.storage.saveSettings({ sound: enabled }); } catch (e) {}
    },

    toggle: function () { API.setEnabled(!enabled); return enabled; },

    // Doit être appelé depuis un gestionnaire de clic pour débloquer l'audio.
    unlock: function () {
      var c = ensure();
      if (c && c.state === "suspended") c.resume();
      if (!Object.keys(samples).length) loadSamples();
    },

    // ---- Coup de canon : fichier réel, sinon synthèse ----
    cannon: function () {
      if (!enabled) return;
      if (playSample("cannon", 0.9)) return;
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now();

      // sub-basse qui chute
      var o = ctx.createOscillator();
      var og = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(1.1, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + 2);

      // détonation : bruit filtré passe-bas qui se referme (adouci)
      var n = ctx.createBufferSource();
      n.buffer = noiseBuffer(1.2);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(70, t + 0.9);
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.42, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      n.connect(lp); lp.connect(ng); ng.connect(master);
      n.start(t); n.stop(t + 1.2);
    },

    // ---- Hymne de Panem : motif de cuivres solennel ----
    anthem: function () {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now() + 0.05;
      var bus = ctx.createGain(); bus.gain.value = 0.5;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      bus.connect(lp); lp.connect(master);

      // Ré mineur -> Fa -> Do -> Ré (marche montante puis résolution)
      var seq = [
        [146.83, 0.0, 0.9], [220.0, 0.0, 0.9], [293.66, 0.0, 0.9],
        [174.61, 0.9, 0.8], [261.63, 0.9, 0.8], [349.23, 0.9, 0.8],
        [196.0,  1.7, 0.8], [293.66, 1.7, 0.8], [392.0,  1.7, 0.8],
        [146.83, 2.5, 1.6], [220.0, 2.5, 1.6], [293.66, 2.5, 1.6], [440.0, 2.5, 1.6]
      ];
      seq.forEach(function (s) {
        tone(s[0], t + s[1], s[2], "sawtooth", 0.16, bus);
        tone(s[0] * 2, t + s[1], s[2] * 0.8, "triangle", 0.05, bus);
      });
    },

    // ---- Corne de brume / War Horn : fin du compte à rebours de la Corne ----
    warHorn: function () {
      if (!enabled) return;
      if (playSample("warhorn", 0.95)) return;
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now() + 0.02;
      var bus = ctx.createGain(); bus.gain.value = 0.5; bus.connect(master);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(1400, t);
      lp.connect(bus);
      // nappe de cuivres graves, légèrement montante, longue
      [55, 82.4, 110, 164.8].forEach(function (f, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f, t);
        o.frequency.linearRampToValueAtTime(f * 1.03, t + 1.8);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.34 / (i + 1) + 0.06, t + 0.3);
        g.gain.setValueAtTime(0.34 / (i + 1) + 0.06, t + 1.6);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
        o.connect(g); g.connect(lp);
        o.start(t); o.stop(t + 2.7);
      });
    },

    // ---- Bip de compte à rebours (repli si la vidéo ne se lance pas) ----
    tick: function (last) {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now();
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(last ? 660 : 1100, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(last ? 0.14 : 0.09, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (last ? 0.5 : 0.18));
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + (last ? 0.55 : 0.22));
    },

    // ---- Sifflet du geai moqueur (fichier réel, sinon les 4 notes de Rue) ----
    mockingjay: function () {
      if (!enabled) return;
      if (playSample("mockingjay", 0.8)) return;
      if (!ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now() + 0.05;
      var notes = [784.0, 987.77, 1174.66, 659.25]; // sol, si, ré, mi
      notes.forEach(function (f, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = "sine";
        var st = t + i * 0.34;
        o.frequency.setValueAtTime(f * 0.98, st);
        o.frequency.linearRampToValueAtTime(f, st + 0.08);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.28, st + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.32);
        var vib = ctx.createOscillator(); var vg = ctx.createGain();
        vib.frequency.value = 6; vg.gain.value = 4;
        vib.connect(vg); vg.connect(o.frequency);
        o.connect(g); g.connect(master);
        o.start(st); o.stop(st + 0.4);
        vib.start(st); vib.stop(st + 0.4);
      });
    },

    // ---- Fanfare de victoire ----
    fanfare: function () {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now() + 0.05;
      var bus = ctx.createGain(); bus.gain.value = 0.5; bus.connect(master);
      var arp = [261.63, 329.63, 392.0, 523.25, 659.25];
      arp.forEach(function (f, i) {
        tone(f, t + i * 0.12, 0.5, "sawtooth", 0.18, bus);
      });
      // accord tenu
      [392.0, 493.88, 587.33, 783.99].forEach(function (f) {
        tone(f, t + 0.7, 1.8, "sawtooth", 0.12, bus);
        tone(f, t + 0.7, 1.8, "triangle", 0.05, bus);
      });
    },

    // ---- Tintement du parachute argenté ----
    parachute: function () {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now() + 0.02;
      [1318.5, 1760, 2093, 2637].forEach(function (f, i) {
        var o = ctx.createOscillator();
        var m = ctx.createOscillator();
        var mg = ctx.createGain();
        var g = ctx.createGain();
        o.type = "sine"; m.type = "sine";
        m.frequency.value = f * 2.01; mg.gain.value = f * 0.6;
        o.frequency.value = f;
        m.connect(mg); mg.connect(o.frequency);
        var st = t + i * 0.05;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.14, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
        o.connect(g); g.connect(master);
        o.start(st); o.stop(st + 1.2);
        m.start(st); m.stop(st + 1.2);
      });
    },

    // ---- Gong de la Moisson (grave, chaleureux, sans transitoire dur) ----
    gong: function () {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now() + 0.02;
      var partials = [1, 1.5, 2.0, 2.67, 3.55];
      var bus = ctx.createGain(); bus.gain.value = 0.42; bus.connect(master);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 2.5);
      lp.connect(bus);
      partials.forEach(function (p, i) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = 84 * p * (1 + (Math.random() - 0.5) * 0.008);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.42 / (i + 1), t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2 - i * 0.4);
        o.connect(g); g.connect(lp);
        o.start(t); o.stop(t + 3.4);
      });
    },

    // ---- Clic d'interface : « pop » doux et moderne (pas de son 8-bit) ----
    click: function () {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now();
      // court sinus qui descend + un souffle très bref, filtré
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(420, t + 0.05);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.12);

      var n = ctx.createBufferSource();
      n.buffer = noiseBuffer(0.03);
      var hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = 2200;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0.03, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(hp); hp.connect(ng); ng.connect(master);
      n.start(t); n.stop(t + 0.04);
    },

    // ---- Confirmation douce (action importante) ----
    confirm: function () {
      if (!enabled || !ensure()) return;
      if (ctx.state === "suspended") ctx.resume();
      var t = now();
      [523.25, 783.99].forEach(function (f, i) {
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.type = "sine"; o.frequency.value = f;
        var st = t + i * 0.06;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.05, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.22);
        o.connect(g); g.connect(master);
        o.start(st); o.stop(st + 0.25);
      });
    },

    // ---- Bourdon de tension (endgame) ----
    drone: function (dur) {
      if (!enabled || !ensure()) return;
      var t = now();
      tone(55, t, dur || 3, "sawtooth", 0.06);
      tone(82.4, t, dur || 3, "sine", 0.05);
    },

    // ---- Musique de fond ----
    music: playMusic,
    stopMusic: stopMusic
  };

  HG.audio = API;

})(window.HG = window.HG || {});
