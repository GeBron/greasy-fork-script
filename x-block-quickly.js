// ==UserScript==
// @name         X.com 评论区 Grok 图标替换为快速屏蔽
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  仅在推文详情页，把评论区 Grok 图标替换为同尺寸同风格的快速屏蔽按钮
// @author       GeBron
// @match        https://x.com/*/status/*
// @match        https://twitter.com/*/status/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    function isStatusPage() {
        return /\/status\/\d+/.test(location.pathname);
    }
    if (!isStatusPage()) return;

    const PROCESSED_ATTR = 'data-quick-block-processed';
    const CLICK_DELAY = 280;

    // 官方风格的屏蔽图标（保持和原 Grok SVG 相同的 viewBox 与尺寸）
    const BLOCK_SVG = `
        <svg viewBox="0 0 24 24" aria-hidden="true" class="r-4qtqp9 r-yyyyoo r-dnmrzs r-bnwqim r-lrvibr r-m6rg5j r-1xvli5t r-1hdv0qi">
            <g>
                <path d="M12 3.75c-4.55 0-8.25 3.69-8.25 8.25 0 1.92.66 3.68 1.75 5.08L17.09 5.5C15.68 4.4 13.92 3.75 12 3.75zm6.5 3.17L6.92 18.5c1.4 1.1 3.16 1.75 5.08 1.75 4.56 0 8.25-3.69 8.25-8.25 0-1.92-.65-3.68-1.75-5.08zM1.75 12C1.75 6.34 6.34 1.75 12 1.75S22.25 6.34 22.25 12 17.66 22.25 12 22.25 1.75 17.66 1.75 12z"></path>
            </g>
        </svg>
    `;

    function sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    function findParentArticle(el) {
        let cur = el;
        while (cur && cur !== document.body) {
            if (cur.tagName === 'ARTICLE' && cur.getAttribute('data-testid') === 'tweet') {
                return cur;
            }
            cur = cur.parentElement;
        }
        return null;
    }

    async function waitForSelector(selector, timeout = 2500) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(80);
        }
        return null;
    }

    async function quickBlock(article, btn) {
        btn.style.pointerEvents = 'none';
        btn.setAttribute('aria-label', '屏蔽中…');
        btn.title = '屏蔽中…';

        try {
            const caret = article.querySelector('button[data-testid="caret"]');
            if (!caret) throw new Error('找不到更多按钮');

            caret.click();
            await sleep(CLICK_DELAY);

            let blockItem = await waitForSelector('div[data-testid="block"]', 2200);
            if (!blockItem) {
                const items = document.querySelectorAll('[role="menuitem"]');
                for (const item of items) {
                    const text = (item.textContent || '').toLowerCase();
                    if (text.includes('block') || text.includes('屏蔽') || text.includes('封鎖') || text.includes('ブロック')) {
                        blockItem = item;
                        break;
                    }
                }
            }
            if (!blockItem) throw new Error('找不到屏蔽菜单项');

            blockItem.click();
            await sleep(CLICK_DELAY);

            const confirmBtn = await waitForSelector('button[data-testid="confirmationSheetConfirm"]', 2500);
            if (!confirmBtn) throw new Error('找不到确认按钮');

            confirmBtn.click();

            btn.setAttribute('aria-label', '已屏蔽');
            btn.title = '已屏蔽';
            article.style.opacity = '0.4';
            article.style.pointerEvents = 'none';

        } catch (err) {
            console.warn('[Quick Block]', err);
            btn.setAttribute('aria-label', '屏蔽失败');
            btn.title = '屏蔽失败，请重试';
            setTimeout(() => {
                btn.style.pointerEvents = '';
                btn.setAttribute('aria-label', '快速屏蔽此用户');
                btn.title = '快速屏蔽此用户';
            }, 1800);
        }
    }

    function processGrokButtons() {
        if (!isStatusPage()) return;

        const grokButtons = document.querySelectorAll(
            'button[aria-label="Grok actions"], ' +
            'button[aria-label*="Grok"], ' +
            'button[aria-label="Acciones de Grok"], ' +
            'button[aria-label*="Grok 操作"]'
        );

        grokButtons.forEach(grokBtn => {
            if (grokBtn.hasAttribute(PROCESSED_ATTR)) return;

            const article = findParentArticle(grokBtn);
            if (!article) return;

            grokBtn.setAttribute(PROCESSED_ATTR, '1');

            // 只替换内部 SVG，保留原按钮的所有 class、尺寸、边框、padding
            const svgContainer = grokBtn.querySelector('svg')?.parentElement || grokBtn;
            // 清空原有内容后插入新图标
            while (svgContainer.firstChild) {
                svgContainer.removeChild(svgContainer.firstChild);
            }
            svgContainer.insertAdjacentHTML('beforeend', BLOCK_SVG);

            // 更新提示文字
            grokBtn.setAttribute('aria-label', '快速屏蔽此用户');
            grokBtn.title = '快速屏蔽此用户';

            // 拦截点击，改为执行屏蔽
            grokBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                quickBlock(article, grokBtn);
            }, true); // 使用捕获阶段，确保优先拦截
        });
    }

    processGrokButtons();

    const observer = new MutationObserver(() => {
        processGrokButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // SPA 路由变化监听
    let lastPath = location.pathname;
    setInterval(() => {
        if (location.pathname !== lastPath) {
            lastPath = location.pathname;
            if (isStatusPage()) processGrokButtons();
        }
    }, 800);

    console.log('[X Quick Block] v1.4 原尺寸复用模式已加载');
})();
