// plugins.js — ユーザーが作成した .js ファイルを読み込み、Ribbon API
// 経由でツールバーにコマンドを追加できるようにする。プラグインは通常の
// JavaScript としてそのまま実行されるため、信頼できる作成者のものだけを
// 追加すること。

import { editorEl, ftRowsEl, pluginItemsEl, addPluginBtn, pluginFileInput } from './dom.js';
import { loadPluginIndex, savePluginIndex, pluginId, PLUGIN_SRC_PREFIX, makePluginStorage } from './storage.js';
import { bindPressable } from './press.js';
import {
  getSelection, setSelection, insertAtCursor, replaceRange, wrapSelection, prefixLines,
  onChange,
} from './editor-ops.js';
import { toast } from './toast.js';
import { createNewNote } from './notes.js';
import { dialogAlert, dialogConfirm, dialogPrompt } from './dialog.js';
import { progressShow, progressUpdate, progressHide } from './progress.js';

// プラグインが追加したコマンドは3段目（横スクロール行）にまとめる。
// 最初のコマンドが登録された時点で行を作成する。
let pluginRow = null;
function ensurePluginRow() {
  if (pluginRow) return pluginRow;
  pluginRow = document.createElement('div');
  pluginRow.className = 'ft-scroll';
  pluginRow.id = 'ftScrollRow3';
  ftRowsEl.appendChild(pluginRow);
  return pluginRow;
}

const pluginListeners = {};
function emitPluginEvent(name, payload) {
  (pluginListeners[name] || []).forEach((fn) => {
    try { fn(payload); } catch (err) { console.error('[plugin]', err); }
  });
}
onChange(() => emitPluginEvent('save'));

// 決められたドメインしか叩けない、といった制限は設けていない
// （プラグインは信頼できる作成者のものだけを追加する前提のため）。
// レスポンスの扱いを毎回書かなくて済むよう、よく使う形だけラップする。
async function networkFetchText(url, options) {
  const res = await fetch(url, options);
  return res.text();
}
async function networkFetchJSON(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

// プラグインから見える公開 API。書式操作や保存処理を直接いじらせず、
// 安全にラップした関数だけを渡す。addCommand 内では `this` を使って
// 呼び出し元のプラグイン専用インスタンス（storage が隔離されたもの）を
// そのままコールバックへ渡す。
const Ribbon = {
  version: '1.1',
  editor: {
    getValue: () => editorEl.value,
    setValue: (text) => {
      const s = editorEl.scrollTop;
      editorEl.value = String(text ?? '');
      editorEl.scrollTop = s;
      editorEl.dispatchEvent(new Event('input'));
    },
    getSelection: () => getSelection(),
    setSelection: (s, e) => setSelection(s, e),
    insertAtCursor: (text, cursorOffset) => insertAtCursor(text, cursorOffset),
    replaceRange: (s, e, text) => replaceRange(s, e, text),
    wrapSelection: (before, after, placeholder) => wrapSelection(before, after, placeholder),
    prefixLines: (prefix) => prefixLines(prefix),
  },
  // ネットワークAPI：fetch のラッパー。生の Response が欲しい場合は fetch を使う。
  network: {
    fetch: (url, options) => fetch(url, options),
    fetchText: (url, options) => networkFetchText(url, options),
    fetchJSON: (url, options) => networkFetchJSON(url, options),
  },
  // メモAPI：新規メモを作成して開く。
  notes: {
    createNew: (content) => createNewNote(content),
  },
  // ダイアログAPI：alert / confirm / prompt はいずれも Promise を返す。
  dialog: {
    alert: (message, title) => dialogAlert(message, title),
    confirm: (message, title) => dialogConfirm(message, title),
    prompt: (message, defaultValue, title) => dialogPrompt(message, defaultValue, title),
  },
  // 進捗表示API：show → 必要に応じて update を連続呼び出し → hide。
  progress: {
    show: (message, percent) => progressShow(message, percent),
    update: (percent, message) => progressUpdate(percent, message),
    hide: () => progressHide(),
  },
  // ツールバー3段目にボタンを追加する。onLongPress は省略可。
  addCommand({ id, label, title, onTap, onLongPress } = {}) {
    if (!id || !label || typeof onTap !== 'function') {
      console.error('[plugin] addCommand には id / label / onTap が必要です');
      return null;
    }
    const row = ensurePluginRow();
    const btn = document.createElement('button');
    btn.className = 'fbtn';
    btn.type = 'button';
    btn.dataset.pluginCmd = id;
    if (title) btn.setAttribute('aria-label', title);
    btn.textContent = label;
    row.appendChild(btn);
    bindPressable(btn, {
      onTap: () => {
        try { onTap(this); }
        catch (err) { console.error('[plugin]', err); toast('プラグインの実行でエラーが発生しました'); }
      },
      onLongPressStart: onLongPress
        ? () => { try { onLongPress(this); } catch (err) { console.error('[plugin]', err); } }
        : undefined,
    });
    return btn;
  },
  toast: (msg) => toast(msg),
  // 'save' などを購読できる簡易イベント基盤。
  on(event, handler) {
    (pluginListeners[event] = pluginListeners[event] || []).push(handler);
  },
};
window.Ribbon = Ribbon;

// プラグインごとに storage だけを差し替えた専用インスタンスを作る。
// これにより Ribbon.storage は他のプラグインから読み書きできない。
function createRibbonForPlugin(id) {
  return { ...Ribbon, storage: makePluginStorage(id) };
}

function loadPlugin(entry) {
  try {
    const src = localStorage.getItem(PLUGIN_SRC_PREFIX + entry.id) || '';
    const run = new Function('Ribbon', src);
    run(createRibbonForPlugin(entry.id));
    return true;
  } catch (err) {
    console.error('[plugin] 読み込みに失敗しました:', entry.name, err);
    return false;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

export function initPlugins() {
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

  const list = loadPluginIndex();
  list.forEach((entry) => {
    if (entry.enabled) entry.error = !loadPlugin(entry);
  });
  savePluginIndex(list);
  renderPluginList();
}
