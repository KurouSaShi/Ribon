// storage.js — メモとプラグインの永続化（localStorage）を担当する。
//
// Cookie ではなく localStorage を使っている理由：
// Cookie は1件あたり約4KBまでという容量制限があり、しかもページを
// 読み込むたびにサーバーへ送信されてしまうため、複数メモをブラウザ内
// だけで保持する用途には向かない。localStorage は容量が大きく
// （目安5MB程度）、サーバーへは送信されず、ブラウザに閉じたまま
// 保存できるためこちらを採用している。

export const STORAGE_PREFIX = 'ribbon:note:';
export const STORAGE_INDEX = 'ribbon:index';
export const STORAGE_CURRENT = 'ribbon:current';

export function loadIndex() {
  try { return JSON.parse(localStorage.getItem(STORAGE_INDEX)) || []; }
  catch { return []; }
}
export function saveIndex(index) {
  localStorage.setItem(STORAGE_INDEX, JSON.stringify(index));
}
export function uid() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function loadNote(id) {
  try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + id)); }
  catch { return null; }
}

export function titleFromContent(content) {
  const firstLine = (content || '').split('\n').find((l) => l.trim().length > 0) || '';
  return firstLine.replace(/^#+\s*/, '').trim().slice(0, 40) || '無題のメモ';
}

export function saveNote(note) {
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

export function deleteNote(id) {
  localStorage.removeItem(STORAGE_PREFIX + id);
  saveIndex(loadIndex().filter((n) => n.id !== id));
}

export function newNoteObject() {
  const now = Date.now();
  return { id: uid(), title: '無題のメモ', content: '', createdAt: now, updatedAt: now };
}

/* ---- プラグイン用ストレージ ---- */

export const PLUGIN_INDEX_KEY = 'ribbon:plugins';
export const PLUGIN_SRC_PREFIX = 'ribbon:plugin-src:';

export function loadPluginIndex() {
  try { return JSON.parse(localStorage.getItem(PLUGIN_INDEX_KEY)) || []; }
  catch { return []; }
}
export function savePluginIndex(list) {
  localStorage.setItem(PLUGIN_INDEX_KEY, JSON.stringify(list));
}
export function pluginId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
