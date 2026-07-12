// editor-ops.js — テキストエリアへの実際の読み書きを行う中核モジュール。
// メモの保存（storage.js）やUI配線（toolbar.js）には関与せず、
// 代わりに onChange() で購読できる変更通知だけを発行する。

import { editorEl, previewEl, undoBtn, redoBtn, statsValueEl, headingCountEl, boldBtn, italicBtn, strikeBtn } from './dom.js';
import { toast } from './toast.js';

/* ------------------------------------------------------------------ */
/* 変更通知（自動保存などが購読する）                                     */
/* ------------------------------------------------------------------ */

const changeListeners = [];
export function onChange(fn) { changeListeners.push(fn); }
function notifyChange() { changeListeners.forEach((fn) => fn()); }

const resetListeners = [];
export function onReset(fn) { resetListeners.push(fn); }
function notifyReset() { resetListeners.forEach((fn) => fn()); }

/* ------------------------------------------------------------------ */
/* プレビュー描画                                                        */
/* ------------------------------------------------------------------ */

export function renderPreview() {
  const raw = editorEl.value;
  if (!raw.trim()) {
    previewEl.innerHTML = '<p class="preview-empty">プレビューがここに表示されます…</p>';
    return;
  }
  previewEl.innerHTML = DOMPurify.sanitize(marked.parse(raw));
}

let renderTimer = null;
export function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderPreview, 120);
}

/* ------------------------------------------------------------------ */
/* 文字数／語数／見出し数の表示（キーボード右上）                          */
/* ------------------------------------------------------------------ */

let statsMode = 'chars'; // 'chars' | 'lines'

function countChars(text) {
  return text.replace(/\n/g, '').length;
}

function countLines(text) {
  return text.length ? text.split('\n').length : 0;
}

function countHeadings(text) {
  let count = 0;
  let inFence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    if (/^#{1,6}\s/.test(line)) count++;
  }
  return count;
}

export function updateStats() {
  const text = editorEl.value;
  statsValueEl.textContent = statsMode === 'chars' ? `${countChars(text)}文字` : `${countLines(text)}行`;
  headingCountEl.textContent = `見出し ${countHeadings(text)}`;
}

export function toggleStatsMode() {
  statsMode = statsMode === 'chars' ? 'lines' : 'chars';
  updateStats();
}

/* ------------------------------------------------------------------ */
/* 元に戻す／やり直し（このメモ内でのみ有効な履歴）                       */
/* ------------------------------------------------------------------ */

const history = { stack: [], index: -1, timer: null };
const HISTORY_LIMIT = 200;
const HISTORY_DEBOUNCE = 500;

function snapshot() {
  return { value: editorEl.value, start: editorEl.selectionStart, end: editorEl.selectionEnd };
}

export function resetHistory(content) {
  history.stack = [{ value: content, start: 0, end: 0 }];
  history.index = 0;
  clearTimeout(history.timer);
  history.timer = null;
  updateHistoryButtons();
}

function pushHistory() {
  clearTimeout(history.timer);
  history.timer = null;
  const cur = snapshot();
  const last = history.stack[history.index];
  if (last && last.value === cur.value) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(cur);
  if (history.stack.length > HISTORY_LIMIT) history.stack.shift();
  history.index = history.stack.length - 1;
  updateHistoryButtons();
}

function scheduleHistoryPush() {
  clearTimeout(history.timer);
  history.timer = setTimeout(pushHistory, HISTORY_DEBOUNCE);
}

function updateHistoryButtons() {
  undoBtn.disabled = history.index <= 0;
  redoBtn.disabled = history.index >= history.stack.length - 1;
}

function applyHistoryState(state) {
  editorEl.value = state.value;
  editorEl.focus();
  editorEl.setSelectionRange(state.start, state.end);
  scheduleRender();
  notifyChange();
  updateHistoryButtons();
  updateStats();
}

export function undo() {
  if (history.timer) pushHistory(); // 直前の入力を確定してから戻す
  if (history.index > 0) {
    history.index--;
    applyHistoryState(history.stack[history.index]);
  }
}

