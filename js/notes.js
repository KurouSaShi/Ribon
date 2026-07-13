// notes.js — 「どのメモを開いているか」の管理、自動保存、
// メモ一覧（ボトムシート）の表示を担当する。

import { editorEl, noteItemsEl, listBtn, sheetOverlayEl, listSheetEl, newNoteBtn } from './dom.js';
import { loadIndex, loadNote, saveNote, deleteNote, newNoteObject, STORAGE_CURRENT } from './storage.js';
import { loadContentIntoEditor, onChange } from './editor-ops.js';
import { setView } from './viewport.js';
import { toast } from './toast.js';

let currentNote = null;
let dirty = false;
let saveTimer = null;

export function getCurrentNote() {
  return currentNote;
}

function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 400);
}

export function doSave() {
  if (!currentNote) return;
  currentNote.content = editorEl.value;
  currentNote.updatedAt = Date.now();
  saveNote(currentNote);
  dirty = false;
  renderNoteList();
}

onChange(scheduleSave);

window.addEventListener('beforeunload', () => { if (dirty) doSave(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && dirty) doSave();
});

export function setCurrentNote(note) {
  currentNote = note;
  localStorage.setItem(STORAGE_CURRENT, note.id);
  loadContentIntoEditor(note.content);
}

/* ------------------------------------------------------------------ */
/* メモ一覧（ボトムシート）                                              */
/* ------------------------------------------------------------------ */

function openSheet() {
  renderNoteList();
  listSheetEl.classList.add('open');
  sheetOverlayEl.classList.add('open');
  listSheetEl.inert = false; // ボタンをクリック・フォーカス可能にする
}
function closeSheet() {
  listSheetEl.classList.remove('open');
  sheetOverlayEl.classList.remove('open');
  listSheetEl.inert = true; // 閉じている間はメモ本体側にタップを奪われないようにする
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function renderNoteList() {
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

// 新規メモを作成して開く。content を渡すと、その内容で新規メモを作る
// （プラグインの Ribbon.notes.createNew から利用される）。
export function createNewNote(content) {
  if (dirty) doSave();
  const note = newNoteObject();
  if (typeof content === 'string') note.content = content;
  setCurrentNote(note);
  saveNote(note);
  renderNoteList();
  closeSheet();
  setView('edit');
  return note;
}

export function initNotes() {
  listBtn.addEventListener('click', openSheet);
  sheetOverlayEl.addEventListener('click', closeSheet);

  newNoteBtn.addEventListener('click', () => {
    createNewNote();
    toast('新規メモを作成しました');
    editorEl.focus();
  });

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
}
