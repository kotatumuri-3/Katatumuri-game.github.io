import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  onValue,
  query,
  orderByChild
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD2OPkwanJDOFc9HgQV_5cdFCMvgiF3IaA",
  authDomain: "katatumuri-game.firebaseapp.com",
  databaseURL: "https://katatumuri-game-default-rtdb.firebaseio.com",
  projectId: "katatumuri-game",
  storageBucket: "katatumuri-game.firebasestorage.app",
  messagingSenderId: "223594768335",
  appId: "1:223594768335:web:680d1ce6abe02d357d54ba",
  measurementId: "G-ZBF98Q1RQ9"
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const firebaseDatabase = getDatabase(firebaseApp);

// ===== 要素の取得 =====
const game = document.getElementById("game");
const quitButton = document.getElementById("quit-button");
const soundToggle = document.getElementById("sound-toggle");
const player = document.getElementById("player");
const scoreElement = document.getElementById("score");
const timeElement = document.getElementById("time");
const startScreen = document.getElementById("start-screen");
const endScreen = document.getElementById("end-screen");
const finalScoreElement = document.getElementById("final-score");
const messageElement = document.getElementById("message");
const rewardElement = document.getElementById("reward");
const rankingButton = document.getElementById("ranking-button");
const rankingArea = document.getElementById("ranking-area");
const rankingList = document.getElementById("ranking-list");
const rankingPodium = document.getElementById("ranking-podium");
const rankingCloseButton = document.getElementById("ranking-close-button");
const startButton = document.getElementById("start-button");
const retryButton = document.getElementById("retry-button");
const playerNameInput = document.getElementById("player-name");
const nameError = document.getElementById("name-error");
const syncStatus = document.getElementById("sync-status");

const bonusFlash = document.getElementById("bonus-flash");
const bonusBanner = document.getElementById("bonus-banner");

// ===== ゲーム状態 =====
let score = 0;
let elapsedTime = 0;
let playing = false;

let objects = [];
let spawnTimer;
let clockTimer;
let animationId;
let previousTime = 0;

let fileRanking = [];
let currentPlayerName = "";

// ===== ボーナスタイム関連 =====
let bonusTimeActive = false;
let bonusTimeEndTimer = null;
let bonusTimeStartTimer = null;

const BONUS_DURATION_MS = 5000;
const BONUS_SPAWN_MS = 380;
const NORMAL_SPAWN_MS = 620;

const BONUS_FIRST_DELAY_MIN_MS = 8000;
const BONUS_FIRST_DELAY_MAX_MS = 15000;
const BONUS_INTERVAL_MIN_MS = 12000;
const BONUS_INTERVAL_MAX_MS = 25000;

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

// ===== Firebase 認証・ランキング =====
let signedInUser = null;
let resolveAuthReady;

const authReady =
  new Promise(function (resolve) {
    resolveAuthReady = resolve;
  });

function setSyncStatus(message, isError) {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("error", Boolean(isError));
}

async function initializeSharedRanking() {
  onAuthStateChanged(
    firebaseAuth,
    function (user) {
      if (user) {
        signedInUser = user;
        resolveAuthReady(user);
      }
    }
  );

  try {
    if (!firebaseAuth.currentUser) {
      await signInAnonymously(firebaseAuth);
    }
  }
  catch (error) {
    console.error("匿名認証に失敗しました。", error);
    setSyncStatus("ランキング接続に失敗しました。", true);
    resolveAuthReady(null);
  }

  const scoresQuery = query(
    ref(firebaseDatabase, "scores"),
    orderByChild("score")
  );

  onValue(
    scoresQuery,
    function (snapshot) {
      const ranking = [];

      snapshot.forEach(function (childSnapshot) {
        const record = childSnapshot.val();
        if (record) {
          ranking.push(record);
        }
      });

      fileRanking = ranking.sort(
        function (first, second) {
          return Number(second.score || 0) - Number(first.score || 0);
        }
      );

      if (rankingArea.classList.contains("is-open")) {
        renderRanking();
      }
    },
    function (error) {
      console.error("ランキング取得に失敗しました。", error);
      setSyncStatus("ランキングを取得できませんでした。", true);
    }
  );
}

