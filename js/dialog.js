// dialog.js — プラグイン向けのダイアログAPI（alert / confirm / prompt）。
// ネイティブの window.alert 等はPWA環境では見た目が崩れたり、
// ブラウザによっては無効化されることがあるため、自前のモーダルを
// 動的に生成して同等の機能を提供する。DOM要素は初回呼び出し時に
// 遅延生成するため、index.html / app.js への変更は不要。

let overlayEl = null;
let modalEl = null;
let titleEl = null;
let messageEl = null;
let inputEl = null;
let buttonsEl = null;
let styleInjected = false;

function injectStyleOnce() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .rb-dialog-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center;
      z-index: 200; opacity: 0; pointer-events: none; transition: opacity .15s ease;
      padding: 24px;
    }
    .rb-dialog-overlay.open { opacity: 1; pointer-events: auto; }
    .rb-dialog {
      background: var(--surface, #fff); color: var(--text, #111);
      border-radius: 14px; padding: 20px; width: 100%; max-width: 340px;
      box-shadow: 0 10px 40px rgba(0,0,0,.25);
      transform: translateY(8px) scale(.98); transition: transform .15s ease;
      font-family: inherit;
    }
    .rb-dialog-overlay.open .rb-dialog { transform: translateY(0) scale(1); }
    .rb-dialog-title { font-weight: 700; font-size: 16px; margin: 0 0 8px; }
    .rb-dialog-message { font-size: 14px; line-height: 1.5; margin: 0 0 14px; white-space: pre-wrap; }
    .rb-dialog-input {
      width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 14px;
      border: 1px solid rgba(0,0,0,.2); border-radius: 8px; margin-bottom: 14px;
    }
    .rb-dialog-buttons { display: flex; justify-content: flex-end; gap: 8px; }
    .rb-dialog-btn {
      appearance: none; border: none; border-radius: 8px; padding: 8px 14px;
      font-size: 14px; font-weight: 600; cursor: pointer; background: rgba(0,0,0,.06);
      color: inherit;
    }
    .rb-dialog-btn.primary { background: var(--accent, #2563eb); color: #fff; }
  `;
  document.head.appendChild(style);
}

function ensureDom() {
  if (overlayEl) return;
  injectStyleOnce();
  overlayEl = document.createElement('div');
  overlayEl.className = 'rb-dialog-overlay';
  modalEl = document.createElement('div');
  modalEl.className = 'rb-dialog';
  titleEl = document.createElement('p');
  titleEl.className = 'rb-dialog-title';
  messageEl = document.createElement('p');
  messageEl.className = 'rb-dialog-message';
  inputEl = document.createElement('input');
  inputEl.className = 'rb-dialog-input';
  inputEl.type = 'text';
  buttonsEl = document.createElement('div');
  buttonsEl.className = 'rb-dialog-buttons';
  modalEl.append(titleEl, messageEl, inputEl, buttonsEl);
  overlayEl.appendChild(modalEl);
  document.body.appendChild(overlayEl);
}

// 一度に1つのダイアログしか出さない（キューで直列化する）
let queue = Promise.resolve();

function openDialog({ title, message, showInput, defaultValue, buttons }) {
  ensureDom();
  titleEl.textContent = title || '';
  titleEl.style.display = title ? '' : 'none';
  messageEl.textContent = message || '';
  inputEl.style.display = showInput ? '' : 'none';
  inputEl.value = showInput ? (defaultValue ?? '') : '';
  buttonsEl.innerHTML = '';

  return new Promise((resolve) => {
    function close(value) {
      overlayEl.classList.remove('open');
      document.removeEventListener('keydown', onKeydown);
      resolve(value);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') close(showInput ? null : false);
      if (e.key === 'Enter' && showInput) close(inputEl.value);
    }
    buttons.forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'rb-dialog-btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => close(showInput ? (b.value === undefined ? inputEl.value : b.value) : b.value));
      buttonsEl.appendChild(btn);
    });
    document.addEventListener('keydown', onKeydown);
    requestAnimationFrame(() => {
      overlayEl.classList.add('open');
      if (showInput) { inputEl.focus(); inputEl.select(); }
    });
  });
}

function queued(task) {
  const run = () => task();
  queue = queue.then(run, run);
  return queue;
}

export function dialogAlert(message, title) {
  return queued(() => openDialog({
    title, message, showInput: false,
    buttons: [{ label: 'OK', value: undefined, primary: true }],
  })).then(() => undefined);
}

export function dialogConfirm(message, title) {
  return queued(() => openDialog({
    title, message, showInput: false,
    buttons: [
      { label: 'キャンセル', value: false },
      { label: 'OK', value: true, primary: true },
    ],
  }));
}

export function dialogPrompt(message, defaultValue, title) {
  return queued(() => openDialog({
    title, message, showInput: true, defaultValue,
    buttons: [
      { label: 'キャンセル', value: null },
      { label: 'OK', value: undefined, primary: true },
    ],
  }));
}
