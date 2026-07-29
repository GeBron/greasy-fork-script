// ==UserScript==
// @name         X (Twitter) 官方小鸟图标修复
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  修复 Windows 等系统上 X (Twitter) 用户名缺失 Chirp 字体导致的 U+EA00 小鸟图标显示为方块的问题
// @author       GeBron
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const FONT_URL = 'https://abs.twimg.com/fonts/chirp-regular-web.woff2';
  const TARGET_CHAR = '\uEA00';

  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: 'ChirpBirdGlyph';
      src: url('${FONT_URL}') format('woff2');
      font-weight: 400;
      font-style: normal;
      font-display: block;
      unicode-range: U+EA00;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // 主动预加载 Chirp 字体
  const preloadFont = new FontFace(
    'ChirpBirdGlyph',
    `url('${FONT_URL}') format('woff2')`,
    { unicodeRange: 'U+EA00' }
  );
  preloadFont
    .load()
    .then((loadedFont) => {
      document.fonts.add(loadedFont);
      if (document.body) scanAndFix(document.body);
    })
    .catch(() => {});

  function fixElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    const current = getComputedStyle(el).fontFamily;
    if (current.includes('ChirpBirdGlyph')) return;
    el.style.fontFamily = `'ChirpBirdGlyph', ${current}`;
  }

  function scanAndFix(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.nodeValue && node.nodeValue.includes(TARGET_CHAR)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_SKIP,
    });

    let node;
    while ((node = walker.nextNode())) {
      fixElement(node.parentElement);
    }
  }

  function start() {
    if (!document.body) {
      requestAnimationFrame(start);
      return;
    }

    scanAndFix(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((n) => {
            if (n.nodeType === Node.ELEMENT_NODE) {
              scanAndFix(n);
            } else if (n.nodeType === Node.TEXT_NODE && n.nodeValue && n.nodeValue.includes(TARGET_CHAR)) {
              fixElement(n.parentElement);
            }
          });
        } else if (mutation.type === 'characterData') {
          const target = mutation.target;
          if (target.nodeValue && target.nodeValue.includes(TARGET_CHAR)) {
            fixElement(target.parentElement);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    setInterval(() => scanAndFix(document.body), 800);

    function triggerRescan() {
      [100, 300, 600, 1200].forEach((delay) => {
        setTimeout(() => scanAndFix(document.body), delay);
      });
    }

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      triggerRescan();
    };
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      triggerRescan();
    };
    window.addEventListener('popstate', triggerRescan);
  }

  start();
})();
