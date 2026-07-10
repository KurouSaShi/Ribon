(() => {
  'use strict';

  marked.setOptions({ breaks: true, gfm: true });

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const appEl = $('#app');
  const editorEl = $('#editor');
  const previewEl = $('#preview');
  const workspaceEl = $('#workspace');
  const toastEl = $('#toast');
  const tabIndicator = $('#tabIndicator');
  const noteItemsEl = $('#noteItems');
  const undoBtn = $('#undoBtn');
  const redoBtn = $('#redoBtn');
  const statsBtn = $('#statsBtn');
  const statsValueEl = $('#statsValue');
  const headingCountEl = $('#headingCountEl');
  const pressMenuEl = $('#pressMenu');
  const tablePanelEl = $('#tablePanel');
  const pressOverlayEl = $('#pressOverlay');
  const boldBtn = $('#boldBtn');
  const italicBtn = $('#italicBtn');
  const strikeBtn = $('#strikeBtn');
  const ulBtn = $('#ulBtn');
  const olBtn = $('#olBtn');
  const tabBtn = $('#tabBtn');
  const pluginItemsEl = $('#pluginItems');
  const addPluginBtn = $('#addPluginBtn');
  const pluginFileInput = $('#pluginFileInput');

  /* ------------------------------------------------------------------ */
  /* 保存先について：
     Cookie はメモの保存には向かない（1件あたり約4KBまでという容量制限が
     あり、リクエストのたびにサーバーへ送信されてしまう）。
     ブラウザ内で複数メモをまとめて保存するには localStorage の方が
     適しているため、ここでは localStorage を使用する。
     ------------------------------------------------------------------ */

  const STORAGE_PREFIX = 'ribbon:note:';
  const STORAGE_INDEX = 'ribbon:index';
  const STORAGE_CURRENT = 'ribbon:current';

  function loadIndex() {
    try { return JSON.parse(localStorage.getItem(STORAGE_INDEX)) || []; }
    catch { return []; }
  }
  function saveIndex(index) { localStorage.setItem(STORAGE_INDEX, JSON.stringify(index)); }
  function uid() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function loadNote(id) {
    try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + id)); }
    catch { return null; }
  }

  function titleFromContent(content) {
    const firstLine = (content || '').split('\n').find((l) => l.trim().length > 0) || '';
    return firstLine.replace(/^#+\s*/, '').trim().slice(0, 40) || '無題のメモ';
  }

  function saveNote(note) {
    note.title = titleFromContent(note.content);
    localStorage.setItem(STORAGE_PREFIX + note.id, JSON.stringify(note));
    const index = loadIndex();
    const entry = index.find((n) => n.id === note.id);
    const meta = { id: note.id, title: note.title, updatedAt: note.updatedAt };
    if (entry) Object.assign(entry, meta);
    else index.unshift(meta);
    index.sort((a, b) => b.updatedAt - a.updatedAt);
    saveIndex(index);
  }

  function deleteNote(id) {
    localStorage.removeItem(STORAGE_PREFIX + id);
    saveIndex(loadIndex().filter((n) => n.id !== id));
  }

  function newNoteObject() {
    const now = Date.now();
    return { id: uid(), title: '無題のメモ', content: '', createdAt: now, updatedAt: now };
  }

  let currentNote = null;
  let dirty = false;
  let saveTimer = null;

  function scheduleSave() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(doSave, 400);
  }

  function doSave() {
    if (!currentNote) return;
    currentNote.content = editorEl.value;
    currentNote.updatedAt = Date.now();
    saveNote(currentNote);
    dirty = false;
    renderNoteList();
  }

  window.addEventListener('beforeunload', () => { if (dirty) doSave(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty) doSave();
  });

  /* ------------------------------------------------------------------ */
  /* toast                                                                */
  /* ------------------------------------------------------------------ */

  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  /* ------------------------------------------------------------------ */
  /* render                                                               */
  /* ------------------------------------------------------------------ */

  function renderPreview() {
    const raw = editorEl.value;
    if (!raw.trim()) {
      previewEl.innerHTML = '<p class="preview-empty">プレビューがここに表示されます…</p>';
      return;
    }
    previewEl.innerHTML = DOMPurify.sanitize(marked.parse(raw));
  }

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderPreview, 120);
  }

  /* ------------------------------------------------------------------ */
  /* 文字数／語数／見出し数の表示（キーボード左上）                          */
  /* ------------------------------------------------------------------ */

  let statsMode = 'chars'; // 'chars' | 'words'

  function countCharsAndWords(text) {
    const charCount = text.replace(/\n/g, '').length;
    const trimmed = text.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
    return { charCount, wordCount };
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

  function updateStats() {
    const { charCount, wordCount } = countCharsAndWords(editorEl.value);
    statsValueEl.textContent = statsMode === 'chars' ? `${charCount}文字` : `${wordCount}語`;
    headingCountEl.textContent = `見出し ${countHeadings(editorEl.value)}`;
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

  function resetHistory(content) {
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
    scheduleSave();
    updateHistoryButtons();
    updateStats();
  }

  function undo() {
    if (history.timer) pushHistory(); // 直前の入力を確定してから戻す
    if (history.index > 0) {
      history.index--;
      applyHistoryState(history.stack[history.index]);
    }
  }

  function redo() {
    if (history.index < history.stack.length - 1) {
      history.index++;
      applyHistoryState(history.stack[history.index]);
    }
  }

  editorEl.addEventListener('input', () => {
    scheduleSave();
    scheduleRender();
    scheduleHistoryPush();
    updateStats();
  });

  /* ------------------------------------------------------------------ */
  /* カーソル移動（← →）                                                 */
  /* ------------------------------------------------------------------ */

  function moveCursor(delta) {
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

  // 右下の←→：押すたびに現在位置から1文字ずつ選択範囲を広げる。
  // すでにある選択方向（前方／後方）を尊重し、逆方向に押すと縮む。
  function extendSelection(delta) {
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
  /* 記法ショートカット                                                    */
  /* ------------------------------------------------------------------ */

  function getSelection() {
    return { start: editorEl.selectionStart, end: editorEl.selectionEnd, value: editorEl.value };
  }
  function setSelection(start, end) {
    editorEl.focus();
    editorEl.setSelectionRange(start, end);
  }
  function replaceRange(start, end, text) {
    const { value } = getSelection();
    editorEl.value = value.slice(0, start) + text + value.slice(end);
    scheduleSave();
    scheduleRender();
    pushHistory(); // ツールバー操作は1回の確定した履歴として記録する
    updateStats();
  }
  function wrapSelection(before, after = before, placeholder = '') {
    const { start, end, value } = getSelection();
    const selected = value.slice(start, end) || placeholder;
    replaceRange(start, end, before + selected + after);
    const cursorStart = start + before.length;
    setSelection(cursorStart, cursorStart + selected.length);
  }

  /* ------------------------------------------------------------------ */
  /* 貼り付け／コピー／切り取り                                            */
  /* ------------------------------------------------------------------ */

  async function doPaste() {
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

  async function doCopy() {
    const { start, end, value } = getSelection();
    const text = start !== end ? value.slice(start, end) : value;
    try {
      await navigator.clipboard.writeText(text);
      toast(start !== end ? 'コピーしました' : 'メモ全体をコピーしました');
    } catch (err) {
      toast('コピーに失敗しました');
    }
  }

  async function doCut() {
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

  function resetWrapArm() {
    Object.keys(wrapArm).forEach((type) => {
      wrapArm[type] = null;
      const btn = WRAP_BTN[type]();
      if (btn) btn.classList.remove('armed');
    });
  }

  function toggleWrapArm(type) {
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
  // 行頭に記号を付与する（見出し／箇条書き／引用など）。
  // 挿入後は行全体を選択状態にせず、カーソルを末尾に置く。
  // 対象行が空行だけの場合は記号のうしろの空白を残し、続けて入力できるようにする。
  function prefixLines(prefix) {
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
  function insertAtCursor(text, cursorOffset) {
    const { start } = getSelection();
    replaceRange(start, start, text);
    const pos = start + (cursorOffset ?? text.length);
    setSelection(pos, pos);
  }
  const numberedListRe = /^\d+\.\s/;
  function toggleOrderedList() {
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
  function wrapSelectionLink() {
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
  function applyListIndent(action) {
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
  function insertIndentedListItem(marker, action) {
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
  function buildTableMarkdown(rows, cols, header) {
    const sepRow = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const headerRow = '| ' + Array.from({ length: cols }, (_, c) => (header ? `見出し${c + 1}` : ' ')).join(' | ') + ' |';
    const bodyRows = Array.from({ length: rows }, () => '| ' + Array.from({ length: cols }, () => ' ').join(' | ') + ' |');
    return '\n' + [headerRow, sepRow, ...bodyRows].join('\n') + '\n';
  }
  function insertTable(rows, cols, header) {
    insertAtCursor(buildTableMarkdown(rows, cols, header), 1);
  }

  const COMMANDS = {
    h: (level) => prefixLines('#'.repeat(level || 1) + ' '),
    bold: () => wrapSelection('**', '**', '太字'),
    italic: () => wrapSelection('*', '*', '斜体'),
    strike: () => wrapSelection('~~', '~~', '取り消し線'),
    code: () => wrapSelection('`', '`', 'code'),
    ul: () => prefixLines('- '),
    ol: () => toggleOrderedList(),
    quote: () => prefixLines('> '),
    hr: () => insertAtCursor('\n\n---\n\n'),
    link: () => wrapSelectionLink(),
    image: () => insertAtCursor('![代替テキスト](画像のURL)', 2),
    codeblock: () => insertAtCursor('\n```\nコードを入力\n```\n', 5),
    table: () => insertTable(3, 3, true),
    indent: () => applyListIndent('indent'),
    paste: () => doPaste(),
    copy: () => doCopy(),
    cut: () => doCut(),
  };

  /* ------------------------------------------------------------------ */
  /* 長押し操作の共通基盤                                                  */
  /* ボタンを離さずに保持すると、テキストエリアからフォーカスが外れて       */
  /* 選択範囲が失われる（＝ショートカットが文末に挿入されてしまう）ことを   */
  /* pointerdown 時点で preventDefault することで防ぐ。                    */
  /* 横スクロール行は touch-action: pan-x により、この preventDefault の    */
  /* 影響を受けずにネイティブでスクロールできる。                          */
  /* ------------------------------------------------------------------ */

  const LONG_PRESS_MS = 380;
  const MOVE_CANCEL_PX = 10;

  function bindPressable(el, handlers) {
    let timer = null;
    let startX = 0;
    let startY = 0;
    let longPressActive = false;
    let moved = false;
    let activePointerId = null;

    function clearTimer() {
      clearTimeout(timer);
      timer = null;
    }

    function onPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault(); // テキストエリアのフォーカス・選択範囲を維持する
      activePointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      moved = false;
      longPressActive = false;
      el.classList.add('pressed');
      clearTimer();
      if (handlers.onLongPressStart) {
        timer = setTimeout(() => {
          if (moved) return;
          longPressActive = true;
          try { el.setPointerCapture(activePointerId); } catch (err) { /* noop */ }
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) { /* noop */ } }
          handlers.onLongPressStart(e);
        }, LONG_PRESS_MS);
      }
    }

    function onPointerMove(e) {
      if (activePointerId === null || e.pointerId !== activePointerId) return;
      if (!longPressActive) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          moved = true;
          clearTimer();
        }
        return;
      }
      if (handlers.onLongPressMove) handlers.onLongPressMove(e);
    }

    function endPress(e, canceled) {
      if (activePointerId === null || (e && e.pointerId !== activePointerId)) return;
      clearTimer();
      el.classList.remove('pressed');
      if (longPressActive) {
        if (canceled) { if (handlers.onLongPressCancel) handlers.onLongPressCancel(e); }
        else if (handlers.onLongPressEnd) handlers.onLongPressEnd(e);
      } else if (!moved && !canceled && handlers.onTap) {
        handlers.onTap(e);
      }
      longPressActive = false;
      moved = false;
      activePointerId = null;
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    const onUp = (e) => endPress(e, false);
    const onCancel = (e) => endPress(e, true);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);

    return {
      destroy() {
        clearTimer();
        el.classList.remove('pressed');
        el.removeEventListener('pointerdown', onPointerDown);
        el.removeEventListener('pointermove', onPointerMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onCancel);
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* 長押しメニュー（見出しレベル／リストの字下げ・字上げ）                 */
  /* ------------------------------------------------------------------ */

  let pressMenuState = null;

  function openVerticalMenu(btn, items) {
    pressMenuEl.innerHTML = '';
    items.forEach((it) => {
      const div = document.createElement('div');
      div.className = 'pm-item';
      div.textContent = it.label;
      pressMenuEl.appendChild(div);
    });
    const rect = btn.getBoundingClientRect();
    pressMenuEl.style.left = `${rect.left + rect.width / 2}px`;
    pressMenuEl.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    pressMenuEl.classList.add('open');
    pressMenuState = { items, activeIndex: items.length - 1, centerX: rect.left + rect.width / 2 };
    updateMenuActiveVisual();
  }

  function updateMenuActiveVisual() {
    if (!pressMenuState) return;
    Array.from(pressMenuEl.children).forEach((child, i) => {
      child.classList.toggle('active', i === pressMenuState.activeIndex);
    });
  }

  function updateVerticalMenu(e) {
    if (!pressMenuState) return;
    const dx = e.clientX - pressMenuState.centerX;
    if (Math.abs(dx) > 130) {
      pressMenuState.activeIndex = -1;
      updateMenuActiveVisual();
      return;
    }
    const menuItems = Array.from(pressMenuEl.children);
    let idx = -1;
    for (let i = 0; i < menuItems.length; i++) {
      const r = menuItems[i].getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) { idx = i; break; }
    }
    if (idx === -1 && menuItems.length) {
      const firstR = menuItems[0].getBoundingClientRect();
      const lastR = menuItems[menuItems.length - 1].getBoundingClientRect();
      if (e.clientY < firstR.top) idx = 0;
      else if (e.clientY > lastR.bottom) idx = menuItems.length - 1;
    }
    pressMenuState.activeIndex = idx;
    updateMenuActiveVisual();
  }

  function closeVerticalMenu() {
    pressMenuEl.classList.remove('open');
    pressMenuEl.innerHTML = '';
    pressMenuState = null;
  }

  function commitVerticalMenu(onCommit) {
    if (!pressMenuState) { closeVerticalMenu(); return; }
    const { items, activeIndex } = pressMenuState;
    const chosen = activeIndex >= 0 ? items[activeIndex] : null;
    closeVerticalMenu();
    if (chosen) onCommit(chosen.value);
  }

  function openHeadingMenu(btn) {
    const items = [6, 5, 4, 3, 2, 1].map((n) => ({ label: `H${n}`, value: n }));
    openVerticalMenu(btn, items);
  }
  function openIndentMenu(btn) {
    const items = [
      { label: '字上げ', value: 'outdent' },
      { label: '字下げ', value: 'indent' },
      { label: '通常', value: 'normal' },
    ];
    openVerticalMenu(btn, items);
  }
  // ul / ol の長押し用：既存行は変えず、字下げ／字上げした新しい項目を挿入する
  function openListInsertMenu(btn) {
    const items = [
      { label: '字上げ', value: 'outdent' },
      { label: '字下げ', value: 'indent' },
    ];
    openVerticalMenu(btn, items);
  }

  /* ------------------------------------------------------------------ */
  /* 長押しパネル（表：行・列・見出しの設定）                              */
  /* ------------------------------------------------------------------ */

  const tableState = { rows: 3, cols: 3, header: true };

  function updateTablePanelUI() {
    $('#tpRowsVal').textContent = tableState.rows;
    $('#tpColsVal').textContent = tableState.cols;
    $('#tpHeaderChk').checked = tableState.header;
  }
  function openTablePanel() {
    tableState.rows = 3;
    tableState.cols = 3;
    tableState.header = true;
    updateTablePanelUI();
    tablePanelEl.classList.add('open');
    pressOverlayEl.classList.add('open');
  }
  function closeTablePanel() {
    tablePanelEl.classList.remove('open');
    pressOverlayEl.classList.remove('open');
  }
  $$('.table-panel [data-tp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.tp;
      if (action === 'rows+') tableState.rows = Math.min(12, tableState.rows + 1);
      if (action === 'rows-') tableState.rows = Math.max(1, tableState.rows - 1);
      if (action === 'cols+') tableState.cols = Math.min(8, tableState.cols + 1);
      if (action === 'cols-') tableState.cols = Math.max(1, tableState.cols - 1);
      updateTablePanelUI();
    });
  });
  $('#tpHeaderChk').addEventListener('change', (e) => { tableState.header = e.target.checked; });
  $('#tpCancel').addEventListener('click', closeTablePanel);
  $('#tpInsert').addEventListener('click', () => {
    insertTable(tableState.rows, tableState.cols, tableState.header);
    closeTablePanel();
  });
  pressOverlayEl.addEventListener('click', closeTablePanel);

  /* ------------------------------------------------------------------ */
  /* ツールバーのボタン登録                                                */
  /* 各ボタンの「初期状態での動作」を defaultHandlersFor で1箇所にまとめ、  */
  /* レジストリに (要素・動作・見た目の初期値) を記録しておく。            */
  /* こうしておくことで、プラグインからのボタン再設定（動作の上書き・      */
  /* リセット・移動・見た目の変更）を安全に行える。                        */
  /* ------------------------------------------------------------------ */

  const toolbarRegistry = new Map(); // id -> { el, handlersFactory, unbind, defaultHTML, defaultTitle, defaultClassName }

  function defaultHandlersFor(btn) {
    const cmd = btn.dataset.cmd;
    const kind = btn.dataset.longpress;
    if (kind === 'heading') {
      return {
        onTap: () => COMMANDS.h(1),
        onLongPressStart: () => openHeadingMenu(btn),
        onLongPressMove: (e) => updateVerticalMenu(e),
        onLongPressEnd: () => commitVerticalMenu((level) => COMMANDS.h(level)),
        onLongPressCancel: () => closeVerticalMenu(),
      };
    }
    if (kind === 'listInsert') {
      const marker = btn.dataset.marker || '- ';
      return {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
        onLongPressStart: () => openListInsertMenu(btn),
        onLongPressMove: (e) => updateVerticalMenu(e),
        onLongPressEnd: () => commitVerticalMenu((action) => insertIndentedListItem(marker, action)),
        onLongPressCancel: () => closeVerticalMenu(),
      };
    }
    if (kind === 'indent') {
      return {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
        onLongPressStart: () => openIndentMenu(btn),
        onLongPressMove: (e) => updateVerticalMenu(e),
        onLongPressEnd: () => commitVerticalMenu((action) => applyListIndent(action)),
        onLongPressCancel: () => closeVerticalMenu(),
      };
    }
    if (kind === 'table') {
      return {
        onTap: () => COMMANDS.table(),
        onLongPressStart: () => openTablePanel(),
      };
    }
    if (kind === 'wrap') {
      return {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
        onLongPressStart: () => toggleWrapArm(cmd),
      };
    }
    if (cmd) {
      return { onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); } };
    }
    return {};
  }

  function bindRegistryButton(id, handlers) {
    const entry = toolbarRegistry.get(id);
    if (!entry) return;
    if (entry.unbind) entry.unbind();
    const bound = bindPressable(entry.el, handlers);
    entry.unbind = bound.destroy;
    entry.handlers = handlers;
  }

  function registerToolbarButton(id, el, handlersFactory) {
    if (!el) return;
    toolbarRegistry.set(id, {
      el,
      handlersFactory,
      unbind: null,
      defaultHTML: el.innerHTML,
      defaultTitle: el.getAttribute('aria-label') || '',
      defaultClassName: el.className,
    });
    bindRegistryButton(id, handlersFactory());
  }

  $$('.fbtn[data-cmd]').forEach((btn) => {
    registerToolbarButton(btn.id, btn, () => defaultHandlersFor(btn));
  });

  registerToolbarButton('undoBtn', undoBtn, () => ({ onTap: undo }));
  registerToolbarButton('redoBtn', redoBtn, () => ({ onTap: redo }));
  registerToolbarButton('moveLeftBtn', $('#moveLeftBtn'), () => ({ onTap: () => moveCursor(-1) }));
  registerToolbarButton('moveRightBtn', $('#moveRightBtn'), () => ({ onTap: () => moveCursor(1) }));
  registerToolbarButton('cursorLeftBtn', $('#cursorLeftBtn'), () => ({ onTap: () => extendSelection(-1) }));
  registerToolbarButton('cursorRightBtn', $('#cursorRightBtn'), () => ({ onTap: () => extendSelection(1) }));
  registerToolbarButton('statsBtn', statsBtn, () => ({
    onTap: () => {
      statsMode = statsMode === 'chars' ? 'words' : 'chars';
      updateStats();
    },
  }));

  /* ------------------------------------------------------------------ */
  /* タブ（編集／プレビュー）                                              */
  /* ------------------------------------------------------------------ */

  const tabButtons = $$('.tab-btn');
  function setView(view) {
    workspaceEl.dataset.view = view;
    appEl.dataset.view = view;
    tabButtons.forEach((b) => {
      const active = b.dataset.view === view;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', String(active));
    });
    tabIndicator.style.transform = view === 'preview' ? 'translateX(100%)' : 'translateX(0%)';
    if (view === 'preview') editorEl.blur();
  }
  tabButtons.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));

  /* ------------------------------------------------------------------ */
  /* メモ切替                                                             */
  /* ------------------------------------------------------------------ */

  function setCurrentNote(note) {
    currentNote = note;
    localStorage.setItem(STORAGE_CURRENT, note.id);
    editorEl.value = note.content;
    resetHistory(note.content);
    resetWrapArm();
    renderPreview();
    updateStats();
  }

  /* ------------------------------------------------------------------ */
  /* メモ一覧（ボトムシート）                                              */
  /* ------------------------------------------------------------------ */

  const overlay = $('#sheetOverlay');
  const sheet = $('#listSheet');

  function openSheet() {
    renderNoteList();
    sheet.classList.add('open');
    overlay.classList.add('open');
  }
  function closeSheet() {
    sheet.classList.remove('open');
    overlay.classList.remove('open');
  }
  $('#listBtn').addEventListener('click', openSheet);
  overlay.addEventListener('click', closeSheet);

  function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderNoteList() {
    const index = loadIndex();
    noteItemsEl.innerHTML = '';
    if (!index.length) {
      noteItemsEl.innerHTML = '<li class="note-empty">メモはまだありません</li>';
      return;
    }
    index.forEach((meta) => {
      const li = document.createElement('li');
      li.className = 'note-item' + (currentNote && meta.id === currentNote.id ? ' current' : '');
      li.innerHTML = `
        <span class="ni-text">
          <div class="ni-title">${escapeHtml(meta.title || '無題のメモ')}</div>
          <div class="ni-meta">${formatDate(meta.updatedAt)}</div>
        </span>
        <button class="ni-del" title="削除">✕</button>
      `;
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('ni-del')) return;
        if (dirty) doSave();
        const note = loadNote(meta.id);
        if (note) {
          setCurrentNote(note);
          closeSheet();
          setView('edit');
        }
      });
      li.querySelector('.ni-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`「${meta.title}」を削除しますか？`)) return;
        deleteNote(meta.id);
        if (currentNote && currentNote.id === meta.id) {
          const remaining = loadIndex();
          if (remaining.length) {
            setCurrentNote(loadNote(remaining[0].id));
          } else {
            const note = newNoteObject();
            setCurrentNote(note);
            saveNote(note);
          }
        }
        renderNoteList();
      });
      noteItemsEl.appendChild(li);
    });
  }

  $('#newNoteBtn').addEventListener('click', () => {
    if (dirty) doSave();
    const note = newNoteObject();
    setCurrentNote(note);
    saveNote(note);
    renderNoteList();
    closeSheet();
    setView('edit');
    toast('新規メモを作成しました');
    editorEl.focus();
  });

  /* ------------------------------------------------------------------ */
  /* 保存（.md ダウンロード）                                             */
  /* ------------------------------------------------------------------ */

  async function doExport() {
    doSave();
    const filename = (currentNote.title || 'memo').replace(/[\\/:*?"<>|]/g, '_') + '.md';
    const content = editorEl.value;
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        toast('保存しました');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('ダウンロードしました');
  }
  $('#saveBtn').addEventListener('click', doExport);

  /* ------------------------------------------------------------------ */
  /* PWA install                                                          */
  /* ------------------------------------------------------------------ */

  let deferredPrompt = null;
  const installBtn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
  });
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add('hidden');
  });
  window.addEventListener('appinstalled', () => {
    installBtn.classList.add('hidden');
    toast('インストールしました');
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href).catch(() => {});
    });
  }

  /* ------------------------------------------------------------------ */
  /* プラグイン                                                            */
  /* ユーザーが作成した .js ファイルを読み込み、Ribbon API 経由でツールバーに
     コマンドを追加できるようにする。プラグインは通常の JavaScript として
     そのまま実行されるため、信頼できる作成者のものだけを追加すること。   */
  /* ------------------------------------------------------------------ */

  const PLUGIN_INDEX_KEY = 'ribbon:plugins';
  const PLUGIN_SRC_PREFIX = 'ribbon:plugin-src:';

  function loadPluginIndex() {
    try { return JSON.parse(localStorage.getItem(PLUGIN_INDEX_KEY)) || []; }
    catch { return []; }
  }
  function savePluginIndex(list) { localStorage.setItem(PLUGIN_INDEX_KEY, JSON.stringify(list)); }
  function pluginId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  // プラグインが追加したコマンドは3段目（横スクロール行）にまとめる。
  // 最初のコマンドが登録された時点で行を作成する。
  let pluginRow = null;
  function ensurePluginRow() {
    if (pluginRow) return pluginRow;
    pluginRow = document.createElement('div');
    pluginRow.className = 'ft-scroll';
    pluginRow.id = 'ftScrollRow3';
    $('.ft-rows').appendChild(pluginRow);
    return pluginRow;
  }

  const pluginListeners = {};

  // 行番号／固定スロット名 → 実際のコンテナ要素の解決。
  // 1: 上段（記法ショートカット） / 2: 下段（コピー・貼り付けなど） / 3: プラグイン専用行
  // 'left-top' / 'left-bottom' / 'right-top' / 'right-bottom': 左右の固定スロット
  function resolveToolbarRow(row) {
    if (row === 1) return $('#ftScrollRow1');
    if (row === 2) return $('#ftScrollRow2');
    if (row === 3) return ensurePluginRow();
    if (row === 'left-top') return $('#ftFixedLeftTop');
    if (row === 'left-bottom') return $('#ftFixedLeftBottom');
    if (row === 'right-top') return $('#ftFixedRightTop');
    if (row === 'right-bottom') return $('#ftFixedRightBottom');
    return null;
  }

  // プラグインから見える公開 API。書式操作や保存処理を直接いじらせず、
  // 安全にラップした関数だけを渡す。
  const Ribbon = {
    version: '1.1',
    editor: {
      getValue: () => editorEl.value,
      setValue: (text) => {
        const s = editorEl.scrollTop;
        editorEl.value = String(text ?? '');
        editorEl.scrollTop = s;
        scheduleSave();
        scheduleRender();
        pushHistory();
        updateStats();
      },
      getSelection: () => getSelection(),
      setSelection: (s, e) => setSelection(s, e),
      insertAtCursor: (text, cursorOffset) => insertAtCursor(text, cursorOffset),
      replaceRange: (s, e, text) => replaceRange(s, e, text),
      wrapSelection: (before, after, placeholder) => wrapSelection(before, after, placeholder),
      prefixLines: (prefix) => prefixLines(prefix),
    },
    // ツールバー3段目にボタンを追加する。onLongPress は省略可。
    // 追加したボタンも toolbar API（移動・見た目変更・動作変更）で管理できる。
    addCommand({ id, label, title, onTap, onLongPress } = {}) {
      if (!id || !label || typeof onTap !== 'function') {
        console.error('[plugin] addCommand には id / label / onTap が必要です');
        return null;
      }
      if (toolbarRegistry.has(id)) {
        console.error(`[plugin] addCommand: id "${id}" は既に使用されています`);
        return null;
      }
      const row = ensurePluginRow();
      const btn = document.createElement('button');
      btn.className = 'fbtn';
      btn.type = 'button';
      btn.id = id;
      btn.dataset.pluginCmd = id;
      if (title) btn.setAttribute('aria-label', title);
      btn.textContent = label;
      row.appendChild(btn);
      registerToolbarButton(id, btn, () => ({
        onTap: () => {
          try { onTap(Ribbon); }
          catch (err) { console.error('[plugin]', err); toast('プラグインの実行でエラーが発生しました'); }
        },
        onLongPressStart: onLongPress
          ? () => { try { onLongPress(Ribbon); } catch (err) { console.error('[plugin]', err); } }
          : undefined,
      }));
      return btn;
    },
    // 既存ボタン（コアのショートカットも、他プラグインが追加したボタンも）の
    // 位置・見た目・動作をあとから変更するための API。
    toolbar: {
      // 登録済みボタンの id 一覧を返す（H・B・I・S・code・ul・ol・quote・hr・
      // link・image・codeblock・table・indent・paste・copy・cut・undo・redo・
      // moveLeft／moveRight・cursorLeft／cursorRight・stats のほか、
      // addCommand で追加されたプラグインボタンの id も含む）。
      listButtons: () => Array.from(toolbarRegistry.keys()),

      getButton(id) {
        const entry = toolbarRegistry.get(id);
        if (!entry) return null;
        return {
          id,
          label: entry.el.textContent,
          title: entry.el.getAttribute('aria-label') || '',
          disabled: !!entry.el.disabled,
          hidden: entry.el.classList.contains('fbtn-hidden'),
        };
      },

      // ボタンの表示ラベルを変更する（HTML可。<strong>B</strong> のような
      // 装飾も入れられる）。
      setLabel(id, html) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        entry.el.innerHTML = html;
      },
      // aria-label（読み上げ用の説明）を変更する。
      setTitle(id, title) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        entry.el.setAttribute('aria-label', title);
      },
      // インラインCSSを追加・上書きする。例: { color: '#fff', background: '#B3402C' }
      setStyle(id, styles = {}) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        Object.assign(entry.el.style, styles);
      },
      // 任意のクラス名を付け外しする。
      setClass(id, className, on = true) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        entry.el.classList.toggle(className, !!on);
      },
      setDisabled(id, disabled = true) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        entry.el.disabled = !!disabled;
      },
      setHidden(id, hidden = true) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        entry.el.classList.toggle('fbtn-hidden', !!hidden);
      },
      // ラベル・aria-label・クラス名・インラインCSSを初期状態に戻す。
      resetAppearance(id) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        entry.el.innerHTML = entry.defaultHTML;
        entry.el.className = entry.defaultClassName;
        entry.el.setAttribute('aria-label', entry.defaultTitle);
        entry.el.style.cssText = '';
      },
      // タップ／長押しの動作を丸ごと差し替える。onTap は必須、onLongPress は
      // 省略可（省略した場合、見出しレベル選択などの元の長押し機能も含めて
      // 単純な「長押しなし」ボタンになる）。
      setHandlers(id, { onTap, onLongPress } = {}) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        if (typeof onTap !== 'function') { console.error('[plugin] setHandlers には onTap 関数が必要です'); return; }
        bindRegistryButton(id, {
          onTap: () => {
            try { onTap(Ribbon); }
            catch (err) { console.error('[plugin]', err); toast('プラグインの実行でエラーが発生しました'); }
          },
          onLongPressStart: onLongPress
            ? () => { try { onLongPress(Ribbon); } catch (err) { console.error('[plugin]', err); } }
            : undefined,
        });
      },
      // タップ／長押しの動作を初期状態に戻す。
      resetHandlers(id) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        bindRegistryButton(id, entry.handlersFactory());
      },
      // ボタンの位置を変更する。
      // { before: '他のボタンid' } … そのボタンの直前に移動
      // { after: '他のボタンid' }  … そのボタンの直後に移動
      // { row: 1 | 2 | 3 | 'left-top' | 'left-bottom' | 'right-top' | 'right-bottom' }
      //   … 指定した行／固定スロットの末尾に移動
      moveButton(id, target = {}) {
        const entry = toolbarRegistry.get(id);
        if (!entry) { console.error(`[plugin] toolbar button "${id}" が見つかりません`); return; }
        const el = entry.el;
        if (target.before) {
          const ref = toolbarRegistry.get(target.before);
          if (!ref || !ref.el.parentElement) { console.error(`[plugin] moveButton: "${target.before}" が見つかりません`); return; }
          ref.el.parentElement.insertBefore(el, ref.el);
          return;
        }
        if (target.after) {
          const ref = toolbarRegistry.get(target.after);
          if (!ref || !ref.el.parentElement) { console.error(`[plugin] moveButton: "${target.after}" が見つかりません`); return; }
          ref.el.parentElement.insertBefore(el, ref.el.nextSibling);
          return;
        }
        if (target.row !== undefined) {
          const container = resolveToolbarRow(target.row);
          if (!container) { console.error(`[plugin] moveButton: 行 "${target.row}" が見つかりません`); return; }
          container.appendChild(el);
          return;
        }
        console.error('[plugin] moveButton には before / after / row のいずれかが必要です');
      },
      // ボタンをツールバーから完全に取り除く（コアのボタンにも使えるが、
      // undo/redo など機能に直結するボタンを消すと該当機能が使えなくなる
      // ため注意すること）。
      removeButton(id) {
        const entry = toolbarRegistry.get(id);
        if (!entry) return;
        if (entry.unbind) entry.unbind();
        entry.el.remove();
        toolbarRegistry.delete(id);
      },
    },
    toast: (msg) => toast(msg),
    // 'save' | 'render' | 'note-change' などを購読できる簡易イベント基盤。
    on(event, handler) {
      (pluginListeners[event] = pluginListeners[event] || []).push(handler);
    },
  };
  window.Ribbon = Ribbon;


  function loadPlugin(entry) {
    try {
      const src = localStorage.getItem(PLUGIN_SRC_PREFIX + entry.id) || '';
      const run = new Function('Ribbon', src);
      run(Ribbon);
      return true;
    } catch (err) {
      console.error('[plugin] 読み込みに失敗しました:', entry.name, err);
      return false;
    }
  }

  function renderPluginList() {
    const list = loadPluginIndex();
    pluginItemsEl.innerHTML = '';
    if (!list.length) {
      pluginItemsEl.innerHTML = '<li class="plugin-empty">追加されたプラグインはありません</li>';
      return;
    }
    list.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'plugin-item' + (entry.error ? ' pi-error' : '');
      li.innerHTML = `
        <span class="pi-text">
          <div class="pi-name">${escapeHtml(entry.name)}</div>
          <div class="pi-meta">${entry.error ? '読み込みエラー' : (entry.enabled ? '有効' : '無効（次回起動時から）')}</div>
        </span>
        <label class="pi-switch">
          <input type="checkbox" ${entry.enabled ? 'checked' : ''}>
          <span class="pi-slider"></span>
        </label>
        <button class="pi-del" title="削除">✕</button>
      `;
      li.querySelector('input').addEventListener('change', (e) => {
        entry.enabled = e.target.checked;
        savePluginIndex(list);
        toast('次回起動時から反映されます');
      });
      li.querySelector('.pi-del').addEventListener('click', () => {
        if (!confirm(`「${entry.name}」を削除しますか？`)) return;
        localStorage.removeItem(PLUGIN_SRC_PREFIX + entry.id);
        savePluginIndex(list.filter((p) => p.id !== entry.id));
        renderPluginList();
        toast('削除しました（追加されたコマンドは次回起動時に消えます）');
      });
      pluginItemsEl.appendChild(li);
    });
  }

  addPluginBtn.addEventListener('click', () => pluginFileInput.click());
  pluginFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const src = await file.text();
    const entry = { id: pluginId(), name: file.name.replace(/\.js$/i, ''), enabled: true, addedAt: Date.now() };
    localStorage.setItem(PLUGIN_SRC_PREFIX + entry.id, src);
    const list = loadPluginIndex();
    list.push(entry);
    savePluginIndex(list);
    const ok = loadPlugin(entry);
    entry.error = !ok;
    savePluginIndex(list);
    renderPluginList();
    toast(ok ? `「${entry.name}」を追加しました` : `「${entry.name}」の読み込みに失敗しました`);
    e.target.value = '';
  });

  function bootPlugins() {
    const list = loadPluginIndex();
    list.forEach((entry) => {
      if (entry.enabled) entry.error = !loadPlugin(entry);
    });
    savePluginIndex(list);
    renderPluginList();
  }

  /* ------------------------------------------------------------------ */
  /* boot                                                                 */
  /* ------------------------------------------------------------------ */

  function boot() {
    const index = loadIndex();
    const currentId = localStorage.getItem(STORAGE_CURRENT);
    let note = currentId ? loadNote(currentId) : null;
    if (!note && index.length) note = loadNote(index[0].id);
    if (!note) {
      note = newNoteObject();
      saveNote(note);
    }
    setCurrentNote(note);
    renderNoteList();
    setView('edit');
    bootPlugins();
  }

  boot();
})();