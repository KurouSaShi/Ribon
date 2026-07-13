// progress.js — プラグイン向けの進捗表示API。時間のかかる処理
// （ネットワーク取得や大きな変換処理など）の進み具合を、画面下部の
// 固定バーで表示する。DOM要素は初回呼び出し時に遅延生成する。

let barEl = null;
let fillEl = null;
let labelEl = null;
let styleInjected = false;
let hideTimer = null;

function injectStyleOnce() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .rb-progress {
      position: fixed; left: 12px; right: 12px; bottom: calc(var(--toolbar-h, 104px) + 14px);
      background: var(--surface, #fff); color: var(--text, #111);
      border-radius: 12px; padding: 10px 14px; box-shadow: 0 6px 24px rgba(0,0,0,.2);
      z-index: 150; opacity: 0; pointer-events: none; transform: translateY(6px);
      transition: opacity .15s ease, transform .15s ease; font-size: 13px;
    }
    .rb-progress.open { opacity: 1; transform: translateY(0); }
    .rb-progress-label { margin: 0 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .rb-progress-track { height: 6px; border-radius: 999px; background: rgba(0,0,0,.08); overflow: hidden; }
    .rb-progress-fill { height: 100%; width: 0%; background: var(--accent, #2563eb); transition: width .15s ease; }
    .rb-progress-fill.indeterminate {
      width: 40% !important; animation: rb-progress-slide 1.1s ease-in-out infinite;
    }
    @keyframes rb-progress-slide {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(250%); }
    }
  `;
  document.head.appendChild(style);
}

function ensureDom() {
  if (barEl) return;
  injectStyleOnce();
  barEl = document.createElement('div');
  barEl.className = 'rb-progress';
  labelEl = document.createElement('p');
  labelEl.className = 'rb-progress-label';
  const track = document.createElement('div');
  track.className = 'rb-progress-track';
  fillEl = document.createElement('div');
  fillEl.className = 'rb-progress-fill';
  track.appendChild(fillEl);
  barEl.append(labelEl, track);
  document.body.appendChild(barEl);
}

// message を表示して進捗バーを開く。percent（0〜100）を省略すると
// 不確定（左右に流れる）表示になる。
export function progressShow(message, percent) {
  ensureDom();
  clearTimeout(hideTimer);
  labelEl.textContent = message || '';
  progressUpdate(percent);
  requestAnimationFrame(() => barEl.classList.add('open'));
}

// 進捗を更新する。percent を省略すると不確定表示のまま、指定すると
// 0〜100 にクランプして幅を反映する。message を渡すとラベルも更新する。
export function progressUpdate(percent, message) {
  ensureDom();
  if (typeof message === 'string') labelEl.textContent = message;
  if (percent === undefined || percent === null) {
    fillEl.classList.add('indeterminate');
  } else {
    fillEl.classList.remove('indeterminate');
    fillEl.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }
}

// 進捗バーを閉じる。
export function progressHide() {
  if (!barEl) return;
  barEl.classList.remove('open');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { fillEl.style.width = '0%'; fillEl.classList.remove('indeterminate'); }, 200);
}
