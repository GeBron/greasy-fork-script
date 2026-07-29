// ==UserScript==
// @name         博客园体验增强 (Cnblogs Plus)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动展开博客园折叠的代码块，并使文章标题链接在点击时于新标签页打开
// @author       GeBron
// @match        *://www.cnblogs.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // 功能一：自动展开折叠状态的代码块
    // ---------------------------------------------------------------
    function expandCode() {
        const expandButtons = document.querySelectorAll('.code_img_closed, .cnblogs_code_hide');
        expandButtons.forEach(btn => {
            if (btn.classList.contains('code_img_closed')) {
                btn.click();
                btn.classList.replace('code_img_closed', 'code_img_opened');
            } else if (btn.classList.contains('cnblogs_code_hide')) {
                btn.click();
                btn.classList.remove('cnblogs_code_hide');
            }
        });
    }

    // ---------------------------------------------------------------
    // 功能二：文章标题新标签页打开
    // 注意：博客园官方首页（www.cnblogs.com/ 或 www.cnblogs.com）
    // 不是博主个人主页，这里跳过该功能，但代码展开功能仍然生效
    // ---------------------------------------------------------------
    const isCnblogsHomePage = /^\/?$/.test(location.pathname);

    const titleSelectors = [
        '.postTitle a',          // 常用模板
        '.postTitle2',           // 常用模板2
        '.entrylistPosttitle a', // 随笔列表模板
        '.post-item-title',      // 新版列表模板
        '#cb_post_title_url'     // 文章详情页标题
    ];

    function applyTargetBlank() {
        if (isCnblogsHomePage) return;
        titleSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(link => {
                if (link.tagName === 'A' && link.getAttribute('target') !== '_blank') {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            });
        });
    }

    function runAll() {
        expandCode();
        applyTargetBlank();
    }

    // ---------------------------------------------------------------
    // 简单防抖，避免 MutationObserver 在短时间内被高频触发
    // ---------------------------------------------------------------
    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    const debouncedRunAll = debounce(runAll, 300);

    // ---------------------------------------------------------------
    // 初始化
    // ---------------------------------------------------------------
    runAll();
    window.addEventListener('load', runAll);

    const observer = new MutationObserver(debouncedRunAll);
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    // 兜底：有限次数轮询，覆盖延迟渲染/异步代码块
    let count = 0;
    const timer = setInterval(() => {
        runAll();
        count++;
        if (count >= 5) clearInterval(timer);
    }, 2000);
})();
