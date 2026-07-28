// ==UserScript==
// @name         X.com 评论区 Grok 图标替换为快速屏蔽
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       GeBron
// @description X.com 评论区 Grok 图标替换为快速屏蔽用户
// @match        https://x.com/*/status/*
// @match        https://twitter.com/*/status/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
 
(function () {
    'use strict';
 
    // 只在详情页运行
    function isStatusPage() {
        return /\/status\/\d+/.test(location.pathname);
    }
 
    if (!isStatusPage()) return;
 
    const BUTTON_CLASS = 'x-quick-block-btn';
    const PROCESSED_ATTR = 'data-quick-block-processed';
    const CLICK_DELAY = 280;
 
    const style = document.createElement('style');
    style.textContent = `
        .${BUTTON_CLASS} {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34.75px;
            height: 34.75px;
            padding: 0;
            margin: 0;
            border: none;
            border-radius: 9999px;
            background-color: transparent;
            color: rgb(113, 118, 123);
            cursor: pointer;
            transition: color 0.2s, background-color 0.2s;
            flex-shrink: 0;
        }
        .${BUTTON_CLASS}:hover {
            color: rgb(244, 33, 46);
            background-color: rgba(244, 33, 46, 0.1);
        }
        .${BUTTON_CLASS}:active {
            transform: scale(0.92);
        }
        .${BUTTON_CLASS}:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            pointer-events: none;
        }
        .${BUTTON_CLASS} svg {
            width: 18.75px;
            height: 18.75px;
            fill: currentColor;
            pointer-events: none;
        }
        .${BUTTON_CLASS}.success {
            color: rgb(0, 186, 124);
        }
        .${BUTTON_CLASS}.error {
            color: rgb(255, 160, 0);
        }
    `;
    document.head.appendChild(style);
 
    const BLOCK_SVG = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
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
        btn.disabled = true;
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
 
            btn.classList.add('success');
            btn.title = '已屏蔽';
            article.style.opacity = '0.4';
            article.style.pointerEvents = 'none';
 
        } catch (err) {
            console.warn('[Quick Block]', err);
            btn.classList.add('error');
            btn.title = '屏蔽失败，请重试';
            setTimeout(() => {
                btn.disabled = false;
                btn.classList.remove('error');
                btn.title = '快速屏蔽此用户';
            }, 1800);
        }
    }
 
    function processGrokButtons() {
        if (!isStatusPage()) return;   // SPA 跳转到非详情页时立即停止
 
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
            grokBtn.style.display = 'none';
 
            const blockBtn = document.createElement('button');
            blockBtn.className = BUTTON_CLASS;
            blockBtn.type = 'button';
            blockBtn.title = '快速屏蔽此用户';
            blockBtn.innerHTML = BLOCK_SVG;
 
            blockBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                quickBlock(article, blockBtn);
            });
 
            const parent = grokBtn.parentElement;
            if (parent) {
                parent.insertBefore(blockBtn, grokBtn);
            } else {
                const header = article.querySelector('div[data-testid="User-Name"]')?.closest('div') || article;
                header.appendChild(blockBtn);
            }
        });
    }
 
    processGrokButtons();
 
    const observer = new MutationObserver(() => {
        processGrokButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
 
    // 监听 SPA 路由变化（从首页点进详情页 / 从详情页返回）
    let lastPath = location.pathname;
    setInterval(() => {
        if (location.pathname !== lastPath) {
            lastPath = location.pathname;
            if (isStatusPage()) {
                processGrokButtons();
            }
        }
    }, 800);
 
    console.log('[X Quick Block] 仅详情页模式已加载');
})();
