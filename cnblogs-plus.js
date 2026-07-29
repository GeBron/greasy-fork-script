// ==UserScript==
// @name         博客园体验增强 (Cnblogs Plus)
// @namespace    http://tampermonkey.net/
// @version      1.2
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
        // 遍历所有代码块容器
        const containers = document.querySelectorAll('.cnblogs_code');

        containers.forEach(container => {
            // 1. 处理旧版图标按钮（.code_img_closed）
            const oldIconBtn = container.querySelector('.code_img_closed:not([data-cnblogs-plus-expanded])');
            if (oldIconBtn) {
                oldIconBtn.setAttribute('data-cnblogs-plus-expanded', 'true');
                oldIconBtn.click();
                return; // 每个代码块容器仅触发一次，防止重复
            }

            // 2. 处理新版文字链接按钮（.cnblogs_code_hide）
            const newTextBtn = container.querySelector('.cnblogs_code_hide:not([data-cnblogs-plus-expanded])');
            if (newTextBtn) {
                newTextBtn.setAttribute('data-cnblogs-plus-expanded', 'true');
                newTextBtn.click();
                return;
            }
        });
    }

    // ---------------------------------------------------------------
    // 功能二：文章标题新标签页打开
    // 说明：博客园官方首页跳过该逻辑，但代码展开逻辑仍会生效
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
    // 防抖逻辑：避免 MutationObserver 高频触发
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
    // 初始化与页面监听
    // ---------------------------------------------------------------
    runAll();
    window.addEventListener('load', runAll);

    // 监听 DOM 动态变更（覆盖异步渲染与动态加载内容）
    const observer = new MutationObserver(debouncedRunAll);
    const targetNode = document.body || document.documentElement;
    if (targetNode) {
        observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }

    // 有限次数轮询兜底
    let count = 0;
    const timer = setInterval(() => {
        runAll();
        count++;
        if (count >= 5) clearInterval(timer);
    }, 2000);
})();