// ===== プレイヤー操作 =====
function movePlayer(clientX) {
  if (!playing) return;

  const gameRect = game.getBoundingClientRect();
  const halfWidth = player.offsetWidth / 2;
  const newPosition = clientX - gameRect.left;

  const limitedPosition = Math.max(
    halfWidth,
    Math.min(gameRect.width - halfWidth, newPosition)
  );

  player.style.left = limitedPosition + "px";
}

game.addEventListener("pointerdown", function (event) {
  movePlayer(event.clientX);
});

game.addEventListener("pointermove", function (event) {
  if (event.buttons || event.pointerType === "touch") {
    movePlayer(event.clientX);
  }
});

// ===== 落下オブジェクト =====
function createObject() {
  if (!playing) return;

  let targetClass = "normal-target";
  let pointValue = 1;
  let isBomb = false;

  let speed = 190 + Math.random() * 110;

  if (bonusTimeActive) {
    targetClass = "bonus-target";
    pointValue = 3;
    speed += 20;
  }
  else {
    const randomNumber = Math.random();

    if (randomNumber < 0.15) {
      targetClass = "bomb-target";
      isBomb = true;
      speed += 35;
    }
    else if (randomNumber < 0.28) {
      targetClass = "bonus-target";
      pointValue = 3;
      speed += 20;
    }
  }

  const element = document.createElement("div");
  element.className = "falling " + targetClass;

  const targetSize = 65;
  const usableWidth = Math.max(
    1,
    game.clientWidth - targetSize - 16
  );

  const positionX = 8 + Math.random() * usableWidth;

  const object = {
    element: element,
    x: positionX,
    y: -75,
    speed: speed,
    value: pointValue,
    isBomb: isBomb,
    removed: false
  };

  element.style.left = positionX + "px";

  game.appendChild(element);
  objects.push(object);
}

function objectsTouch(first, second) {
  return !(
    first.right < second.left ||
    first.left > second.right ||
    first.bottom < second.top ||
    first.top > second.bottom
  );
}

function showPoints(x, y, value) {
  const text = document.createElement("div");

  text.className =
    value < 0 ? "point-text bomb-point" : "point-text";

  text.style.left = x + "px";
  text.style.top = y + "px";

  text.textContent =
    value > 0 ? "+" + value : String(value);

  game.appendChild(text);

  setTimeout(function () {
    text.remove();
  }, 850);
}

function removeObject(object) {
  object.removed = true;
  object.element.remove();
}

// ===== ボーナスタイム =====
function startBonusTime() {
  if (bonusTimeActive) {
    clearTimeout(bonusTimeEndTimer);
    bonusTimeEndTimer = setTimeout(endBonusTime, BONUS_DURATION_MS);
    return;
  }

  bonusTimeActive = true;

  bonusFlash.classList.add("is-active");
  bonusBanner.classList.add("is-visible");
  bonusBanner.setAttribute("aria-hidden", "false");

  window.playBonusTimeSound();
  window.startBgmBonus();

  clearInterval(spawnTimer);
  spawnTimer = setInterval(createObject, BONUS_SPAWN_MS);

  clearTimeout(bonusTimeEndTimer);
  bonusTimeEndTimer = setTimeout(endBonusTime, BONUS_DURATION_MS);
}

function endBonusTime() {
  if (!bonusTimeActive) return;

  bonusTimeActive = false;

  bonusFlash.classList.remove("is-active");
  bonusBanner.classList.remove("is-visible");
  bonusBanner.setAttribute("aria-hidden", "true");

  clearInterval(spawnTimer);

  if (playing) {
    spawnTimer = setInterval(createObject, NORMAL_SPAWN_MS);
  }

  clearTimeout(bonusTimeEndTimer);
  bonusTimeEndTimer = null;

  window.playBonusTimeEndSound();
  window.startBgmNormal();

  if (playing) {
    scheduleNextBonusTime(false);
  }
}

function scheduleNextBonusTime(isFirst) {
  clearTimeout(bonusTimeStartTimer);

  const delay = isFirst
    ? randomBetween(BONUS_FIRST_DELAY_MIN_MS, BONUS_FIRST_DELAY_MAX_MS)
    : randomBetween(BONUS_INTERVAL_MIN_MS, BONUS_INTERVAL_MAX_MS);

  bonusTimeStartTimer = setTimeout(function () {
    if (playing) {
      startBonusTime();
    }
  }, delay);
}

