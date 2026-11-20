# BLIND TIMER // SABOTAGE EDITION

GitHub Pages でそのまま公開・プレイできる、体内時計×複合妨害アクションゲームです。

## 主な特徴
1. **常時ループシンセBGM＆BGMテンポ暴走ギミック**
   - Web Audio API による常時再生アルペジオ＆ベースBGMを搭載。
   - 妨害トラップ発動時には、BGM自体が突然超高速（トランスBPM）または超スローテンポに暴走し、体内時計を狂わせます。
2. **複合妨害トラップ（全10種）**
   - 偽STOPボタン増殖トラップ、画面上下反転＆グリッチノイズ、偽タイムアップ完了音、緊急警報サイレン、逃げ回るSTOPスイッチ、嘘カウントダウンなどが複合発生します。
3. **確実なリザルト表示＆結果スクリーンショットのLINE共有**
   - `LIMIT SURVIVAL` クリア時も必ずリザルト画面で結果・誤差・ランクを表示してから「NEXT STAGE へ進む」ボタンで次へ進みます。
   - リザルト結果を高精細PNGカード画像としてリアルタイム生成し、スマホの共有シートからLINEへ直接画像送信、またはPCでの画像保存＋LINE共有が可能です。

## GitHub Pages での公開方法
1. このフォルダ内の `index.html`, `style.css`, `game.js`, `README.md` を GitHub リポジトリのルートにアップロード（Push）します。
2. リポジトリの **Settings** > **Pages** を開きます。
3. **Build and deployment** の **Source** で `Deploy from a branch` を選択し、ブランチ（`main` / `/ (root)`）を指定して **Save** を押すと公開URLが発行されます。
