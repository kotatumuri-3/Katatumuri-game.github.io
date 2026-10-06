const REWARDS = [
  {
    minScore: 30,
    message:
      "最高記録クラスです！",
    reward:
      "ゴールド特典"
  },
  {
    minScore: 18,
    message:
      "すばらしい記録です！",
    reward:
      "シルバー特典"
  },
  {
    minScore: 8,
    message:
      "いい調子です！",
    reward:
      "ブロンズ特典"
  },
  {
    minScore: 0,
    message:
      "もう一度挑戦してみよう！",
    reward:
      "参加特典"
  }
];

function getReward(score) {
  return REWARDS.find(
    function (reward) {
      return (
        score >=
        reward.minScore
      );
    }
  );
}
