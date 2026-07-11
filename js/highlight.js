// highlight.js — 特殊文字（*, ~, #, _, `, > ,- , 1. , [] () | など）を
// 編集エリアの背後にあるレイヤーで色付き表示する。
//
// 実装方針：本文の実データは常に <textarea> 側が正。ハイライト表示は
// 同じ内容・同じフォント・同じ余白でレイアウトした背後の <div> に
// 描画し、有効時は textarea の文字色だけを透明にして、下のレイヤーの
// 色付き文字を透けて見せる（キャレットは caret-color で表示され続ける）。

import { editorEl, editorStackEl, editorHighlightEl } from './dom.js';
import { onChange, onReset } from './editor-ops.js';

let enabled = false;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 行内で強調・打消し線・コード・リンク/画像の括弧類として使われる記号
const INLINE_RE = /(\*\*|\*|~~|~|`|__|_|\[|\]|\(|\)|\|)/g;

function highlightLine(line) {
  const headingMatch = line.match(/^(#{1,6})(\s)/);
  const quoteMatch = line.match(/^(>)(\s?)/);
  const listMatch = line.match(/^(\s*)([-+*]|\d+\.)(\s)/);

  let prefixLen = 0;
  let prefixHtml = '';

  if (headingMatch) {
    prefixLen = headingMatch[0].length;
    prefixHtml = `<span class="hl-mark">${escapeHtml(headingMatch[1])}</span>${escapeHtml(headingMatch[2])}`;
  } else if (listMatch) {
    prefixLen = listMatch[0].length;
    prefixHtml = escapeHtml(listMatch[1]) + `<span class="hl-mark">${escapeHtml(listMatch[2])}</span>` + escapeHtml(listMatch[3]);
  } else if (quoteMatch) {
    prefixLen = quoteMatch[0].length;
    prefixHtml = `<span class="hl-mark">&gt;</span>${escapeHtml(quoteMatch[2])}`;
  }

  const rest = line.slice(prefixLen);
  const restHtml = escapeHtml(rest).replace(INLINE_RE, '<span class="hl-mark">$1</span>');
  return prefixHtml + restHtml;
}

function renderHighlight() {
  const html = editorEl.value.split('\n').map(highlightLine).join('\n');
  editorHighlightEl.innerHTML = html + '\n';
  syncScroll();
}

function syncScroll() {
  editorHighlightEl.scrollTop = editorEl.scrollTop;
  editorHighlightEl.scrollLeft = editorEl.scrollLeft;
}

editorEl.addEventListener('scroll', () => { if (enabled) syncScroll(); });
onChange(() => { if (enabled) renderHighlight(); });
onReset(() => { if (enabled) renderHighlight(); });

export function setHighlightEnabled(on) {
  enabled = on;
  editorStackEl.classList.toggle('hl-active', on);
  if (on) renderHighlight();
}

export function isHighlightEnabled() {
  return enabled;
}
