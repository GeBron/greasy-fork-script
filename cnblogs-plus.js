// ==UserScript==
// @name         博客园增强：自动展开代码 + 标题新标签页打开
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动展开博客园折叠的代码块，并让博主主页的文章标题在新标签页打开
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
        const expandButtons = document.querySelectorAll('.code_img_closed');
        expandButtons.forEach(btn => {
            btn.click();
            // 修改类名防止重复点击
            btn.classList.replace('code_img_closed', 'code_img_opened');
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
        '#cb_post_title_url'     // 文章详情页标题
    ];

    function applyTargetBlank() {
        if (isCnblogsHomePage) return;
        titleSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(link => {
                if (link.tagName === 'A') {
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
    // 1. 页面加载后立即执行一次
    runAll();
    window.addEventListener('load', runAll);

    // 2. 监听 DOM 变化（覆盖异步加载 / 无限滚动等场景），比固定轮询更可靠
    const observer = new MutationObserver(debouncedRunAll);
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    // 3. 兜底：有限次数的轮询，覆盖 MutationObserver 可能遗漏的极端情况
    let count = 0;
    const timer = setInterval(() => {
        runAll();
        count++;
        if (count >= 5) clearInterval(timer);
    }, 2000);
})();