// ===== ゲームループ =====
function update(currentTime) {
  if (!playing) return;

  const elapsedTime =
    Math.min((currentTime - previousTime) / 1000 || 0, 0.04);

  previousTime = currentTime;

  const playerRect = player.getBoundingClientRect();

  for (const object of objects) {
    if (object.removed) continue;

    object.y += object.speed * elapsedTime;
    object.element.style.transform = "translateY(" + object.y + "px)";

    const objectRect = object.element.getBoundingClientRect();

    if (objectsTouch(objectRect, playerRect)) {
      if (object.isBomb) {
        window.playBombSound();
        removeObject(object);
        finishGame("bomb");
        return;
      }

      score = Math.max(0, score + object.value);
      scoreElement.textContent = score;

      showPoints(objectRect.left, objectRect.top, object.value);

      if (object.value >= 3) {
        window.playBonusSound();
      }
      else {
        window.playNormalSound();
      }

      removeObject(object);
    }
    else if (objectRect.top > game.clientHeight + 20) {
      removeObject(object);
    }
  }

  objects = objects.filter(function (object) {
    return !object.removed;
  });

  animationId = requestAnimationFrame(update);
}

// ===== ランキング =====
function getRanking() {
  return fileRanking
    .map(function (record) {
      return {
        score: Math.max(0, Math.floor(Number(record.score) || 0)),
        name: String(record.name || "ななし").slice(0, 12),
        playedAt: String(record.playedAt || "")
      };
    })
    .sort(function (first, second) {
      return second.score - first.score;
    });
}

async function saveRanking(newScore) {
  setSyncStatus("ランキングへ保存中…", false);

  try {
    const user = signedInUser || await authReady;

    if (!user) {
      throw new Error("認証ユーザーを取得できませんでした。");
    }

    const scoreReference = ref(
      firebaseDatabase,
      "scores/" + user.uid
    );

    const currentSnapshot = await get(scoreReference);
    const currentRecord = currentSnapshot.val();
    const currentBest = currentRecord
      ? Number(currentRecord.score || 0)
      : -1;

    if (newScore <= currentBest) {
      setSyncStatus(
        "自己ベスト " + currentBest + "点を保持しました。",
        false
      );
      return;
    }

    await set(scoreReference, {
      name: currentPlayerName || "ななし",
      score: newScore,
      playedAt: new Date().toLocaleDateString("ja-JP"),
      updatedAt: Date.now()
    });

    setSyncStatus("共有ランキングへ保存しました。", false);
  }
  catch (error) {
    console.error("共有ランキングの保存に失敗しました。", error);
    setSyncStatus("スコアを保存できませんでした。", true);
  }
}

function renderRanking() {
  const ranking = getRanking();
  const medals = ["🥇", "🥈", "🥉"];

  rankingPodium.innerHTML = "";
  rankingList.innerHTML = "";

  for (let index = 0; index < 3; index += 1) {
    const record = ranking[index];
    const item = document.createElement("div");

    item.className =
      "podium-item" + (index === 0 ? " first" : "");

    const rank = document.createElement("span");
    rank.className = "podium-rank";
    rank.textContent = medals[index];

    const nameText = document.createElement("span");
    nameText.className = "podium-name";
    nameText.textContent = record ? record.name : "記録なし";

    const scoreText = document.createElement("span");
    scoreText.className = "podium-score";
    scoreText.textContent = record ? record.score + "点" : "---";

    const dateText = document.createElement("span");
    dateText.className = "podium-date";
    dateText.textContent = record ? record.playedAt : "記録なし";

    item.appendChild(rank);
    item.appendChild(nameText);
    item.appendChild(scoreText);
    item.appendChild(dateText);

    rankingPodium.appendChild(item);
  }

  if (ranking.length <= 3) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "ranking-empty";

    emptyItem.textContent =
      ranking.length === 0
        ? "まだ記録がありません"
        : "4位以下の記録はありません";

    rankingList.appendChild(emptyItem);
    return;
  }

  ranking.slice(3).forEach(function (record, offset) {
    const position = offset + 4;
    const item = document.createElement("li");

    const rankText = document.createElement("span");
    rankText.className = "ranking-number";
    rankText.textContent = position + "位";

    const playerText = document.createElement("span");
    playerText.className = "ranking-player";
    playerText.textContent = record.name;

    const scoreText = document.createElement("span");
    scoreText.className = "ranking-score";
    scoreText.textContent = record.score + "点";

    const dateText = document.createElement("span");
    dateText.className = "ranking-date";
    dateText.textContent = record.playedAt;

    item.appendChild(rankText);
    item.appendChild(playerText);
    item.appendChild(scoreText);
    item.appendChild(dateText);

    rankingList.appendChild(item);
  });
}

