// viewport.js — 編集／プレビュー タブの切り替え、ソフトキーボード対応、
// PWAのインストールと Service Worker 登録をまとめたモジュール。

import { appEl, editorEl, previewEl, workspaceEl, tabIndicator, tabButtons, installBtn, formatToolbarEl } from './dom.js';
import { toast } from './toast.js';

/* ------------------------------------------------------------------ */
/* ツールバーの実際の高さを --toolbar-h に反映する                        */
/* 以前は3段ぶんの高さを常に確保していたため、プラグイン行が無いときに      */
/* 空白の3段目のような隙間ができていた。ResizeObserverで実寸を測って       */
/* 反映することで、2段／3段どちらでも隙間なくフィットさせる。              */
/* ------------------------------------------------------------------ */

export function initToolbarHeight() {
  if (!formatToolbarEl) return;
  const sync = () => {
    const h = formatToolbarEl.getBoundingClientRect().height;
    if (h > 0) document.documentElement.style.setProperty('--toolbar-h', `${h}px`);
  };
  sync();
  if ('ResizeObserver' in window) {
    new ResizeObserver(sync).observe(formatToolbarEl);
  } else {
    window.addEventListener('resize', sync);
  }
}

/* ------------------------------------------------------------------ */
/* ソフトキーボード対応                                                  */
/* resize/scroll イベントに頼る方式だと、端末によっては visualViewport の */
/* イベントが確実に発火せず、.app の高さが更新されずツールバーがキー     */
/* ボードの下に取り残されることがある。イベントを待つのではなく、        */
/* テキストエリアにフォーカスがある間は毎フレーム能動的に測り直す。      */
/* ------------------------------------------------------------------ */

function syncAppHeight() {
  const vv = window.visualViewport;
  if (!vv) { appEl.style.height = ''; return; }
  appEl.style.height = `${vv.height}px`;
}

let pollId = null;
function pollAppHeight() {
  syncAppHeight();
  pollId = requestAnimationFrame(pollAppHeight);
}
function startPolling() {
  if (pollId === null) pollAppHeight();
}
function stopPolling() {
  if (pollId !== null) { cancelAnimationFrame(pollId); pollId = null; }
  syncAppHeight(); // 最後にもう一度、キーボードを閉じた後の高さに合わせる
}

export function initKeyboardFix() {
  if (!window.visualViewport) return; // 非対応ブラウザは元の100dvhのまま
  syncAppHeight();
  window.visualViewport.addEventListener('resize', syncAppHeight);
  window.visualViewport.addEventListener('scroll', syncAppHeight);
  editorEl.addEventListener('focus', startPolling);
  editorEl.addEventListener('blur', stopPolling);
}

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
