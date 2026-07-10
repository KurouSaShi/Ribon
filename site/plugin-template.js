/*
 * Ribbon プラグイン ひな型
 * ---------------------------------------------------------
 * このファイルをコピーして中身を書き換え、アプリの「メモ一覧」シート
 * 下部にある「プラグイン」→「＋ 追加」から .js ファイルとして
 * 読み込むと、ツールバーの3段目にコマンドとして追加されます。
 *
 * ⚠️ プラグインは通常の JavaScript としてアプリと同じ画面上でそのまま
 *    実行されます（サンドボックスされません）。自分で書いたものか、
 *    信頼できる作成者のものだけを読み込んでください。
 *
 * 読み込まれると、この関数の中身が1回だけ実行されます。
 * 引数の Ribbon がアプリ側から渡される公開APIです。
 * ---------------------------------------------------------
 */

// --- 1. コマンド（ツールバーのボタン）を追加する -----------------------
//
// id / label / onTap は必須。title はボタンの aria-label（長押しで
// 表示されるヒント用）、onLongPress は任意で長押し時の動作です。
Ribbon.addCommand({
  id: 'sample-timestamp',
  label: '🕒',                 // ボタンに表示される短いラベル
  title: '現在時刻を挿入',       // スクリーンリーダー等向けの説明
  onTap: (Ribbon) => {
    const now = new Date();
    const text = now.toLocaleString('ja-JP');
    Ribbon.editor.insertAtCursor(text, text.length);
    Ribbon.toast('時刻を挿入しました');
  },
  // 長押しで別の動作をさせたい場合はコメントを外してください
  // onLongPress: (Ribbon) => {
  //   Ribbon.toast('長押しされました');
  // },
});

// --- 2. もう一つ例：選択中のテキストを大文字にする ----------------------
Ribbon.addCommand({
  id: 'sample-uppercase',
  label: 'AA',
  title: '選択範囲を大文字にする',
  onTap: (Ribbon) => {
    const { start, end, value } = Ribbon.editor.getSelection();
    if (start === end) {
      Ribbon.toast('先にテキストを選択してください');
      return;
    }
    const upper = value.slice(start, end).toUpperCase();
    Ribbon.editor.replaceRange(start, end, upper);
    Ribbon.editor.setSelection(start, start + upper.length);
  },
});

// --- 3. 既存ボタンの位置・見た目・動作を変更する ------------------------
//
// 例：太字ボタンをコピー行の先頭に移動し、見た目とタップ時の動作を変える。
// Ribbon.toolbar.moveButton('boldBtn', { row: 2 });
// Ribbon.toolbar.setLabel('boldBtn', '💪');
// Ribbon.toolbar.setStyle('boldBtn', { color: '#B3402C' });
// Ribbon.toolbar.setHandlers('boldBtn', {
//   onTap: (Ribbon) => Ribbon.toast('カスタムの太字ボタンです'),
// });
// 元に戻したいときは：
// Ribbon.toolbar.resetAppearance('boldBtn');
// Ribbon.toolbar.resetHandlers('boldBtn');