function closeRanking() {
  rankingArea.classList.remove("is-open");
  rankingArea.setAttribute("aria-hidden", "true");
  rankingButton.setAttribute("aria-expanded", "false");
}

function openRanking() {
  renderRanking();
  rankingList.scrollTop = 0;
  rankingArea.classList.add("is-open");
  rankingArea.setAttribute("aria-hidden", "false");
  rankingButton.setAttribute("aria-expanded", "true");
  rankingCloseButton.focus();
}

// ===== ゲーム開始・終了 =====
function startGame() {
  const enteredName = playerNameInput.value.trim();

  if (!enteredName) {
    nameError.style.display = "block";
    playerNameInput.focus();
    return;
  }

  currentPlayerName = enteredName.slice(0, 12);
  playerNameInput.value = currentPlayerName;

  nameError.style.display = "none";
  setSyncStatus("", false);

  try {
    localStorage.setItem("imageCatchPlayerName", currentPlayerName);
  }
  catch (error) {
    console.warn("プレイヤー名を保存できませんでした。", error);
  }

  clearInterval(spawnTimer);
  clearInterval(clockTimer);
  cancelAnimationFrame(animationId);

  for (const object of objects) {
    object.element.remove();
  }

  objects = [];
  score = 0;
  elapsedTime = 0;

  scoreElement.textContent = "0";
  timeElement.textContent = "0";
  player.style.left = "50%";

  startScreen.style.display = "none";
  endScreen.style.display = "none";
  closeRanking();

  rewardElement.textContent = "";
  messageElement.textContent = "";

  bonusTimeActive = false;
  clearTimeout(bonusTimeEndTimer);
  clearTimeout(bonusTimeStartTimer);
  bonusTimeEndTimer = null;
  bonusTimeStartTimer = null;

  bonusFlash.classList.remove("is-active");
  bonusBanner.classList.remove("is-visible");
  bonusBanner.setAttribute("aria-hidden", "true");

  playing = true;
  previousTime = performance.now();

  window.playStartSound();
  window.startBgmNormal();

  scheduleNextBonusTime(true);

  createObject();

  spawnTimer = setInterval(createObject, NORMAL_SPAWN_MS);

  clockTimer = setInterval(function () {
    if (!playing) return;

    elapsedTime += 1;
    timeElement.textContent = elapsedTime;
  }, 1000);

  animationId = requestAnimationFrame(update);
}

function finishGame(reason) {
  if (!playing) return;

  playing = false;

  clearInterval(spawnTimer);
  clearInterval(clockTimer);
  cancelAnimationFrame(animationId);

  bonusTimeActive = false;
  clearTimeout(bonusTimeEndTimer);
  clearTimeout(bonusTimeStartTimer);
  bonusTimeEndTimer = null;
  bonusTimeStartTimer = null;

  bonusFlash.classList.remove("is-active");
  bonusBanner.classList.remove("is-visible");
  bonusBanner.setAttribute("aria-hidden", "true");

  for (const object of objects) {
    object.element.remove();
  }

  objects = [];

  finalScoreElement.textContent = score + "点";

  let rewardData = {
    message: "ゲーム終了！",
    reward: "参加特典"
  };

  if (typeof window.getReward === "function") {
    const result = window.getReward(score);
    if (result) {
      rewardData = result;
    }
  }

  messageElement.textContent = rewardData.message;
  rewardElement.textContent = rewardData.reward;
  messageElement.style.display = "block";
  rewardElement.style.display = "block";

  if (reason !== "bomb") {
    window.playGameOverSound();
  }

  window.stopAllBgm();

  void saveRanking(score);
  closeRanking();

  endScreen.style.display = "flex";
}

