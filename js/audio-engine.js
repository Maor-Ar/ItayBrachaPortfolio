/* ============================================
   Global Audio Engine
   - Background ambient music on every page
   - Web Audio API analyser feeding __audioReactive
   - Mute/unmute button in corner
   - Shared AudioContext for music page players
   ============================================ */
(function () {
  'use strict';

  // Determine asset path base (pages/ or root)
  const isSubpage = window.location.pathname.includes('/pages/');
  const basePath = isSubpage ? '../' : '';

  // === State ===
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let bgAudio = null;
  let bgSource = null;
  let bgGain = null;
  let isMuted = false;
  let isStarted = false;
  let prevBass = 0;
  let bgSourceConnected = false;

  // Background track path - use encodeURI for Hebrew filename
  const BG_TRACK = basePath + 'assets/music/' + encodeURIComponent('אוגי האוגר') + '.mp3';

  // === Create mute button ===
  const muteBtn = document.createElement('button');
  muteBtn.id = 'global-mute-btn';
  muteBtn.setAttribute('aria-label', 'Toggle background music');
  muteBtn.innerHTML = `
    <svg class="mute-icon mute-icon--on" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
    <svg class="mute-icon mute-icon--off" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="9" x2="17" y2="15"></line>
      <line x1="17" y1="9" x2="23" y2="15"></line>
    </svg>`;
  // Start in muted visual state until playing
  muteBtn.classList.add('muted');
  document.body.appendChild(muteBtn);

  // === Init Audio Context ===
  function initAudio() {
    if (isStarted) return;
    isStarted = true;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Resume context if suspended (browser autoplay policy)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    bgGain = audioCtx.createGain();
    bgGain.gain.value = 0.35;

    bgAudio = new Audio();
    bgAudio.loop = true;
    // Do NOT set crossOrigin for local/same-origin files
    bgAudio.src = BG_TRACK;

    // Error handling
    bgAudio.addEventListener('error', function(e) {
      console.warn('BG audio failed to load:', BG_TRACK, e);
    });

    bgAudio.addEventListener('canplaythrough', function() {
      if (!bgSourceConnected) {
        bgSourceConnected = true;
        try {
          bgSource = audioCtx.createMediaElementSource(bgAudio);
          bgSource.connect(analyser);
          analyser.connect(bgGain);
          bgGain.connect(audioCtx.destination);
        } catch (err) {
          console.warn('Audio node connection error:', err);
          // Fallback: just play without analyser
        }
      }
      if (!isMuted) {
        bgAudio.play().catch(function(err) {
          console.warn('BG play failed:', err);
        });
        muteBtn.classList.remove('muted');
      }
    }, { once: true });

    // Also try to load
    bgAudio.load();

    // Start analysis loop
    analyseLoop();
  }

  // === Analysis Loop ===
  function analyseLoop() {
    if (!analyser || !dataArray) {
      requestAnimationFrame(analyseLoop);
      return;
    }

    // Music page player analyser overrides bg analyser
    if (window.__musicPageAnalyser) {
      var mpAnalyser = window.__musicPageAnalyser;
      var mpData = new Uint8Array(mpAnalyser.frequencyBinCount);
      mpAnalyser.getByteFrequencyData(mpData);
      processFrequencyData(mpData);
    } else {
      analyser.getByteFrequencyData(dataArray);
      processFrequencyData(dataArray);
    }

    requestAnimationFrame(analyseLoop);
  }

  function processFrequencyData(data) {
    var len = data.length;
    if (len === 0) return;
    var bassEnd = Math.max(1, Math.floor(len * 0.15));
    var midEnd = Math.floor(len * 0.5);

    var bassSum = 0, midSum = 0, highSum = 0;
    for (var i = 0; i < len; i++) {
      var v = data[i] / 255;
      if (i < bassEnd) bassSum += v;
      else if (i < midEnd) midSum += v;
      else highSum += v;
    }

    var bass = bassSum / bassEnd;
    var mid = midSum / Math.max(1, midEnd - bassEnd);
    var high = highSum / Math.max(1, len - midEnd);
    var energy = bass * 0.5 + mid * 0.3 + high * 0.2;

    var peak = bass > prevBass + 0.15 && bass > 0.5;
    prevBass = bass;

    var ar = window.__audioReactive || {};
    ar.bass = bass;
    ar.mid = mid;
    ar.high = high;
    ar.energy = energy;
    if (peak) ar.peak = true;
    window.__audioReactive = ar;

    if (typeof window.bgSetHue === 'function') {
      var hue = 180 + bass * 40 + mid * 60 + high * 80;
      window.bgSetHue(hue % 360);
    }
  }

  // === Mute Toggle ===
  muteBtn.addEventListener('click', function () {
    if (!isStarted) {
      // First click: init and play
      initAudio();
      isMuted = false;
      muteBtn.classList.remove('muted');
      return;
    }

    // Subsequent clicks: toggle
    isMuted = !isMuted;
    muteBtn.classList.toggle('muted', isMuted);

    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (bgAudio) {
      if (isMuted) {
        bgAudio.pause();
      } else {
        bgAudio.play().catch(function() {});
      }
    }
  });

  // Auto-init AudioContext on first interaction (but don't play yet — let mute button control that)
  var interactionEvents = ['click', 'touchstart', 'keydown'];
  function onFirstInteraction() {
    if (!isStarted) {
      initAudio();
      // Start muted by default — user clicks speaker to unmute
      isMuted = true;
      if (bgAudio) bgAudio.pause();
      muteBtn.classList.add('muted');
    }
    interactionEvents.forEach(function(e) {
      document.removeEventListener(e, onFirstInteraction);
    });
  }
  interactionEvents.forEach(function(e) {
    document.addEventListener(e, onFirstInteraction, { once: true });
  });

  // === Public API for music page ===
  window.bgMusicPause = function () {
    if (bgAudio) bgAudio.pause();
  };
  window.bgMusicResume = function () {
    if (bgAudio && !isMuted) bgAudio.play().catch(function() {});
  };
  window.bgMusicSetVolume = function (v) {
    if (bgGain) bgGain.gain.value = v;
  };
  window.getAudioContext = function () {
    if (!isStarted) initAudio();
    return audioCtx;
  };
  window.getAnalyser = function () {
    return analyser;
  };
  window.isBgMuted = function () {
    return isMuted;
  };

})();
