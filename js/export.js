// export.js — 「保存」ボタン：表示中のメモを .md としてダウンロードする。

import { editorEl, saveBtn } from './dom.js';
import { getCurrentNote, doSave } from './notes.js';
import { toast } from './toast.js';

async function doExport() {
  doSave();
  const note = getCurrentNote();
  const filename = ((note && note.title) || 'memo').replace(/[\\/:*?"<>|]/g, '_') + '.md';
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

export function initExport() {
  saveBtn.addEventListener('click', doExport);
}
