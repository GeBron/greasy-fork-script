// ==UserScript==
// @name         X (Twitter) 官方小鸟图标修复 / Chirp Bird Glyph Fix
// @namespace    https://greasyfork.org/users/twitter-bird-fix
// @version      1.0
// @description  修复部分系统(如 Windows)上无法显示的用户名小鸟图标(U+EA00 私有区字符),通过引用 X 官方 Chirp 字体还原真实图标
// @author       GeBron
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL https://update.greasyfork.org/scripts/587068/X%20%28Twitter%29%20%E5%AE%98%E6%96%B9%E5%B0%8F%E9%B8%9F%E5%9B%BE%E6%A0%87%E4%BF%AE%E5%A4%8D%20%20Chirp%20Bird%20Glyph%20Fix.user.js
// @updateURL https://update.greasyfork.org/scripts/587068/X%20%28Twitter%29%20%E5%AE%98%E6%96%B9%E5%B0%8F%E9%B8%9F%E5%9B%BE%E6%A0%87%E4%BF%AE%E5%A4%8D%20%20Chirp%20Bird%20Glyph%20Fix.meta.js
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

  // 不等浏览器"被动发现"需要这个字体才去下载,而是脚本一启动就主动预加载,
  // 避免首次访问时下载没赶上初次渲染、导致方块字符没能及时被替换成小鸟图标
  const preloadFont = new FontFace(
    'ChirpBirdGlyph',
    `url('${FONT_URL}') format('woff2')`,
    { unicodeRange: 'U+EA00' }
  );
  preloadFont
    .load()
    .then((loadedFont) => {
      document.fonts.add(loadedFont);
      scanAndFix(document.body); // 字体就绪后,把已经渲染成方块的文字重新刷一遍
    })
    .catch(() => {
      // 预加载失败时静默忽略,不影响页面其他功能
    });

  function fixElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    const current = getComputedStyle(el).fontFamily;
    if (current.includes('ChirpBirdGlyph')) return;
    // 放在字体列表最前面,而不是追加到最后:
    // U+EA00 这个私有区码位也常被各类图标字体(Font Awesome / IcoFont / Bootstrap Icons 等)占用,
    // 如果排在后面,一旦前面出现任意一个也覆盖了这个码位的图标字体,就会被截胡、显示成不相关的图标。
    // 由于这里限定了 unicode-range: U+EA00,放在最前面也不会影响其他文字正常显示。
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

    // X 使用虚拟滚动列表,节点会被复用并直接改写文字内容,
    // 因此需要同时监听 childList 和 characterData 两种变化
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

    // 兜底方案:X 的列表存在视口外内容延迟渲染等情况,
    // MutationObserver 不一定总能第一时间捕捉到,用低频定时扫描保险
    setInterval(() => scanAndFix(document.body), 800);

    // X 的页面切换是通过 History API 做的(不会整页刷新),
    // 监听路由变化后延迟多扫几次,覆盖切换页面瞬间新渲染出来的内容
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
