// app.js — エントリーポイント。
// 実装本体は役割ごとに分割してあるので、変更したい機能に応じて
// 該当するファイルを見てください。
//
//   dom.js         DOM要素の参照
//   toast.js       画面下部の短いメッセージ
//   storage.js     メモ／プラグインの localStorage 永続化
//   editor-ops.js  テキスト編集の中核（選択・置換・履歴・貼付コピー等）
//   press.js       長押し操作の共通基盤（スライドメニュー・表パネル）
//   toolbar.js     ツールバーの各ボタンをコマンドに接続
//   notes.js       メモの切替・自動保存・メモ一覧シート
//   export.js      「保存」ボタン（.md ダウンロード）
//   plugins.js     Ribbon プラグインAPIと管理UI
//   viewport.js    タブ切替・スクロール同期・ソフトキーボード対応・PWAインストール
//   highlight.js   特殊文字ハイライトのオーバーレイ描画
//   settings.js    文字サイズ・ハイライト設定の永続化とUI配線

import { initTabs, initPwa, initKeyboardFix, initToolbarHeight } from './viewport.js';
import { initToolbar } from './toolbar.js';
import { initNotes } from './notes.js';
import { initExport } from './export.js';
import { initPlugins } from './plugins.js';
import { initSettings } from './settings.js';

marked.setOptions({ breaks: true, gfm: true });

initKeyboardFix();
initTabs();
initToolbar();
initNotes();
initExport();
initPwa();
initSettings();
initPlugins();
initToolbarHeight();
