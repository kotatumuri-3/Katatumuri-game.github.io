// ===== 効果音＆BGMエンジン（Web Audio API） =====

// ===== 基本状態 =====
let audioContext = null;
let soundEnabled = true;

const BGM_NORMAL_URL = "sounds/bgm-normal.mp3";
const BGM_BONUS_URL  = "sounds/bgm-bonus.mp3";

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

// ===== 効果音（オシレーター） =====
function playBeep(frequency, duration, type, volume, delay) {
  if (!soundEnabled) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type || "sine";
    oscillator.frequency.value = frequency;

    const startTime = ctx.currentTime + (delay || 0);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume || 0.25, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
  }
  catch (error) {
    console.warn("効果音の再生に失敗しました。", error);
  }
}

function playNormalSound() {
  playBeep(880, 0.12, "sine", 0.22, 0);
}

function playBonusSound() {
  playBeep(880, 0.10, "triangle", 0.25, 0);
  playBeep(1320, 0.16, "triangle", 0.25, 0.09);
}

function playBombSound() {
  playBeep(140, 0.4, "sawtooth", 0.35, 0);
  playBeep(80, 0.5, "square", 0.30, 0.05);
}

function playStartSound() {
  playBeep(523, 0.14, "square", 0.18, 0);
  playBeep(659, 0.14, "square", 0.18, 0.08);
  playBeep(784, 0.14, "square", 0.18, 0.16);
  playBeep(1047, 0.20, "square", 0.18, 0.24);
}

function playGameOverSound() {
  playBeep(660, 0.15, "triangle", 0.22, 0);
  playBeep(550, 0.15, "triangle", 0.22, 0.13);
  playBeep(440, 0.30, "triangle", 0.22, 0.26);
}

function playQuitSound() {
  playBeep(440, 0.12, "sine", 0.18, 0);
  playBeep(330, 0.18, "sine", 0.18, 0.10);
}

function playBonusTimeSound() {
  playBeep(784,  0.10, "square",   0.20, 0);
  playBeep(1047, 0.10, "square",   0.20, 0.09);
  playBeep(1319, 0.10, "triangle", 0.22, 0.18);
  playBeep(1568, 0.22, "triangle", 0.24, 0.27);
  playBeep(2093, 0.28, "sine",     0.18, 0.40);
}

function playBonusTimeEndSound() {
  playBeep(1047, 0.12, "sine", 0.18, 0);
  playBeep(784,  0.20, "sine", 0.18, 0.10);
}

// ===== BGM エンジン（AudioContext ベース） =====
const bgmEngine = {
  normalBuffer: null,
  bonusBuffer: null,
  normalSource: null,
  bonusSource: null,
  normalGain: null,
  bonusGain: null,
  decoded: false,
  decoding: null,
  normalVolume: 0.35,
  bonusVolume: 0.40
};

async function loadAudioArrayBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("BGMの読み込みに失敗: " + url + " (" + response.status + ")");
  }
  return response.arrayBuffer();
}

async function decodeBgmBuffers() {
  if (bgmEngine.decoded) return true;
  if (bgmEngine.decoding) return bgmEngine.decoding;

  bgmEngine.decoding = (async function () {
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;

      const [normalArr, bonusArr] = await Promise.all([
        loadAudioArrayBuffer(BGM_NORMAL_URL),
        loadAudioArrayBuffer(BGM_BONUS_URL)
      ]);

      const [normalBuf, bonusBuf] = await Promise.all([
        new Promise(function (resolve, reject) {
          ctx.decodeAudioData(normalArr, resolve, reject);
        }),
        new Promise(function (resolve, reject) {
          ctx.decodeAudioData(bonusArr, resolve, reject);
        })
      ]);

      bgmEngine.normalBuffer = normalBuf;
      bgmEngine.bonusBuffer = bonusBuf;
      bgmEngine.decoded = true;
      return true;
    }
    catch (error) {
      console.warn("BGMのデコードに失敗しました。", error);
      return false;
    }
    finally {
      bgmEngine.decoding = null;
    }
  })();

  return bgmEngine.decoding;
}

function fadeGain(gainNode, target, durationMs, onComplete) {
  if (!gainNode) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const startValue = gainNode.gain.value;
  const durationSec = durationMs / 1000;

  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(startValue, now);
  gainNode.gain.linearRampToValueAtTime(target, now + durationSec);

  if (typeof onComplete === "function") {
    setTimeout(onComplete, durationMs + 30);
  }
}

