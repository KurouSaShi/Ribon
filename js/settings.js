// settings.js — ハンバーガーメニュー内の「表示設定」（文字サイズ・
// 特殊文字ハイライト）の永続化とUI配線。

import { fontSizeVal, fontSizeDown, fontSizeUp, highlightChk } from './dom.js';
import { setHighlightEnabled } from './highlight.js';

const FONT_SIZE_KEY = 'ribbon:font-size';
const HIGHLIGHT_KEY = 'ribbon:highlight';
const MIN_SIZE = 12;
const MAX_SIZE = 28;
const DEFAULT_SIZE = 16;

function applyFontSize(size) {
  document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
  fontSizeVal.textContent = `${size}px`;
}

export function initSettings() {
  let size = parseInt(localStorage.getItem(FONT_SIZE_KEY), 10);
  if (!Number.isFinite(size) || size < MIN_SIZE || size > MAX_SIZE) size = DEFAULT_SIZE;
  applyFontSize(size);

  fontSizeDown.addEventListener('click', () => {
    size = Math.max(MIN_SIZE, size - 1);
    applyFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  });
  fontSizeUp.addEventListener('click', () => {
    size = Math.min(MAX_SIZE, size + 1);
    applyFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  });

  const highlightOn = localStorage.getItem(HIGHLIGHT_KEY) === '1';
  highlightChk.checked = highlightOn;
  setHighlightEnabled(highlightOn);
  highlightChk.addEventListener('change', (e) => {
    setHighlightEnabled(e.target.checked);
    localStorage.setItem(HIGHLIGHT_KEY, e.target.checked ? '1' : '0');
  });
}
