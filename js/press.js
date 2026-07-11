// press.js — 長押し操作の共通基盤と、それを使う2つのUI部品
// （見出しレベル等を選ぶスライドメニュー、表の行・列・見出しを
// 設定するパネル）をまとめたモジュール。テキスト編集そのものには
// 関与せず、「何が選ばれたか」をコールバックで呼び出し元に返すだけ。

import { $, $$, pressMenuEl, tablePanelEl, pressOverlayEl } from './dom.js';

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

export function bindPressable(el, handlers) {
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
  el.addEventListener('pointerup', (e) => endPress(e, false));
  el.addEventListener('pointercancel', (e) => endPress(e, true));
}

/* ------------------------------------------------------------------ */
/* 長押しメニュー（見出しレベル／リストの字下げ・字上げ）                 */
/* ------------------------------------------------------------------ */

let pressMenuState = null;

export function openVerticalMenu(btn, items) {
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

export function updateVerticalMenu(e) {
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

export function closeVerticalMenu() {
  pressMenuEl.classList.remove('open');
  pressMenuEl.innerHTML = '';
  pressMenuState = null;
}

export function commitVerticalMenu(onCommit) {
  if (!pressMenuState) { closeVerticalMenu(); return; }
  const { items, activeIndex } = pressMenuState;
  const chosen = activeIndex >= 0 ? items[activeIndex] : null;
  closeVerticalMenu();
  if (chosen) onCommit(chosen.value);
}

export function openHeadingMenu(btn) {
  const items = [6, 5, 4, 3, 2, 1].map((n) => ({ label: `H${n}`, value: n }));
  openVerticalMenu(btn, items);
}
export function openIndentMenu(btn) {
  const items = [
    { label: '字上げ', value: 'outdent' },
    { label: '字下げ', value: 'indent' },
    { label: '通常', value: 'normal' },
  ];
  openVerticalMenu(btn, items);
}
// ul / ol の長押し用：既存行は変えず、字下げ／字上げした新しい項目を挿入する
export function openListInsertMenu(btn) {
  const items = [
    { label: '字上げ', value: 'outdent' },
    { label: '字下げ', value: 'indent' },
  ];
  openVerticalMenu(btn, items);
}

/* ------------------------------------------------------------------ */
/* 長押しパネル（表：行・列・見出しの設定）                              */
/* insertCallback(rows, cols, header) は openTablePanel を呼ぶ側が渡す。 */
/* ------------------------------------------------------------------ */

const tableState = { rows: 3, cols: 3, header: true };
let tableInsertCallback = null;

function updateTablePanelUI() {
  $('#tpRowsVal').textContent = tableState.rows;
  $('#tpColsVal').textContent = tableState.cols;
  $('#tpHeaderChk').checked = tableState.header;
}

export function openTablePanel(insertCallback) {
  tableInsertCallback = insertCallback;
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
  if (tableInsertCallback) tableInsertCallback(tableState.rows, tableState.cols, tableState.header);
  closeTablePanel();
});
pressOverlayEl.addEventListener('click', closeTablePanel);