function createLoopSource(buffer, gain) {
  const ctx = getAudioContext();
  if (!ctx || !buffer) return null;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  return source;
}

async function startBgmNormal() {
  if (!soundEnabled) return;

  if (bgmEngine.bonusSource && bgmEngine.bonusGain) {
    const bonusSource = bgmEngine.bonusSource;
    const bonusGain = bgmEngine.bonusGain;
    bgmEngine.bonusSource = null;
    bgmEngine.bonusGain = null;

    fadeGain(bonusGain, 0, 400, function () {
      try { bonusSource.stop(); } catch (e) {}
    });
  }

  const ok = await decodeBgmBuffers();
  if (!ok) return;

  if (bgmEngine.normalSource) {
    fadeGain(bgmEngine.normalGain, bgmEngine.normalVolume, 600);
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  const source = createLoopSource(bgmEngine.normalBuffer, gain);
  if (!source) return;

  bgmEngine.normalSource = source;
  bgmEngine.normalGain = gain;

  fadeGain(gain, bgmEngine.normalVolume, 600);
}

async function startBgmBonus() {
  if (!soundEnabled) return;

  if (bgmEngine.normalSource && bgmEngine.normalGain) {
    const normalSource = bgmEngine.normalSource;
    const normalGain = bgmEngine.normalGain;
    bgmEngine.normalSource = null;
    bgmEngine.normalGain = null;

    fadeGain(normalGain, 0, 400, function () {
      try { normalSource.stop(); } catch (e) {}
    });
  }

  const ok = await decodeBgmBuffers();
  if (!ok) return;

  if (bgmEngine.bonusSource) {
    fadeGain(bgmEngine.bonusGain, bgmEngine.bonusVolume, 400);
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const gain = ctx.createGain();
  gain.gain.value = 0;

  const source = createLoopSource(bgmEngine.bonusBuffer, gain);
  if (!source) return;

  bgmEngine.bonusSource = source;
  bgmEngine.bonusGain = gain;

  fadeGain(gain, bgmEngine.bonusVolume, 400);
}

function stopAllBgm() {
  if (bgmEngine.normalSource && bgmEngine.normalGain) {
    const normalSource = bgmEngine.normalSource;
    const normalGain = bgmEngine.normalGain;
    bgmEngine.normalSource = null;
    bgmEngine.normalGain = null;

    fadeGain(normalGain, 0, 500, function () {
      try { normalSource.stop(); } catch (e) {}
    });
  }

  if (bgmEngine.bonusSource && bgmEngine.bonusGain) {
    const bonusSource = bgmEngine.bonusSource;
    const bonusGain = bgmEngine.bonusGain;
    bgmEngine.bonusSource = null;
    bgmEngine.bonusGain = null;

    fadeGain(bonusGain, 0, 500, function () {
      try { bonusSource.stop(); } catch (e) {}
    });
  }
}

function pauseAllBgm() {
  if (bgmEngine.normalGain) bgmEngine.normalGain.gain.value = 0;
  if (bgmEngine.bonusGain)  bgmEngine.bonusGain.gain.value  = 0;
}

function resumeCurrentBgm(bonusTimeActive) {
  if (bonusTimeActive) {
    if (bgmEngine.bonusGain) fadeGain(bgmEngine.bonusGain, bgmEngine.bonusVolume, 400);
  }
  else {
    if (bgmEngine.normalGain) fadeGain(bgmEngine.normalGain, bgmEngine.normalVolume, 400);
  }
}

// ===== モジュールスクリプト（main.js）から参照できるようグローバル化 =====
window.getAudioContext = getAudioContext;
window.playBeep = playBeep;
window.playNormalSound = playNormalSound;
window.playBonusSound = playBonusSound;
window.playBombSound = playBombSound;
window.playStartSound = playStartSound;
window.playGameOverSound = playGameOverSound;
window.playQuitSound = playQuitSound;
window.playBonusTimeSound = playBonusTimeSound;
window.playBonusTimeEndSound = playBonusTimeEndSound;

window.startBgmNormal = startBgmNormal;
window.startBgmBonus  = startBgmBonus;
window.stopAllBgm     = stopAllBgm;
window.pauseAllBgm    = pauseAllBgm;
window.resumeCurrentBgm = resumeCurrentBgm;
window.decodeBgmBuffers = decodeBgmBuffers;

// soundEnabled のゲッター／セッター（main.js から読み書きできるように）
Object.defineProperty(window, "soundEnabled", {
  get: function () { return soundEnabled; },
  set: function (v) { soundEnabled = v; }
});
