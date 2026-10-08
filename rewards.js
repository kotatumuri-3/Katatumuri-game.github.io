// ===== 報酬テーブル（グローバル） =====
const REWARDS = [
  { minScore: 1000, message: "天才☆", reward: "最優秀賞" },
  { minScore: 500, message: "今日ビジュいいじゃん☆", reward: "超優秀賞" },
  { minScore: 250, message: "めっちゃいいね☆", reward: "優秀賞" },
  { minScore: 100, message: "いい感じ！", reward: "有用賞" },
  { minScore: 30, message: "こういうときもあるよね", reward: "頑張ったで賞" },
  { minScore: 0, message: "もう一回挑戦しよう！", reward: "参加賞" }
];

function getReward(score) {
  return REWARDS.find(function (item) {
    return score >= item.minScore;
  });
}

// main.js（モジュール）から参照できるように公開
window.getReward = getReward;