export function redo() {
  if (history.index < history.stack.length - 1) {
    history.index++;
    applyHistoryState(history.stack[history.index]);
  }
}

editorEl.addEventListener('input', () => {
  notifyChange();
  scheduleRender();
  scheduleHistoryPush();
  updateStats();
});

/* ------------------------------------------------------------------ */
/* Enterキー：箇条書き（- ）／番号付きリスト（1. ）の継続                 */
/* リスト行でEnterを押すと、同じ字下げ・マーカー（番号は+1）を付けた       */
/* 新しい行を挿入する。マーカーの後ろが空のままEnterを押す（＝2回連続で    */
/* 改行する）とマーカーを取り除いてリストから抜ける。                    */
/* ------------------------------------------------------------------ */

const ulLineRe = /^(\s*)-\s(.*)$/;
const olLineRe = /^(\s*)(\d+)\.\s(.*)$/;

editorEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = editorEl;
  if (el.selectionStart !== el.selectionEnd) return; // 選択範囲がある場合は既定動作に任せる

  const { value } = el;
  const pos = el.selectionStart;
  const lineStart = value.lastIndexOf('\n', pos - 1) + 1;
  const beforeCursor = value.slice(lineStart, pos);

  const ulMatch = beforeCursor.match(ulLineRe);
  const olMatch = beforeCursor.match(olLineRe);
  if (!ulMatch && !olMatch) return; // 箇条書き／番号付きリストの行でなければ既定動作

  e.preventDefault();

  if (ulMatch) {
    const [, indent, content] = ulMatch;
    if (content.trim() === '') {
      // 空の項目でEnter（2回目の改行）：マーカーを取り除いてリストから抜ける
      replaceRange(lineStart, pos, indent);
      const cursorPos = lineStart + indent.length;
      setSelection(cursorPos, cursorPos);
      return;
    }
    const insertText = '\n' + indent + '- ';
    replaceRange(pos, pos, insertText);
    const cursorPos = pos + insertText.length;
    setSelection(cursorPos, cursorPos);
    return;
  }

  const [, indent, num, content] = olMatch;
  if (content.trim() === '') {
    replaceRange(lineStart, pos, indent);
    const cursorPos = lineStart + indent.length;
    setSelection(cursorPos, cursorPos);
    return;
  }
  const nextNum = parseInt(num, 10) + 1;
  const insertText = '\n' + indent + nextNum + '. ';
  replaceRange(pos, pos, insertText);
  const cursorPos = pos + insertText.length;
  setSelection(cursorPos, cursorPos);
});

/* ------------------------------------------------------------------ */
/* カーソル移動（← →）／選択範囲を広げる（← →）                        */
/* ------------------------------------------------------------------ */

export function moveCursor(delta) {
  const el = editorEl;
  el.focus();
  let pos;
  if (el.selectionStart !== el.selectionEnd) {
    pos = delta < 0 ? el.selectionStart : el.selectionEnd;
  } else {
    pos = el.selectionStart + delta;
  }
  pos = Math.max(0, Math.min(el.value.length, pos));
  el.setSelectionRange(pos, pos);
}

// 押すたびに現在位置から1文字ずつ選択範囲を広げる。
// すでにある選択方向（前方／後方）を尊重し、逆方向に押すと縮む。
export function extendSelection(delta) {
  const el = editorEl;
  el.focus();
  let { selectionStart: s, selectionEnd: e, selectionDirection: dir } = el;
  const len = el.value.length;
  if (s === e) {
    if (delta > 0) { e = Math.min(len, e + 1); dir = 'forward'; }
    else { s = Math.max(0, s - 1); dir = 'backward'; }
  } else if (dir === 'backward') {
    if (delta < 0) s = Math.max(0, s - 1);
    else s = Math.min(e, s + 1);
  } else {
    if (delta > 0) e = Math.min(len, e + 1);
    else e = Math.max(s, e - 1);
    dir = 'forward';
  }
  el.setSelectionRange(s, e, dir);
}

/* ------------------------------------------------------------------ */
/* 記法ショートカット：低レベル編集操作                                   */
/* ------------------------------------------------------------------ */

