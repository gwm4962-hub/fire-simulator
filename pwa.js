/**
 * pwa.js — PWAインストールバナー・Service Worker登録・オフライン対応
 * FLOW | 資産シミュレーター
 */
/* ===================================================================
   PWA コア — インストールバナー + オフライン検知
   =================================================================== */

(function () {
  'use strict';

  // --- 1. 設定と状態管理 ---
  const DISMISSED_KEY = 'pwa_banner_dismissed'; // 閉じた記録を保存する名前
  // 早期キャプチャ済みのイベントがあればそちらを使う
  let deferredPrompt = window.__pwaInstallEvent || null;

  // デバイスの判定
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // --- 2. アイコンの動的生成（Canvas） ---
  // 外部画像ファイルなしで、プログラムからPNGアイコンを生成します
  const pngDataUri = (function() {
    try {
      const S = 512; // アイコンのサイズ
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');

      // 角丸四角形を描く関数
      const rr = (x, y, w, h, r) => {
        ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y);
        ctx.quadraticCurveTo(x+w, y, x+w, y+r); ctx.lineTo(x+w, y+h-r);
        ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
        ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r);
        ctx.quadraticCurveTo(x, y, x+r, y); ctx.closePath();
      };

      // 背景（白）の描画
      ctx.fillStyle = '#ffffff'; rr(0, 0, S, S, 110); ctx.fill();

      // グラフ（バー）の描画設定
      const base = 390; const barW = 88; const barR = 16;
      const drawBar = (x, h, colors) => {
        const g = ctx.createLinearGradient(0, base-h, 0, base);
        g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
        ctx.fillStyle = g; rr(x, base-h, barW, h, barR); ctx.fill();
      };

      // 資産推移をイメージした3本のバー
      drawBar(88, 120, ['#00c6ff', '#0072ff']);   // 青系
      drawBar(212, 210, ['#a78bfa', '#7c3aed']); // 紫系
      drawBar(336, 310, ['#34d399', '#059669']); // 緑系

      return canvas.toDataURL('image/png'); // 画像データを文字列として出力
    } catch(e) { return null; }
  })();

  // --- 3. メタタグ: iOS用アイコンをCanvasで生成して設定 ---
  if (pngDataUri) {
    const appleIcon = document.createElement('link');
    appleIcon.rel = 'apple-touch-icon';
    appleIcon.sizes = '512x512';
    appleIcon.href = pngDataUri;
    document.head.appendChild(appleIcon);
  }
  // manifest.json は <head> に静的に記述済み（外部ファイル）

  // --- 4. Service Worker: 外部ファイル sw.js を登録 ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(reg => console.log('[PWA] SW registered:', reg.scope))
      .catch(err => console.warn('[PWA] SW registration failed:', err));
  }

  // --- 5. UI（バナー）の表示制御 ---
  const banner = document.getElementById('pwa-install-banner');
  
  // Android/Chrome：インストールボタンが出せる状態になったらバナーを表示
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    window.__pwaInstallEvent = e;
    if (!localStorage.getItem(DISMISSED_KEY) && !isInStandaloneMode) {
      setTimeout(() => banner?.classList.add('visible'), 1500);
    }
  });
  // 早期キャプチャ済みでバナーがまだ表示されていない場合の補完
  if (deferredPrompt && !localStorage.getItem(DISMISSED_KEY) && !isInStandaloneMode) {
    setTimeout(() => banner?.classList.add('visible'), 1500);
  }

  // iOS：Safariは自動検知できないため、3秒後に手動でバナーを表示
  if (isIOS && !isInStandaloneMode && !localStorage.getItem(DISMISSED_KEY)) {
    setTimeout(() => banner?.classList.add('visible'), 3000);
  }

  // --- 6. 公開関数（HTMLのボタンから呼び出す用） ---
  
// --- 6. 公開関数（HTMLのボタンから呼び出す用） ---

  // ボタン表示の更新用関数
  function updatePwaStatus(installed) {
    const btn = document.getElementById('pwa-step5-btn');
    const alreadyMsg = document.getElementById('pwa-step5-already');
    if (installed) {
      if (btn) btn.style.display = 'none';
      if (alreadyMsg) alreadyMsg.style.display = 'block';
    }
  }

  // 1. Android/PC用：インストールボタンが押されたとき
  window.pwaStep5Install = function() {
    window.pwaTriggerInstall();
  };

  window.pwaTriggerInstall = function () {
    if (isInStandaloneMode) {
      alert("すでにアプリとして起動しています。");
      return;
    }

    if (isIOS) {
      // iOS: Safariの共有メニューを促す
      banner?.classList.remove('visible');
      const iosModal = document.getElementById('pwa-ios-modal');
      if (iosModal) {
        iosModal.classList.add('open');
      } else {
        alert("iOS（Safari）では、画面下の『共有ボタン（上矢印のアイコン）』をタップし、『ホーム画面に追加』を選択してください。");
      }
    } else if (deferredPrompt) {
      // Android/Chrome: ブラウザのプロンプトを表示
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          updatePwaStatus(true);
        }
        deferredPrompt = null;
        window.__pwaInstallEvent = null;
        banner?.classList.remove('visible');
      });
    } else {
      // プロンプトがまだ準備できていない場合
      alert("ブラウザのメニュー（右上の縦3点マークなど）から「アプリをインストール」または「ホーム画面に追加」を選択してください。");
    }
  };

  // バナーを閉じる
  window.pwaDismissBanner = function () {
    banner?.classList.remove('visible');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  // iOS手順モーダルを閉じる
  window.pwaCloseIosModal = function () {
    document.getElementById('pwa-ios-modal')?.classList.remove('open');
    localStorage.setItem(DISMISSED_KEY, '1');
  };

  // 初期化：インストール済みならボタンを隠す
  if (isInStandaloneMode) {
    updatePwaStatus(true);
  }

  // オフライン監視
  window.addEventListener('online',  () => document.getElementById('pwa-offline-bar')?.classList.remove('visible'));
  window.addEventListener('offline', () => document.getElementById('pwa-offline-bar')?.classList.add('visible'));

})(); // ここでIIFEを閉じる
