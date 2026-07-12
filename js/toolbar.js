// toolbar.js — 記法ショートカットのコマンド定義と、すべてのツールバー
// ボタンを長押し基盤（press.js）経由で editor-ops.js に接続する。

import { $$, undoBtn, redoBtn, moveLeftBtn, moveRightBtn, selectLeftBtn, selectRightBtn, statsBtn } from './dom.js';
import { bindPressable, openHeadingMenu, openIndentMenu, openListInsertMenu, openTablePanel, updateVerticalMenu, commitVerticalMenu, closeVerticalMenu } from './press.js';
import {
  wrapSelection, prefixLines, toggleOrderedList, insertAtCursor, wrapSelectionLink,
  applyListIndent, insertIndentedListItem, insertTable,
  undo, redo, moveCursor, extendSelection, toggleWrapArm, toggleStatsMode,
  doPaste, doCopy, doCut,
} from './editor-ops.js';

export const COMMANDS = {
  h: (level) => prefixLines('#'.repeat(level || 1) + ' '),
  bold: () => wrapSelection('**', '**', '太字'),
  italic: () => wrapSelection('*', '*', '斜体'),
  strike: () => wrapSelection('~~', '~~', '取り消し線'),
  code: () => wrapSelection('`', '`', 'code'),
  ul: () => prefixLines('- '),
  ol: () => toggleOrderedList(),
  quote: () => prefixLines('> '),
  hr: () => insertAtCursor('\n\n---\n\n', 6),
  link: () => wrapSelectionLink(),
  image: () => insertAtCursor('![代替テキスト](画像のURL)', 2),
  codeblock: () => insertAtCursor('\n```\n\n```\n', 5),
  table: () => insertTable(3, 3, true),
  indent: () => applyListIndent('indent'),
  paste: () => doPaste(),
  copy: () => doCopy(),
  cut: () => doCut(),
};

export function initToolbar() {
  $$('.fbtn[data-cmd]').forEach((btn) => {
    const cmd = btn.dataset.cmd;
    const kind = btn.dataset.longpress;
    if (kind === 'heading') {
      bindPressable(btn, {
        onTap: () => COMMANDS.h(1),
        onLongPressStart: () => openHeadingMenu(btn),
        onLongPressMove: (e) => updateVerticalMenu(e),
        onLongPressEnd: () => commitVerticalMenu((level) => COMMANDS.h(level)),
        onLongPressCancel: () => closeVerticalMenu(),
      });
    } else if (kind === 'listInsert') {
      const marker = btn.dataset.marker || '- ';
      bindPressable(btn, {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
        onLongPressStart: () => openListInsertMenu(btn),
        onLongPressMove: (e) => updateVerticalMenu(e),
        onLongPressEnd: () => commitVerticalMenu((action) => insertIndentedListItem(marker, action)),
        onLongPressCancel: () => closeVerticalMenu(),
      });
    } else if (kind === 'indent') {
      bindPressable(btn, {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
        onLongPressStart: () => openIndentMenu(btn),
        onLongPressMove: (e) => updateVerticalMenu(e),
        onLongPressEnd: () => commitVerticalMenu((action) => applyListIndent(action)),
        onLongPressCancel: () => closeVerticalMenu(),
      });
    } else if (kind === 'table') {
      bindPressable(btn, {
        onTap: () => COMMANDS.table(),
        onLongPressStart: () => openTablePanel((rows, cols, header) => insertTable(rows, cols, header)),
      });
    } else if (kind === 'wrap') {
      bindPressable(btn, {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
        onLongPressStart: () => toggleWrapArm(cmd),
      });
    } else {
      bindPressable(btn, {
        onTap: () => { if (COMMANDS[cmd]) COMMANDS[cmd](); },
      });
    }
  });

  // 左固定：上段＝カーソル移動、下段＝元に戻す／やり直し
  bindPressable(moveLeftBtn, { onTap: () => moveCursor(-1) });
  bindPressable(moveRightBtn, { onTap: () => moveCursor(1) });
  bindPressable(undoBtn, { onTap: undo });
  bindPressable(redoBtn, { onTap: redo });

  // 右固定：上段＝文字数／語数、下段＝選択範囲を広げる
  bindPressable(statsBtn, { onTap: () => toggleStatsMode() });
  bindPressable(selectLeftBtn, { onTap: () => extendSelection(-1) });
  bindPressable(selectRightBtn, { onTap: () => extendSelection(1) });
}
