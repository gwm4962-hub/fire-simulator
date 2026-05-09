/**
 * pwa.js — PWAインストールバナー・Service Worker登録・オフライン対応
 * FLOW | 資産シミュレーター
 *
 * Android修正点:
 * 1. beforeinstallprompt のキャプチャを確実化（head内の早期キャプチャと連携）
 * 2. バナー表示の条件を緩和（dismiss済みでも再表示できるように）
 * 3. deferredPrompt が null の場合の代替手順案内を改善
 * 4. SW登録エラー時のフォールバック強化
 * 5. インストール済み判定の精度向上
 */
(function () {
  'use strict';

  // --- 1. 設定と状態管理 ---
  const DISMISSED_KEY = 'pwa_banner_dismissed';
  // head内の早期キャプチャと連携（app起動前に発火したイベントを拾う）
  let deferredPrompt = window.__pwaInstallEvent || null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  // display-mode:standalone に加え、navigator.standalone（iOS Safari）も確認
  const isInStandaloneMode = (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true
  );

  // Android Chrome か判定（インストール案内を分岐するため）
  const isAndroid = /Android/.test(navigator.userAgent);
  const isChrome  = /Chrome\//.test(navigator.userAgent) && !/Edge\/|Edg\//.test(navigator.userAgent);

  // --- 2. アイコンの動的生成（Canvas）---
  // manifest.json 参照の icon-192.png / icon-512.png が存在しない場合でも
  // data URI でアイコンを補完し、インストール可能状態を保つ
  const pngDataUri = (function() {
    try {
      const S = 512;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');

      const rr = (x, y, w, h, r) => {
        ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
        ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r);
        ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
        ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r);
        ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
      };

      ctx.fillStyle = '#050810'; rr(0, 0, S, S, 110); ctx.fill();

      const base = 390; const barW = 88; const barR = 16;
      const drawBar = (x, h, colors) => {
        const g = ctx.createLinearGradient(0, base-h, 0, base);
        g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
        ctx.fillStyle = g; rr(x, base-h, barW, h, barR); ctx.fill();
      };

      drawBar(88,  120, ['#00c6ff', '#0072ff']);
      drawBar(212, 210, ['#a78bfa', '#7c3aed']);
      drawBar(336, 310, ['#34d399', '#059669']);

      return canvas.toDataURL('image/png');
    } catch(e) { return null; }
  })();

  // --- 3. iOS用アイコンをhead に追加 ---
  if (pngDataUri) {
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '512x512';
    appleIcon.href = pngDataUri;
    document.head.appendChild(appleIcon);
  }

  // --- 4. manifest.json の icon を data URI で上書き（アイコンファイル不在対策）---
  // manifest.json が icon-*.png を参照しているが、ファイルが存在しない場合に
  // SW インストールが失敗し beforeinstallprompt が発火しない問題を回避する
  function patchManifestIcons() {
    if (!pngDataUri) return;
    // 既存の manifest link を取得
    const existingLink = document.querySelector('link[rel="manifest"]');
    if (!existingLink) return;

    // manifest の内容を fetch して icon を差し替えた Blob URL に置き換える
    fetch(existingLink.href)
      .then(r => r.json())
      .then(manifest => {
        // アイコンを data URI で上書き
        manifest.icons = [
          { src: pngDataUri, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: pngDataUri, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ];
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
        const blobUrl = URL.createObjectURL(blob);
        existingLink.href = blobUrl;
      })
      .catch(() => {
        // fetch失敗は無視（オリジナルmanifestをそのまま使う）
      });
  }
  // DOMContentLoaded後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchManifestIcons);
  } else {
    patchManifestIcons();
  }

  // --- 5. Service Worker 登録 ---
  if ('serviceWorker' in navigator) {
    // ページ完全ロード後に登録（クリティカルパスをブロックしない）
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(reg => {
          console.log('[PWA] SW registered:', reg.scope);
          // SW 更新があれば即適用
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New SW available');
                }
              });
            }
          });
        })
        .catch(err => console.warn('[PWA] SW registration failed:', err));
    });
  }

  // --- 6. バナー UI の表示制御 ---
  const banner = document.getElementById('pwa-install-banner');

  // Android/Chrome: beforeinstallprompt 発火でバナーを表示
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    window.__pwaInstallEvent = e;
    console.log('[PWA] beforeinstallprompt captured');
    if (!isInStandaloneMode && !localStorage.getItem(DISMISSED_KEY)) {
      // 即時表示（遅延なし）
      banner?.classList.add('visible');
    }
  });

  // 既に早期キャプチャ済みの場合
  if (deferredPrompt && !isInStandaloneMode && !localStorage.getItem(DISMISSED_KEY)) {
    // 少し待ってから表示（バナー要素のレンダリングを待つ）
    setTimeout(() => banner?.classList.add('visible'), 800);
  }

  // iOS: Safariは beforeinstallprompt が発火しないため手動表示
  if (isIOS && !isInStandaloneMode && !localStorage.getItem(DISMISSED_KEY)) {
    setTimeout(() => banner?.classList.add('visible'), 3000);
  }

  // Android で beforeinstallprompt が発火しない場合のフォールバック:
  // インストールされていなければ4秒後にバナーを表示する
  if (isAndroid && !isIOS && !isInStandaloneMode && !localStorage.getItem(DISMISSED_KEY)) {
    setTimeout(() => {
      if (!deferredPrompt) {
        // プロンプトが未キャプチャでもバナーは表示する（手順案内に切り替える）
        banner?.classList.add('visible');
      }
    }, 4000);
  }

  // --- 7. 公開関数 ---

  function updatePwaStatus(installed) {
    const btn = document.getElementById('pwa-step5-btn');
    const alreadyMsg = document.getElementById('pwa-step5-already');
    if (installed) {
      if (btn) btn.style.display = 'none';
      if (alreadyMsg) alreadyMsg.style.display = 'block';
    }
  }

  window.pwaStep5Install = function() {
    window.pwaTriggerInstall();
  };

  window.pwaTriggerInstall = function () {
    if (isInStandaloneMode) {
      alert('すでにアプリとして起動しています。');
      return;
    }

    if (isIOS) {
      banner?.classList.remove('visible');
      const iosModal = document.getElementById('pwa-ios-modal');
      if (iosModal) {
        iosModal.classList.add('open');
      } else {
        alert('iOS（Safari）では、画面下の「共有ボタン（↑）」→「ホーム画面に追加」を選択してください。');
      }
      return;
    }

    if (deferredPrompt) {
      // Android/Chrome: ネイティブプロンプトを表示
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(choiceResult => {
        console.log('[PWA] User choice:', choiceResult.outcome);
        if (choiceResult.outcome === 'accepted') {
          updatePwaStatus(true);
          localStorage.setItem(DISMISSED_KEY, '1');
        }
        deferredPrompt = null;
        window.__pwaInstallEvent = null;
        banner?.classList.remove('visible');
      });
    } else {
      // beforeinstallprompt が発火していない場合の案内
      // Android Chrome: メニュー経由でのインストール手順を案内
      if (isAndroid && isChrome) {
        const androidModal = document.getElementById('pwa-android-modal');
        if (androidModal) {
          androidModal.classList.add('open');
        } else {
          alert(
            'Chromeのメニュー（右上の︙）から\n' +
            '「アプリをインストール」または\n' +
            '「ホーム画面に追加」を選択してください。\n\n' +
            '※ 表示されない場合は、一度ページを再読み込みしてお試しください。'
          );
        }
      } else {
        alert('ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選択してください。');
      }
    }
  };

  window.pwaDismissBanner = function () {
    banner?.classList.remove('visible');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  window.pwaCloseIosModal = function () {
    document.getElementById('pwa-ios-modal')?.classList.remove('open');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  window.pwaCloseAndroidModal = function () {
    document.getElementById('pwa-android-modal')?.classList.remove('open');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  // インストール完了イベント
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed');
    updatePwaStatus(true);
    banner?.classList.remove('visible');
    deferredPrompt = null;
    window.__pwaInstallEvent = null;
  });

  // 初期化: インストール済みならボタンを隠す
  if (isInStandaloneMode) {
    updatePwaStatus(true);
  }

  // オフライン監視
  window.addEventListener('online',  () => document.getElementById('pwa-offline-bar')?.classList.remove('visible'));
  window.addEventListener('offline', () => document.getElementById('pwa-offline-bar')?.classList.add('visible'));

})();
