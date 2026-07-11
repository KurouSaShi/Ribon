// viewport.js — 編集／プレビュー タブの切り替え、PWAのインストールと
// Service Worker 登録をまとめたモジュール。

import { appEl, editorEl, previewEl, workspaceEl, tabIndicator, tabButtons, installBtn } from './dom.js';
import { toast } from './toast.js';

/* ------------------------------------------------------------------ */
/* タブ（編集／プレビュー）                                              */
/* ------------------------------------------------------------------ */

export function setView(view) {
  const previousView = workspaceEl.dataset.view;
  let ratio = null;
  if (previousView && previousView !== view) {
    const fromEl = previousView === 'edit' ? editorEl : previewEl;
    const fromMax = fromEl.scrollHeight - fromEl.clientHeight;
    ratio = fromMax > 0 ? fromEl.scrollTop / fromMax : 0;
  }

  workspaceEl.dataset.view = view;
  appEl.dataset.view = view;
  tabButtons.forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  tabIndicator.style.transform = view === 'preview' ? 'translateX(100%)' : 'translateX(0%)';
  if (view === 'preview') editorEl.blur();

  if (ratio !== null) {
    const toEl = view === 'edit' ? editorEl : previewEl;
    // 表示切替直後はレイアウトが未確定のことがあるため、次のフレームで
    // scrollHeight を再計算してから位置を合わせる。
    requestAnimationFrame(() => {
      const toMax = toEl.scrollHeight - toEl.clientHeight;
      toEl.scrollTop = ratio * toMax;
    });
  }
}

export function initTabs() {
  tabButtons.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
}

/* ------------------------------------------------------------------ */
/* PWA：インストール導線 と Service Worker 登録                          */
/* ------------------------------------------------------------------ */

export function initPwa() {
  let deferredPrompt = null;
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
}