export function getSelection() {
  return { start: editorEl.selectionStart, end: editorEl.selectionEnd, value: editorEl.value };
}
export function setSelection(start, end) {
  editorEl.focus();
  editorEl.setSelectionRange(start, end);
}
export function replaceRange(start, end, text) {
  const { value } = getSelection();
  editorEl.value = value.slice(0, start) + text + value.slice(end);
  notifyChange();
  scheduleRender();
  pushHistory(); // ツールバー操作は1回の確定した履歴として記録する
  updateStats();
}
export function wrapSelection(before, after = before, placeholder = '') {
  const { start, end, value } = getSelection();
  const selected = value.slice(start, end) || placeholder;
  replaceRange(start, end, before + selected + after);
  const cursorStart = start + before.length;
  setSelection(cursorStart, cursorStart + selected.length);
}
// 行頭に記号を付与する（見出し／箇条書き／引用など）。
// 挿入後は行全体を選択状態にせず、カーソルを末尾に置く。
// 対象行が空行だけの場合は記号のうしろの空白を残し、続けて入力できるようにする。
export function prefixLines(prefix) {
  const { start, end, value } = getSelection();
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const isSingleEmptyLine = lines.length === 1 && lines[0] === '';
  const newLines = lines.map((l) => {
    if (l) return prefix + l;
    return isSingleEmptyLine ? prefix : prefix.trimEnd();
  });
  const newBlock = newLines.join('\n');
  replaceRange(lineStart, lineEnd, newBlock);
  const cursorPos = lineStart + newBlock.length;
  setSelection(cursorPos, cursorPos);
}
export function insertAtCursor(text, cursorOffset) {
  const { start } = getSelection();
  replaceRange(start, start, text);
  const pos = start + (cursorOffset ?? text.length);
  setSelection(pos, pos);
}
const numberedListRe = /^\d+\.\s/;
export function toggleOrderedList() {
  const { start, end, value } = getSelection();
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const isSingleEmptyLine = lines.length === 1 && lines[0] === '';
  const newLines = lines.map((l, i) => {
    if (l) return `${i + 1}. ${l.replace(numberedListRe, '')}`;
    return isSingleEmptyLine ? `${i + 1}. ` : l;
  });
  const newBlock = newLines.join('\n');
  replaceRange(lineStart, lineEnd, newBlock);
  const cursorPos = lineStart + newBlock.length;
  setSelection(cursorPos, cursorPos);
}
export function wrapSelectionLink() {
  const { start, end, value } = getSelection();
  const selected = value.slice(start, end);
  if (selected) {
    replaceRange(start, end, `[${selected}](URL)`);
    const urlStart = start + selected.length + 3;
    setSelection(urlStart, urlStart + 3);
  } else {
    insertAtCursor('[リンクテキスト](URL)', 1);
  }
}
// 箇条書き／番号付きリストの字下げ・字上げ・通常化（行頭の半角スペースを調整）
// ※ Tab（⇥）ボタン用：既存の行そのものを書き換える。
export function applyListIndent(action) {
  const { start, end, value } = getSelection();
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', end);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  const newLines = lines.map((l) => {
    const leadingMatch = l.match(/^ */);
    let leading = leadingMatch ? leadingMatch[0].length : 0;
    const rest = l.slice(leading);
    if (action === 'indent') leading += 2;
    else if (action === 'outdent') leading = Math.max(0, leading - 2);
    else leading = 0;
    return ' '.repeat(leading) + rest;
  });
  const newBlock = newLines.join('\n');
  replaceRange(lineStart, lineEnd, newBlock);
  const cursorPos = lineStart + newBlock.length;
  setSelection(cursorPos, cursorPos);
}
// 箇条書き／番号付きリスト用：既存行は変更せず、字下げ／字上げした
// 新しい項目を現在行の直後に挿入する（ul/ol の長押しメニュー用）。
export function insertIndentedListItem(marker, action) {
  const { start, value } = getSelection();
  let lineStart = value.lastIndexOf('\n', start - 1) + 1;
  let lineEnd = value.indexOf('\n', start);
  if (lineEnd === -1) lineEnd = value.length;
  const currentLine = value.slice(lineStart, lineEnd);
  const leadingMatch = currentLine.match(/^ */);
  let leading = leadingMatch ? leadingMatch[0].length : 0;
  if (action === 'indent') leading += 2;
  else if (action === 'outdent') leading = Math.max(0, leading - 2);
  const prefix = ' '.repeat(leading) + marker;
  const insertText = '\n' + prefix;
  replaceRange(lineEnd, lineEnd, insertText);
  const cursorPos = lineEnd + insertText.length;
  setSelection(cursorPos, cursorPos);
}
export function buildTableMarkdown(rows, cols, header) {
  const sepRow = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const headerRow = '| ' + Array.from({ length: cols }, (_, c) => (header ? `見出し${c + 1}` : ' ')).join(' | ') + ' |';
  const bodyRows = Array.from({ length: rows }, () => '| ' + Array.from({ length: cols }, () => ' ').join(' | ') + ' |');
  return '\n' + [headerRow, sepRow, ...bodyRows].join('\n') + '\n';
}
export function insertTable(rows, cols, header) {
  insertAtCursor(buildTableMarkdown(rows, cols, header), 1);
}