/*
 * ---------------------------------------------------------
 * 使用できる Ribbon API 一覧
 * ---------------------------------------------------------
 *
 * Ribbon.editor.getValue(): string
 *   現在のメモの全文を取得する。
 *
 * Ribbon.editor.setValue(text: string): void
 *   現在のメモの全文を書き換える（自動保存・プレビュー更新・
 *   元に戻す履歴への記録も行われる）。
 *
 * Ribbon.editor.getSelection(): { start, end, value }
 *   カーソル位置・選択範囲・現在の全文を取得する。
 *
 * Ribbon.editor.setSelection(start: number, end: number): void
 *   カーソル位置／選択範囲を設定する。
 *
 * Ribbon.editor.insertAtCursor(text: string, cursorOffset?: number): void
 *   カーソル位置にテキストを挿入する。cursorOffset を指定すると、
 *   挿入後のカーソルを「挿入開始位置 + cursorOffset」に移動する
 *   （省略時は挿入したテキストの末尾）。
 *
 * Ribbon.editor.replaceRange(start: number, end: number, text: string): void
 *   value の start〜end を text に置き換える。
 *
 * Ribbon.editor.wrapSelection(before: string, after?: string, placeholder?: string): void
 *   選択範囲を before/after で囲む（**太字** のような記法向け）。
 *   選択がない場合は placeholder を挟んで挿入する。
 *
 * Ribbon.editor.prefixLines(prefix: string): void
 *   カーソルがある行（複数行選択時はその全行）の先頭に prefix を付与する
 *   （見出しや箇条書きのような行頭記法向け）。
 *
 * Ribbon.addCommand({ id, label, title?, onTap, onLongPress? }): HTMLButtonElement
 *   ツールバー3段目にボタンを追加する。追加したボタンも Ribbon.toolbar の
 *   対象になる（あとから移動・見た目変更・動作変更ができる）。
 *
 * Ribbon.toolbar
 *   既存ボタン（コアのショートカットも、他プラグインが追加したボタンも）
 *   をあとから操作するための API。すべて対象ボタンの id を第一引数に取る。
 *
 *   Ribbon.toolbar.listButtons(): string[]
 *     登録されているボタンの id 一覧を返す。コアのボタン id は以下の通り：
 *     hBtn, boldBtn, italicBtn, strikeBtn, codeBtn, ulBtn, olBtn, quoteBtn,
 *     hrBtn, linkBtn, imageBtn, codeblockBtn, tableBtn, tabBtn（字下げ）,
 *     pasteBtn, copyBtn, cutBtn, undoBtn, redoBtn,
 *     moveLeftBtn, moveRightBtn（カーソル移動）,
 *     cursorLeftBtn, cursorRightBtn（選択を広げる）, statsBtn（文字数／語数）
 *
 *   Ribbon.toolbar.getButton(id): { id, label, title, disabled, hidden } | null
 *     ボタンの現在の状態を取得する。
 *
 *   Ribbon.toolbar.setLabel(id, html): void
 *     表示ラベルを変更する（HTML可）。
 *
 *   Ribbon.toolbar.setTitle(id, title): void
 *     aria-label（長押しヒント等）を変更する。
 *
 *   Ribbon.toolbar.setStyle(id, styles): void
 *     インラインCSSを追加・上書きする。例: { color: '#fff' }
 *
 *   Ribbon.toolbar.setClass(id, className, on = true): void
 *     クラス名を付け外しする。
 *
 *   Ribbon.toolbar.setDisabled(id, disabled = true): void
 *     ボタンの有効／無効を切り替える。
 *
 *   Ribbon.toolbar.setHidden(id, hidden = true): void
 *     ボタンの表示／非表示を切り替える。
 *
 *   Ribbon.toolbar.resetAppearance(id): void
 *     ラベル・aria-label・クラス名・インラインCSSを初期状態に戻す。
 *
 *   Ribbon.toolbar.setHandlers(id, { onTap, onLongPress? }): void
 *     タップ／長押しの動作を丸ごと差し替える。onTap は必須。
 *     onLongPress を省略すると、見出しレベル選択などコアの長押し機能が
 *     あったボタンでも「長押しなし」になる点に注意。
 *
 *   Ribbon.toolbar.resetHandlers(id): void
 *     タップ／長押しの動作を初期状態に戻す。
 *
 *   Ribbon.toolbar.moveButton(id, target): void
 *     ボタンの位置を変更する。target には次のいずれかを指定する：
 *       { before: '他のボタンid' } … そのボタンの直前に移動
 *       { after: '他のボタンid' }  … そのボタンの直後に移動
 *       { row: 1 | 2 | 3 | 'left-top' | 'left-bottom'
 *             | 'right-top' | 'right-bottom' }
 *         … 1=上段（記法ショートカット） 2=下段（コピー・貼り付け等）
 *           3=プラグイン専用行
 *           left-top/left-bottom=左端固定（カーソル移動／元に戻す・やり直し）
 *           right-top/right-bottom=右端固定（文字数／選択を広げる矢印）
 *
 *   Ribbon.toolbar.removeButton(id): void
 *     ボタンをツールバーから完全に取り除く。undo/redo など機能に直結する
 *     ボタンを消すとその機能が使えなくなるため注意すること。
 *
 * Ribbon.toast(message: string): void
 *   画面下部に短いメッセージを表示する。
 *
 * Ribbon.on(event: string, handler: Function): void
 *   将来的なイベント購読用のフック（現バージョンでは予約のみ）。
 *
 * ---------------------------------------------------------
 * 注意点
 * ---------------------------------------------------------
 * ・プラグインの追加・削除・有効/無効の切り替えは「メモ一覧」シート
 *   下部の「プラグイン」セクションから行います。
 * ・無効化や削除でツールバーに追加されたボタンがすぐには消えない
 *   場合があります。反映にはアプリの再読み込みが必要です。
 * ・プラグインのソースコードは端末内の localStorage にのみ保存され、
 *   外部には送信されません。
 * ・Ribbon.toolbar で他のボタン（他プラグイン含む）を書き換えた場合、
 *   読み込み順によっては後から読み込まれたプラグインの変更が優先されます。
 */
