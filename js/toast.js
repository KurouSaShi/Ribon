// toast.js — 画面下部に短いメッセージを表示する。

import { toastEl } from './dom.js';

let toastTimer = null;

export function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1800);
}
