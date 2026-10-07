const REWARDS = [
  {
    minScore: 55,
    message:
      "めっちゃいいね☆",
    reward:
      "優秀賞"
  },
  {
    minScore: 30,
    message:
      "いい感じ！",
    reward:
      "有用賞"
  },
  {
    minScore: 15,
    message:
      "こうゆうときもあるよね",
    reward:
      "頑張ったで賞"
  },
  {
    minScore: 0,
    message:
      "もう一回挑戦しよう！",
    reward:
      "参加賞"
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
