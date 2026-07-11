# Ribbon — Markdown Editor

ブラウザだけで動く、オフライン対応（PWA）の Markdown エディターです。
ビルド不要の静的サイトなので、そのまま GitHub Pages で公開できます。

## 機能

- 左右分割のライブプレビュー（編集のみ／プレビューのみにも切替可）
- 見出し・太字・斜体・リスト・引用・リンク・画像・コードブロック・表の挿入ツールバー
- 文書はブラウザの localStorage に自動保存、複数文書を保存・切替・削除可能
- `.md` ファイルの読み込み／書き出し（対応ブラウザでは名前を付けて保存も可能）
- インストールしてホーム画面やデスクトップからアプリのように起動でき、オフラインでも動作
- ライト／ダーク表示切替

## GitHub Pages で公開する手順

1. このフォルダの中身を、公開したい GitHub リポジトリのルート（またはお好みのサブフォルダ）にそのままコピーします。
2. コミットして push します。

   ```bash
   git init
   git add .
   git commit -m "Add Ribbon markdown editor"
   git branch -M main
   git remote add origin https://github.com/<ユーザー名>/<リポジトリ名>.git
   git push -u origin main
   ```

3. GitHub のリポジトリページで **Settings → Pages** を開きます。
4. **Source** を「Deploy from a branch」にし、Branch を `main` / `/(root)` に設定して **Save**。
5. 数分待つと `https://<ユーザー名>.github.io/<リポジトリ名>/` で公開されます。

`index.html` 以下のパスはすべて相対パスで書かれているため、リポジトリ直下でもサブフォルダ配下でも、どちらでも問題なく動作します。

## 動作確認（ローカル）

Service Worker は `file://` では動かないため、ローカルで確認する場合は簡易サーバーを使ってください。

```bash
cd ribbon
python3 -m http.server 8080
# http://localhost:8080 を開く
```

## 更新時の注意

CSS や JS を変更したら、`sw.js` 内の `CACHE_VERSION` の値（例: `ribbon-v1` → `ribbon-v2`）を変更してください。バージョンを上げないと、インストール済みの利用者に更新が届かないことがあります。

## 構成

```
index.html          エントリーポイント
css/style.css        スタイル
js/app.js             エディター本体のロジック
js/vendor/            marked.js / DOMPurify（オフライン動作のため同梱）
manifest.json         PWA マニフェスト
sw.js                  Service Worker（オフラインキャッシュ）
icons/                 アプリアイコン一式
```

## 使用ライブラリ

- [marked](https://github.com/markedjs/marked) — Markdown → HTML 変換
- [DOMPurify](https://github.com/cure53/DOMPurify) — HTML のサニタイズ（XSS 対策）

いずれも `js/vendor/` にローカル同梱しているため、外部 CDN への通信なしで動作します。
