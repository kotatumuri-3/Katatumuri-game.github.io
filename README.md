# かたつむりゲーム☆

GitHub Pages向けの静的ゲームです。

## 必要なファイル

- `index.html`
- `scores.json`
- `rewards.js`
- `player.png`
- `target.png`
- `bonus.png`
- `bomb.png`
- `.nojekyll`

画像4点は元のゲームで使用しているファイルを追加してください。

## 基準ランキングの編集

`scores.json`を編集します。

```json
[
  { "score": 50, "playedAt": "2026/10/08" },
  { "score": 25, "playedAt": "2026/10/07" }
]
```

JSONでは最後の項目の後ろにカンマを付けないでください。公開ページは`fetch()`で`scores.json`を読み込みます。

## 保存仕様

- `scores.json`: GitHub上で管理する基準ランキング
- `localStorage`: 各ブラウザーでプレイして獲得した記録
- 表示時に両方を統合し、上位10件を表示

GitHub Pagesは静的ホスティングのため、ゲームから`scores.json`へ直接書き戻すことはできません。全利用者のスコアを共有・自動保存するには、別途APIとデータベースが必要です。