/* ------------------------------------------------------------------ */
/* 貼り付け／コピー／切り取り                                            */
/* ------------------------------------------------------------------ */

export async function doPaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { toast('クリップボードが空です'); return; }
    const { start, end } = getSelection();
    replaceRange(start, end, text);
    const pos = start + text.length;
    setSelection(pos, pos);
  } catch (err) {
    toast('貼り付けを許可してください');
  }
}

export async function doCopy() {
  const { start, end, value } = getSelection();
  const text = start !== end ? value.slice(start, end) : value;
  try {
    await navigator.clipboard.writeText(text);
    toast(start !== end ? 'コピーしました' : 'メモ全体をコピーしました');
  } catch (err) {
    toast('コピーに失敗しました');
  }
}

export async function doCut() {
  const { start, end, value } = getSelection();
  if (start === end) { toast('選択範囲がありません'); return; }
  const text = value.slice(start, end);
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    toast('コピーに失敗しました');
    return;
  }
  replaceRange(start, end, '');
  setSelection(start, start);
  toast('切り取りました');
}

/* ------------------------------------------------------------------ */
/* B／I／S：長押しで開始位置を記録 → 入力後もう一度長押しでその区間を装飾 */
/* ------------------------------------------------------------------ */

const WRAP_MARK = { bold: '**', italic: '*', strike: '~~' };
const WRAP_BTN = { bold: () => boldBtn, italic: () => italicBtn, strike: () => strikeBtn };
const WRAP_LABEL = { bold: '太字', italic: '斜体', strike: '取り消し線' };
let wrapArm = { bold: null, italic: null, strike: null };

export function resetWrapArm() {
  Object.keys(wrapArm).forEach((type) => {
    wrapArm[type] = null;
    const btn = WRAP_BTN[type]();
    if (btn) btn.classList.remove('armed');
  });
}

export function toggleWrapArm(type) {
  const btn = WRAP_BTN[type]();
  if (wrapArm[type] === null) {
    wrapArm[type] = editorEl.selectionStart;
    btn.classList.add('armed');
    toast(`${WRAP_LABEL[type]}の開始位置を設定しました`);
    editorEl.focus();
    return;
  }
  let start = wrapArm[type];
  let end = editorEl.selectionStart;
  wrapArm[type] = null;
  btn.classList.remove('armed');
  if (start === end) { toast('文字が入力されていません'); return; }
  if (end < start) { const t = start; start = end; end = t; }
  const marker = WRAP_MARK[type];
  const inner = editorEl.value.slice(start, end);
  replaceRange(start, end, marker + inner + marker);
  const cursor = start + marker.length + inner.length + marker.length;
  setSelection(cursor, cursor);
}

/* ------------------------------------------------------------------ */
/* メモ切替時のリセット（履歴・武装状態は前のメモの続きを引きずらない）    */
/* ------------------------------------------------------------------ */

export function loadContentIntoEditor(content) {
  editorEl.value = content;
  resetHistory(content);
  resetWrapArm();
  renderPreview();
  updateStats();
  notifyReset();
}