function quitGame() {
  if (!playing) return;

  playing = false;

  clearInterval(spawnTimer);
  clearInterval(clockTimer);
  cancelAnimationFrame(animationId);

  bonusTimeActive = false;
  clearTimeout(bonusTimeEndTimer);
  clearTimeout(bonusTimeStartTimer);
  bonusTimeEndTimer = null;
  bonusTimeStartTimer = null;

  bonusFlash.classList.remove("is-active");
  bonusBanner.classList.remove("is-visible");
  bonusBanner.setAttribute("aria-hidden", "true");

  for (const object of objects) {
    object.element.remove();
  }

  objects = [];

  finalScoreElement.textContent = score + "点";

  messageElement.textContent = "ゲームを終了しました。";
  rewardElement.textContent = "途中終了";

  window.playQuitSound();
  window.stopAllBgm();

  void saveRanking(score);
  closeRanking();

  endScreen.style.display = "flex";
}

// ===== ミュート設定の初期化 =====
try {
  const savedSound = localStorage.getItem("imageCatchSound");
  if (savedSound === "off") {
    window.soundEnabled = false;
    soundToggle.setAttribute("aria-pressed", "false");
    soundToggle.textContent = "🔇";
  }
}
catch (error) {
  console.warn("音設定を読み込めませんでした。", error);
}

soundToggle.addEventListener("pointerdown", function (event) {
  event.stopPropagation();
});

soundToggle.addEventListener("pointermove", function (event) {
  event.stopPropagation();
});

soundToggle.addEventListener("click", function (event) {
  event.stopPropagation();

  window.soundEnabled = !window.soundEnabled;
  soundToggle.setAttribute("aria-pressed", String(window.soundEnabled));
  soundToggle.textContent = window.soundEnabled ? "🔊" : "🔇";

  if (window.soundEnabled) {
    if (playing) {
      if (bonusTimeActive) {
        window.startBgmBonus();
      }
      else {
        window.startBgmNormal();
      }
    }
    window.getAudioContext();
    window.playBeep(880, 0.10, "sine", 0.20, 0);
  }
  else {
    window.pauseAllBgm();
  }

  try {
    localStorage.setItem(
      "imageCatchSound",
      window.soundEnabled ? "on" : "off"
    );
  }
  catch (error) {
    console.warn("音設定を保存できませんでした。", error);
  }
});

// ===== 入力イベント =====
startButton.addEventListener("click", function () {
  window.getAudioContext();
  window.decodeBgmBuffers();
  startGame();
});

retryButton.addEventListener("click", function () {
  window.getAudioContext();
  window.decodeBgmBuffers();
  startGame();
});

quitButton.addEventListener("pointerdown", function (event) {
  event.stopPropagation();
});

quitButton.addEventListener("pointermove", function (event) {
  event.stopPropagation();
});

quitButton.addEventListener("click", function (event) {
  event.stopPropagation();
  quitGame();
});

rankingButton.addEventListener("click", openRanking);
rankingCloseButton.addEventListener("click", closeRanking);

rankingArea.addEventListener("click", function (event) {
  if (event.target === rankingArea) {
    closeRanking();
  }
});

rankingArea.addEventListener("pointerdown", function (event) {
  event.stopPropagation();
});

rankingArea.addEventListener("pointermove", function (event) {
  event.stopPropagation();
});

rankingArea.addEventListener(
  "touchmove",
  function (event) {
    event.stopPropagation();
  },
  { passive: true }
);

// ===== プレイヤー名の復元 =====
try {
  const savedPlayerName =
    localStorage.getItem("imageCatchPlayerName");

  if (savedPlayerName) {
    playerNameInput.value = savedPlayerName.slice(0, 12);
  }
}
catch (error) {
  console.warn("プレイヤー名を読み込めませんでした。", error);
}

playerNameInput.addEventListener("input", function () {
  if (playerNameInput.value.trim()) {
    nameError.style.display = "none";
  }
});

// ===== 初期化 =====
void initializeSharedRanking();
