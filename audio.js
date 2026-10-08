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
  if
