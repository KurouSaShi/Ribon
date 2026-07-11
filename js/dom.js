// dom.js — アプリ全体で使う DOM 要素の参照をここに集約する。
// 各モジュールはここから必要な要素だけ import して使う。

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const appEl = $('#app');
export const editorEl = $('#editor');
export const previewEl = $('#preview');
export const workspaceEl = $('#workspace');
export const toastEl = $('#toast');
export const tabIndicator = $('#tabIndicator');
export const tabButtons = $$('.tab-btn');

export const noteItemsEl = $('#noteItems');
export const listBtn = $('#listBtn');
export const sheetOverlayEl = $('#sheetOverlay');
export const listSheetEl = $('#listSheet');
export const newNoteBtn = $('#newNoteBtn');
export const saveBtn = $('#saveBtn');

export const undoBtn = $('#undoBtn');
export const redoBtn = $('#redoBtn');
export const moveLeftBtn = $('#moveLeftBtn');
export const moveRightBtn = $('#moveRightBtn');
export const selectLeftBtn = $('#selectLeftBtn');
export const selectRightBtn = $('#selectRightBtn');

export const statsBtn = $('#statsBtn');
export const statsValueEl = $('#statsValue');
export const headingCountEl = $('#headingCountEl');

export const pressMenuEl = $('#pressMenu');
export const tablePanelEl = $('#tablePanel');
export const pressOverlayEl = $('#pressOverlay');

export const boldBtn = $('#boldBtn');
export const italicBtn = $('#italicBtn');
export const strikeBtn = $('#strikeBtn');
export const ulBtn = $('#ulBtn');
export const olBtn = $('#olBtn');
export const tabBtn = $('#tabBtn');

export const pluginItemsEl = $('#pluginItems');
export const addPluginBtn = $('#addPluginBtn');
export const pluginFileInput = $('#pluginFileInput');
export const installBtn = $('#installBtn');

export const ftRowsEl = $('.ft-rows');

export const editorStackEl = $('.editor-stack');
export const editorHighlightEl = $('#editorHighlight');
export const fontSizeVal = $('#fontSizeVal');
export const fontSizeDown = $('#fontSizeDown');
export const fontSizeUp = $('#fontSizeUp');
export const highlightChk = $('#highlightChk');
export const previewPaneEl = $('.pane-preview');
