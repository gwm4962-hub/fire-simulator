/**
 * pwa.js — PWAインストールバナー・Service Worker登録・オフライン対応
 * FLOW | 資産シミュレーター
 *
 * 修正点（v20）:
 * 1. Base64 Data URI の生成・preload注入を廃止
 *    → アイコン画像は sw.js の fetch ハンドラが Canvas PNG で代替するため
 *      pwa.js 側でのインライン埋め込みは不要。Data URI が巨大なため
 *      コンソール警告「The resource data:image/png;base64...」の原因だった。
 * 2. apple-touch-icon の href を相対パス（./icon-192.png）に統一
 *    → SW がアイコン fetch をインターセプトして生成 PNG を返す。
 * 3. beforeinstallprompt の preventDefault() + prompt() 設計は維持
 *    （これは正しいカスタム UI パターン）。
 *    バナー表示条件のバグ（dismissed 後も表示）を修正。
 * 4. alert() を CustomEvent 経由の通知に変更（DOM操作をpwa.jsから排除）
 * 5. console.log を開発環境のみに限定（本番 console を汚染しない）
 */
(function () {
  'use strict';

  // ── デバッグログ（本番では console を汚染しない）──────────────────
  const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const log   = (...a) => isDev && console.log('[PWA]', ...a);

  // ── 1. 状態管理 ─────────────────────────────────────────────────────
  const DISMISSED_KEY = 'pwa_banner_dismissed';
  let deferredPrompt  = window.__pwaInstallEvent || null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode = (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );
  const isAndroid = /Android/.test(navigator.userAgent);
  const isChrome  = /Chrome\//.test(navigator.userAgent) && !/Edge\/|Edg\//.test(navigator.userAgent);

  // ── 2. apple-touch-icon をファイルパスで登録（SW がフォールバックを返す）──
  // 旧実装: canvas で Data URI を生成して head に注入 → 巨大な base64 が
  //   コンソールに「The resource data:image/png;base64...」警告を出していた。
  // 新実装: 実ファイルパスを参照し、SW の fetch ハンドラが存在しない場合に
  //   透過1pxまたはCanvas PNGで代替するため、ここでの生成は不要。
  (function addAppleTouchIcon() {
    if (document.querySelector('link[rel="apple-touch-icon"]')) return; // 重複防止
    const link = document.createElement('link');
    link.rel   = 'apple-touch-icon';
    link.sizes = '192x192';
    link.href  = './icon-192.png'; // SW がインターセプトして代替画像を返す
    document.head.appendChild(link);
  })();

  // ── 3. Service Worker 登録 ───────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
          log('SW registered:', reg.scope);
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            if (nw) nw.addEventListener('statechange', () => {
              if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                log('New SW available');
              }
            });
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
  }

  // ── 4. バナー表示制御 ────────────────────────────────────────────────
  const banner = document.getElementById('pwa-install-banner');
  const dismissed = !!localStorage.getItem(DISMISSED_KEY);

  function showBanner() {
    if (isInStandaloneMode || dismissed) return;
    banner?.classList.add('visible');
  }

  // beforeinstallprompt: ブラウザ標準バナーをブロックし、独自UIで制御する
  // （この preventDefault() + 後で prompt() を呼ぶ設計は PWA の正しいパターン）
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // ブラウザ標準バナーを抑制
    deferredPrompt = e;
    window.__pwaInstallEvent = e;
    log('beforeinstallprompt captured');
    showBanner();
  });

  // 早期キャプチャ済みの場合
  if (deferredPrompt && !isInStandaloneMode && !dismissed) {
    setTimeout(showBanner, 800);
  }

  // iOS: beforeinstallprompt が発火しないため手動表示
  if (isIOS && !isInStandaloneMode && !dismissed) {
    setTimeout(showBanner, 3000);
  }

  // Android フォールバック: 4秒後も prompt が来ない場合はバナーで手順案内
  if (isAndroid && !isIOS && !isInStandaloneMode && !dismissed) {
    setTimeout(() => {
      if (!deferredPrompt) showBanner();
    }, 4000);
  }

  // ── 5. 公開関数 ──────────────────────────────────────────────────────

  function updatePwaStatus(installed) {
    const btn      = document.getElementById('pwa-step5-btn');
    const alreadyMsg = document.getElementById('pwa-step5-already');
    if (installed) {
      if (btn)       btn.style.display  = 'none';
      if (alreadyMsg) alreadyMsg.style.display = 'block';
    }
  }

  // インストール通知を CustomEvent で発行（alert() を廃止）
  function notifyInstall(message) {
    // まず UI トースト通知を試みる
    const toastEvent = new CustomEvent('pwa:notify', { detail: { message } });
    window.dispatchEvent(toastEvent);
    // トースト受信側がなければコンソールのみ（alert() は使わない）
    log('notify:', message);
  }

  window.pwaStep5Install = function() {
    window.pwaTriggerInstall();
  };

  window.pwaTriggerInstall = function() {
    if (isInStandaloneMode) {
      notifyInstall('すでにアプリとして起動しています。');
      return;
    }

    if (isIOS) {
      banner?.classList.remove('visible');
      const iosModal = document.getElementById('pwa-ios-modal');
      if (iosModal) {
        iosModal.classList.add('open');
      } else {
        notifyInstall('iOS（Safari）では、画面下の「共有ボタン（↑）」→「ホーム画面に追加」を選択してください。');
      }
      return;
    }

    if (deferredPrompt) {
      // Android/Chrome: 保存しておいた prompt() を起動（PWA 正規フロー）
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choiceResult => {
        log('User choice:', choiceResult.outcome);
        if (choiceResult.outcome === 'accepted') {
          updatePwaStatus(true);
          localStorage.setItem(DISMISSED_KEY, '1');
        }
        deferredPrompt = null;
        window.__pwaInstallEvent = null;
        banner?.classList.remove('visible');
      });
    } else {
      // prompt 未取得（beforeinstallprompt が未発火）→ 手順モーダルで案内
      if (isAndroid && isChrome) {
        const androidModal = document.getElementById('pwa-android-modal');
        if (androidModal) {
          androidModal.classList.add('open');
        } else {
          notifyInstall('Chromeのメニュー（右上の︙）→「アプリをインストール」または「ホーム画面に追加」を選択してください。');
        }
      } else {
        notifyInstall('ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選択してください。');
      }
    }
  };

  window.pwaDismissBanner = function() {
    banner?.classList.remove('visible');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  window.pwaCloseIosModal = function() {
    document.getElementById('pwa-ios-modal')?.classList.remove('open');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  window.pwaCloseAndroidModal = function() {
    document.getElementById('pwa-android-modal')?.classList.remove('open');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  // インストール完了イベント
  window.addEventListener('appinstalled', () => {
    log('App installed');
    updatePwaStatus(true);
    banner?.classList.remove('visible');
    deferredPrompt = null;
    window.__pwaInstallEvent = null;
  });

  // 初期化: インストール済みならボタンを隠す
  if (isInStandaloneMode) updatePwaStatus(true);

  // オフライン監視
  window.addEventListener('online',  () => document.getElementById('pwa-offline-bar')?.classList.remove('visible'));
  window.addEventListener('offline', () => document.getElementById('pwa-offline-bar')?.classList.add('visible'));

  // ── 6. pwa:notify の受信側（トースト表示）─────────────────────────
  // 既存の UI にトースト要素があればそこに表示し、なければ無視する
  window.addEventListener('pwa:notify', e => {
    const msg      = e.detail?.message;
    const toastEl  = document.getElementById('pwa-toast') ||
                     document.getElementById('pwa-offline-bar');
    if (toastEl && msg) {
      const prev = toastEl.textContent;
      toastEl.textContent = msg;
      toastEl.classList.add('visible');
      setTimeout(() => {
        toastEl.textContent = prev;
        toastEl.classList.remove('visible');
      }, 4000);
    }
    // トースト要素がなければ静かに無視（console.warn も出さない）
  });

})();
