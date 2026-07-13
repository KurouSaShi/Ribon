# Ribbon プラグイン API リファレンス

Ribon のプラグインは、ハンバーガーメニュー内の「プラグインを追加」から選んだ
`.js` ファイルとして読み込まれます。読み込まれたファイルは、そのまま
`new Function('Ribbon', ソースコード)` という形で実行され、引数として
**`Ribbon` という名前のオブジェクト**が渡されます。プラグインはこの `Ribbon`
を通じてのみ、エディタ本体の機能を呼び出せます。

```js
// プラグインファイルの例（このファイル全体が Ribbon を受け取って実行される）
Ribbon.addCommand({
  id: 'hello',
  label: '👋',
  title: '挨拶を挿入',
  onTap: (Ribbon) => {
    Ribbon.editor.insertAtCursor('こんにちは！');
  },
});
```

> ⚠️ プラグインは通常のJavaScriptとしてそのまま実行されます。信頼できる
> 作成者のプラグインだけを追加してください。

---

## 目次

- [Ribbon.editor](#ribboneditor) — テキスト編集
- [Ribbon.network](#ribbonnetwork) — ネットワークアクセス
- [Ribbon.notes](#ribbonnotes) — メモ操作
- [Ribbon.dialog](#ribbondialog) — ダイアログ表示
- [Ribbon.storage](#ribbonstorage) — 永続ストレージ（プラグインごとに隔離）
- [Ribbon.progress](#ribbonprogress) — 進捗表示
- [Ribbon.addCommand](#ribbonaddcommand) — ツールバーへのボタン追加
- [Ribbon.toast](#ribbontoast) — 画面下部の短いメッセージ
- [Ribbon.on](#ribbonon) — イベント購読
- [Ribbon.version](#ribbonversion) — APIバージョン

---

## Ribbon.editor

現在開いているメモの本文（テキストエリア）を操作します。

| メソッド | 説明 |
|---|---|
| `getValue()` | 本文全体の文字列を取得する |
| `setValue(text)` | 本文全体を置き換える |
| `getSelection()` | `{ start, end, value }` を返す（選択範囲と本文全体） |
| `setSelection(start, end)` | カーソル位置・選択範囲を設定する |
| `insertAtCursor(text, cursorOffset?)` | カーソル位置にテキストを挿入する。`cursorOffset` を指定すると、挿入後のカーソル位置を挿入文字列内の任意の位置に置ける（省略時は挿入文字列の末尾） |
| `replaceRange(start, end, text)` | 指定範囲を `text` に置き換える |
| `wrapSelection(before, after, placeholder?)` | 選択範囲を `before`／`after` で挟む（**太字**やコードなど）。選択範囲が無い場合は `placeholder` を挿入して選択状態にする |
| `prefixLines(prefix)` | 選択している全行の先頭に `prefix` を付ける（見出しや箇条書きなど） |

```js
onTap: (Ribbon) => {
  const { start, end, value } = Ribbon.editor.getSelection();
  const selected = value.slice(start, end) || 'テキスト';
  Ribbon.editor.wrapSelection('==', '==', selected);
}
```

---

## Ribbon.network

`fetch` の薄いラッパーです。特別なドメイン制限などはありません
（プラグインは信頼できる作成者のものだけを追加する前提のため）。

| メソッド | 説明 |
|---|---|
| `fetch(url, options?)` | 素の `fetch` と同じ。`Response` オブジェクトを返す |
| `fetchText(url, options?)` | レスポンス本文を文字列として取得する（`Promise<string>`） |
| `fetchJSON(url, options?)` | レスポンス本文をJSONとしてパースして取得する（`Promise<any>`） |

```js
onTap: async (Ribbon) => {
  Ribbon.progress.show('取得中…');
  try {
    const data = await Ribbon.network.fetchJSON('https://api.example.com/quote');
    Ribbon.editor.insertAtCursor(data.text);
  } catch (err) {
    Ribbon.dialog.alert('取得に失敗しました: ' + err.message);
  } finally {
    Ribbon.progress.hide();
  }
}
```

---

## Ribbon.notes

| メソッド | 説明 |
|---|---|
| `createNew(content?)` | 新規メモを作成して開く（保存・一覧更新・編集タブへの切替まで行う）。`content` を渡すと、その内容であらかじめ本文を埋めた状態で作成する。作成された note オブジェクト（`{ id, title, content, ... }`）を返す |

```js
onTap: (Ribbon) => {
  Ribbon.notes.createNew('# 新しいメモ\n\n');
  Ribbon.toast('新規メモを作成しました');
}
```

---

## Ribbon.dialog

`window.alert` / `confirm` / `prompt` の代わりに使う、アプリ内蔵のモーダル
ダイアログです。いずれも **Promise を返す非同期API** です。同時に複数開こう
とした場合は自動的に順番待ち（キュー）になります。

| メソッド | 説明 | 戻り値 |
|---|---|---|
| `alert(message, title?)` | メッセージを表示し、OKを待つ | `Promise<void>` |
| `confirm(message, title?)` | OK／キャンセルを選ばせる | `Promise<boolean>`（OKなら `true`） |
| `prompt(message, defaultValue?, title?)` | 1行のテキスト入力を求める | `Promise<string \| null>`（キャンセルなら `null`） |

```js
onTap: async (Ribbon) => {
  const ok = await Ribbon.dialog.confirm('本文を全て消去しますか？', '確認');
  if (!ok) return;
  const name = await Ribbon.dialog.prompt('新しいタイトルを入力してください', '無題のメモ');
  if (name === null) return; // キャンセルされた
  Ribbon.editor.setValue(`# ${name}\n\n`);
}
```

---

## Ribbon.storage

プラグインごとに**完全に隔離された**永続ストレージです。あるプラグインが
保存したデータは、他のプラグインからは読み書きできません（内部的には
`ribbon:plugin-data:<プラグインID>:<キー>` という名前空間の
`localStorage` に保存されます）。

| メソッド | 説明 |
|---|---|
| `get(key, fallback?)` | 保存済みの値を取得する。未保存なら `fallback`（省略時 `null`）を返す |
| `set(key, value)` | 値を保存する（JSON化できる値なら何でも渡せる：オブジェクト・配列・数値など） |
| `remove(key)` | 指定したキーを削除する |
| `keys()` | このプラグインが保存しているキーの一覧を返す |
| `clear()` | このプラグインが保存した全データを削除する |

```js
onTap: (Ribbon) => {
  const count = Ribbon.storage.get('tapCount', 0);
  Ribbon.storage.set('tapCount', count + 1);
  Ribbon.toast(`このボタンは ${count + 1} 回押されました`);
}
```

---

## Ribbon.progress

時間のかかる処理（ネットワーク取得や大きな変換処理など）の進み具合を、
画面下部の固定バーで表示します。

| メソッド | 説明 |
|---|---|
| `show(message, percent?)` | 進捗バーを表示する。`percent`（0〜100）を省略すると不確定表示（左右に流れるアニメーション）になる |
| `update(percent?, message?)` | 進捗を更新する。どちらも省略可（片方だけ更新することもできる） |
| `hide()` | 進捗バーを閉じる |

```js
onTap: async (Ribbon) => {
  const items = ['a', 'b', 'c', 'd'];
  Ribbon.progress.show('処理中…', 0);
  for (let i = 0; i < items.length; i++) {
    await doSomething(items[i]);
    Ribbon.progress.update(((i + 1) / items.length) * 100);
  }
  Ribbon.progress.hide();
}
```

---

## Ribbon.addCommand

ツールバーの3段目（横スクロール行）にボタンを追加します。最初のコマンドが
登録された時点でその行が自動的に作られます。

```js
Ribbon.addCommand({
  id: 'my-plugin-hello',   // 必須：プラグイン内で一意なID
  label: '👋',              // 必須：ボタンに表示するテキスト
  title: '挨拶を挿入',       // 省略可：アクセシビリティ用ラベル
  onTap: (Ribbon) => { /* タップ時 */ },
  onLongPress: (Ribbon) => { /* 長押し時（省略可） */ },
});
```

`onTap` / `onLongPress` に渡される `Ribbon` は、そのプラグイン専用の
インスタンス（`Ribbon.storage` が隔離されたもの）です。関数の外側で
受け取った `Ribbon` と使い分ける必要はなく、常にコールバック引数の
`Ribbon` を使ってください。

---

## Ribbon.toast

画面下部に短いメッセージを表示します。

```js
Ribbon.toast('完了しました');
```

---

## Ribbon.on

エディタ内で発生するイベントを購読できます。現在対応しているイベントは
`'save'`（本文が変更され、自動保存がスケジュールされた時）のみです。

```js
Ribbon.on('save', () => {
  console.log('本文が更新されました');
});
```

---

## Ribbon.version

現在のAPIバージョンを表す文字列です（例: `'1.1'`）。プラグイン側で機能の
有無を判定したい場合に利用できます。

```js
if (Ribbon.version >= '1.1') {
  // network / dialog / storage / progress / notes.createNew が使える
}
```

---

## 更新履歴

- **1.1**：`network`・`notes.createNew`・`dialog`・`storage`（プラグインごとに隔離）・`progress` を追加
- **1.0**：`editor`・`addCommand`・`toast`・`on('save')`
