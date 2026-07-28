// ==UserScript==
// @name         X.com 评论屏蔽词过滤
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  仅在推文详情页屏蔽包含自定义关键词的评论，并支持一键真正屏蔽用户
// @author       GeBron
// @match        https://x.com/*/status/*
// @match        https://twitter.com/*/status/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=x.com
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 配置 ====================
    const STORAGE_KEY = 'x_comment_block_words_v1';
    const DEFAULT_WORDS = [
        { word: '同城上门', type: 'user' },
    ];

    // ==================== 工具函数 ====================
    function loadWords() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return [...DEFAULT_WORDS];
    }

    function saveWords(words) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
    }

    // ==================== 已"真正屏蔽"的用户记录 ====================
    // 避免：真正屏蔽某用户后，再次点击"显示当前匹配用户"时又把他重新列出来
    const REALLY_BLOCKED_KEY = 'x_comment_really_blocked_users_v1';

    function loadReallyBlocked() {
        try {
            const raw = localStorage.getItem(REALLY_BLOCKED_KEY);
            if (raw) return new Set(JSON.parse(raw));
        } catch (e) {}
        return new Set();
    }

    function saveReallyBlocked(set) {
        localStorage.setItem(REALLY_BLOCKED_KEY, JSON.stringify([...set]));
    }

    let blockWords = loadWords();
    let reallyBlockedHandles = loadReallyBlocked();
    let currentTab = 'user'; // 'user' | 'content'
    let hasBlockedOnPage = false;

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    async function blockUser(screenName) {
        if (!screenName) return { success: false, message: '无用户名' };

        const pureName = screenName.replace(/^@/, '');
        const ct0 = getCookie('ct0');
        if (!ct0) {
            return { success: false, message: '未获取到 CSRF Token，请确保已登录' };
        }

        const url = 'https://x.com/i/api/1.1/blocks/create.json';

        try {
            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                    'content-type': 'application/x-www-form-urlencoded',
                    'x-csrf-token': ct0,
                    'x-twitter-auth-type': 'OAuth2Session',
                    'x-twitter-active-user': 'yes',
                    'x-twitter-client-language': 'en',
                },
                body: `screen_name=${encodeURIComponent(pureName)}`
            });

            if (res.ok) {
                return { success: true, message: '已成功屏蔽' };
            } else {
                const text = await res.text();
                console.error('屏蔽失败:', res.status, text);
                return { success: false, message: `屏蔽失败 (${res.status})` };
            }
        } catch (err) {
            console.error(err);
            return { success: false, message: '网络错误' };
        }
    }

    function getUserInfo(article) {
        const userNameEl = article.querySelector('[data-testid="User-Name"]');
        if (!userNameEl) return null;

        const fullText = (userNameEl.innerText || userNameEl.textContent || '').trim();
        const handleMatch = fullText.match(/@(\w+)/);
        const handle = handleMatch ? '@' + handleMatch[1] : '';
        let displayName = fullText.replace(/@\w+/g, '').replace(/\s+/g, ' ').trim();

        const textEl = article.querySelector('[data-testid="tweetText"]');
        let content = textEl ? (textEl.innerText || textEl.textContent || '').trim() : '';

        return {
            displayName: displayName || '未知用户',
            handle: handle,
            pureHandle: handle ? handle.replace(/^@/, '') : '',
            fullText: fullText,
            content: content
        };
    }

    function shouldHide(article) {
        const userNameEl = article.querySelector('[data-testid="User-Name"]');
        let userText = userNameEl ? (userNameEl.innerText || userNameEl.textContent || '') : '';

        // 已经"真正屏蔽"过的用户，直接判定为需要隐藏
        const handleMatch = userText.match(/@(\w+)/);
        if (handleMatch && reallyBlockedHandles.has(handleMatch[1])) {
            return true;
        }

        const textEl = article.querySelector('[data-testid="tweetText"]');
        let contentText = textEl ? (textEl.innerText || textEl.textContent || '') : '';

        for (const item of blockWords) {
            const w = item.word.trim().toLowerCase();
            if (!w) continue;

            if (item.type === 'user') {
                if (userText.toLowerCase().includes(w)) return true;
            } else if (item.type === 'content') {
                if (contentText.toLowerCase().includes(w)) return true;
            }
        }
        return false;
    }

    // 更新按钮颜色提示
    function updateButtonColor(hasBlocked) {
        const btn = document.getElementById('x-block-btn');
        if (!btn) return;

        hasBlockedOnPage = hasBlocked;

        if (hasBlocked) {
            // 有被屏蔽的评论 → 红色提示
            btn.style.background = '#f4212e';
            btn.style.color = '#ffffff';
            btn.title = '当前页面有评论被屏蔽（点击管理）';
        } else {
            // 没有 → 恢复白色
            btn.style.background = '#ffffff';
            btn.style.color = '#0f1419';
            btn.title = '评论屏蔽词';
        }
    }

    function processArticles() {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        let blockedCount = 0;

        articles.forEach(article => {
            // 已经处理过的，检查是否被我们隐藏
            if (article.dataset.blockProcessed === '1') {
                if (article.dataset.blockedByScript === '1' || article.style.display === 'none') {
                    blockedCount++;
                }
                return;
            }

            if (shouldHide(article)) {
                article.style.display = 'none';
                article.dataset.blockedByScript = '1';
                blockedCount++;
            }
            article.dataset.blockProcessed = '1';
        });

        // 额外再统计一次所有被我们隐藏的
        const allBlocked = document.querySelectorAll('article[data-testid="tweet"][data-blocked-by-script="1"]');
        updateButtonColor(allBlocked.length > 0 || blockedCount > 0);
    }

    const observer = new MutationObserver(() => {
        setTimeout(processArticles, 150);
    });

    function startObserver() {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        processArticles();
    }

    function createPanel() {
        if (document.getElementById('x-block-btn')) return;

        // ===== 浮动按钮 =====
        const btn = document.createElement('div');
        btn.id = 'x-block-btn';
        btn.title = '评论屏蔽词';
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
        `;
        btn.style.cssText = `
            position: fixed;
            bottom: 160px;
            right: 20px;
            z-index: 99999;
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: #ffffff;
            border: none;
            color: #0f1419;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08);
            transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease;
            user-select: none;
        `;

        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.06)';
            btn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.15), 0 6px 16px rgba(0,0,0,0.1)';
            if (!hasBlockedOnPage) {
                btn.style.background = '#f7f9f9';
            }
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)';
            // 颜色由 updateButtonColor 控制，这里不强制改
            if (!hasBlockedOnPage) {
                btn.style.background = '#ffffff';
            }
        });

        document.body.appendChild(btn);

        // ===== 面板 =====
        const panel = document.createElement('div');
        panel.id = 'x-block-panel';
        panel.style.cssText = `
            display: none;
            position: fixed;
            bottom: 220px;
            right: 20px;
            width: 380px;
            max-height: 75vh;
            overflow: hidden;
            flex-direction: column;
            background: #15202b;
            border: 1px solid #38444d;
            border-radius: 16px;
            padding: 16px;
            z-index: 99999;
            color: #e7e9ea;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        `;

        panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-shrink:0;">
                <strong style="font-size:16px;">评论屏蔽词</strong>
                <span id="x-block-close" style="cursor:pointer;font-size:22px;line-height:1;color:#8b98a5;">×</span>
            </div>

            <!-- Tab 切换 -->
            <div style="display:flex;gap:0;margin-bottom:12px;border-bottom:1px solid #38444d;flex-shrink:0;">
                <div id="x-tab-user" class="x-tab active" data-tab="user"
                    style="flex:1;text-align:center;padding:8px 0;cursor:pointer;font-size:14px;font-weight:600;color:#1d9bf0;border-bottom:2px solid #1d9bf0;">
                    用户名
                </div>
                <div id="x-tab-content" class="x-tab" data-tab="content"
                    style="flex:1;text-align:center;padding:8px 0;cursor:pointer;font-size:14px;font-weight:600;color:#8b98a5;border-bottom:2px solid transparent;">
                    内容
                </div>
            </div>

            <!-- 列表区域（可滚动） -->
            <div id="x-block-list" style="flex:1;overflow-y:auto;margin-bottom:12px;min-height:60px;max-height:180px;"></div>

            <!-- 添加区域 -->
            <div style="flex-shrink:0;">
                <div style="display:flex;gap:8px;margin-bottom:10px;">
                    <input id="x-block-input" type="text" placeholder="输入屏蔽词"
                        style="flex:1;padding:9px 12px;border-radius:9999px;border:1px solid #38444d;background:#192734;color:#e7e9ea;outline:none;font-size:14px;">
                </div>
                <button id="x-block-add"
                    style="width:100%;padding:10px;background:#1d9bf0;border:none;border-radius:9999px;color:white;font-weight:700;cursor:pointer;font-size:14px;margin-bottom:12px;">
                    添加
                </button>
            </div>

            <!-- 匹配用户区域 -->
            <div style="border-top:1px solid #38444d;padding-top:12px;flex-shrink:0;">
                <button id="x-show-matched"
                    style="width:100%;padding:10px;background:#192734;border:1px solid #38444d;border-radius:9999px;color:#e7e9ea;font-weight:600;cursor:pointer;font-size:14px;">
                    显示当前匹配用户
                </button>
                <div id="x-matched-list" style="margin-top:12px;display:none;max-height:220px;overflow-y:auto;"></div>
            </div>
        `;
        document.body.appendChild(panel);

        function updateTabStyle() {
            const tabUser = document.getElementById('x-tab-user');
            const tabContent = document.getElementById('x-tab-content');

            if (currentTab === 'user') {
                tabUser.style.color = '#1d9bf0';
                tabUser.style.borderBottom = '2px solid #1d9bf0';
                tabContent.style.color = '#8b98a5';
                tabContent.style.borderBottom = '2px solid transparent';
            } else {
                tabContent.style.color = '#1d9bf0';
                tabContent.style.borderBottom = '2px solid #1d9bf0';
                tabUser.style.color = '#8b98a5';
                tabUser.style.borderBottom = '2px solid transparent';
            }
        }

        function renderList() {
            const list = document.getElementById('x-block-list');
            list.innerHTML = '';

            const filtered = blockWords.filter(item => item.type === currentTab);

            if (filtered.length === 0) {
                list.innerHTML = `<div style="color:#8b98a5;font-size:13px;padding:12px 0;text-align:center;">暂无${currentTab === 'user' ? '用户名' : '内容'}屏蔽词</div>`;
                return;
            }

            filtered.forEach((item) => {
                const realIndex = blockWords.findIndex(w => w === item);

                const row = document.createElement('div');
                row.style.cssText = `
                    display:flex;justify-content:space-between;align-items:center;
                    padding:8px 0;border-bottom:1px solid #38444d;font-size:14px;
                `;
                row.innerHTML = `
                    <span style="word-break:break-all;">${item.word}</span>
                    <span class="x-del" data-idx="${realIndex}" style="color:#f4212e;cursor:pointer;font-size:13px;padding:2px 6px;flex-shrink:0;">删除</span>
                `;
                list.appendChild(row);
            });

            list.querySelectorAll('.x-del').forEach(el => {
                el.addEventListener('click', () => {
                    const i = parseInt(el.dataset.idx);
                    blockWords.splice(i, 1);
                    saveWords(blockWords);
                    renderList();
                    // 重新扫描
                    document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
                        a.dataset.blockProcessed = '';
                        a.dataset.blockedByScript = '';
                        a.style.display = '';
                    });
                    processArticles();
                });
            });
        }

        renderList();
        updateTabStyle();

        document.getElementById('x-tab-user').addEventListener('click', () => {
            currentTab = 'user';
            updateTabStyle();
            renderList();
        });
        document.getElementById('x-tab-content').addEventListener('click', () => {
            currentTab = 'content';
            updateTabStyle();
            renderList();
        });

        function showMatchedUsers() {
            const matchedContainer = document.getElementById('x-matched-list');
            matchedContainer.style.display = 'block';
            matchedContainer.innerHTML = '<div style="color:#8b98a5;font-size:13px;padding:6px 0;">正在扫描...</div>';

            const matchedList = [];

            const articles = document.querySelectorAll('article[data-testid="tweet"]');
            articles.forEach(article => {
                if (shouldHide(article) || article.dataset.blockedByScript === '1') {
                    const info = getUserInfo(article);
                    if (!info || !info.pureHandle) return;
                    if (reallyBlockedHandles.has(info.pureHandle)) return; // 已经真正屏蔽过，不再重复显示
                    matchedList.push(info);
                }
            });

            matchedContainer.innerHTML = '';

            if (matchedList.length === 0) {
                matchedContainer.innerHTML = '<div style="color:#8b98a5;font-size:13px;padding:8px 0;">当前页面没有匹配到被屏蔽的用户</div>';
                return;
            }

            const title = document.createElement('div');
            title.id = 'x-matched-title';
            title.style.cssText = 'font-size:13px;color:#8b98a5;margin-bottom:8px;';
            title.textContent = `共找到 ${matchedList.length} 条匹配评论：`;
            matchedContainer.appendChild(title);

            // 移除某一行后，刷新计数 / 空状态提示
            function refreshMatchedState() {
                const remaining = matchedContainer.querySelectorAll('.x-real-block').length;
                if (remaining === 0) {
                    matchedContainer.innerHTML = '<div style="color:#8b98a5;font-size:13px;padding:8px 0;">当前页面没有匹配到被屏蔽的用户</div>';
                } else {
                    const titleEl = document.getElementById('x-matched-title');
                    if (titleEl) titleEl.textContent = `共找到 ${remaining} 条匹配评论：`;
                }
            }

            matchedList.forEach((info) => {
                const row = document.createElement('div');
                row.style.cssText = `
                    padding:10px 0;
                    border-bottom:1px solid #38444d;
                    font-size:13px;
                    overflow:hidden;
                    transition: opacity 0.25s ease, max-height 0.25s ease, padding 0.25s ease, margin 0.25s ease;
                `;

                const safeContent = (info.content || '(无文字内容)').replace(/</g, '&lt;').replace(/>/g, '&gt;');

                row.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px;">
                        <div style="flex:1;overflow:hidden;">
                            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${info.displayName}</div>
                            <div style="color:#8b98a5;font-size:12px;">${info.handle}</div>
                        </div>
                        <button class="x-real-block" data-handle="${info.pureHandle}"
                            style="flex-shrink:0;padding:5px 12px;background:#f4212e;border:none;border-radius:9999px;color:white;font-size:12px;cursor:pointer;font-weight:600;">
                            屏蔽用户
                        </button>
                    </div>
                    <div style="color:#c4cfd6;font-size:13px;line-height:1.4;word-break:break-word;background:#192734;padding:8px 10px;border-radius:8px;">
                        ${safeContent}
                    </div>
                `;

                matchedContainer.appendChild(row);

                const blockBtn = row.querySelector('.x-real-block');
                blockBtn.addEventListener('click', async () => {
                    const handle = blockBtn.dataset.handle;
                    if (!handle) return;

                    const originalText = blockBtn.textContent;
                    blockBtn.textContent = '屏蔽中...';
                    blockBtn.disabled = true;
                    blockBtn.style.opacity = '0.7';

                    const result = await blockUser(handle);

                    if (result.success) {
                        blockBtn.textContent = '已屏蔽';
                        blockBtn.style.background = '#00ba7c';

                        // 记录为"已真正屏蔽"，避免下次扫描又把该用户列出来
                        reallyBlockedHandles.add(handle);
                        saveReallyBlocked(reallyBlockedHandles);

                        // 短暂展示"已屏蔽"状态后，淡出并移除这条记录
                        setTimeout(() => {
                            row.style.opacity = '0';
                            row.style.maxHeight = '0px';
                            row.style.paddingTop = '0';
                            row.style.paddingBottom = '0';
                            row.style.marginBottom = '0';
                            row.style.borderBottom = 'none';

                            row.addEventListener('transitionend', () => {
                                row.remove();
                                refreshMatchedState();
                            }, { once: true });
                        }, 600);
                    } else {
                        blockBtn.textContent = '失败';
                        blockBtn.style.background = '#536471';
                        setTimeout(() => {
                            blockBtn.textContent = originalText;
                            blockBtn.disabled = false;
                            blockBtn.style.opacity = '1';
                            blockBtn.style.background = '#f4212e';
                        }, 2000);
                        alert('屏蔽失败：' + result.message);
                    }
                });
            });
        }

        btn.addEventListener('click', () => {
            const isHidden = panel.style.display === 'none' || panel.style.display === '';
            panel.style.display = isHidden ? 'flex' : 'none';
        });

        document.getElementById('x-block-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        document.getElementById('x-block-add').addEventListener('click', () => {
            const input = document.getElementById('x-block-input');
            const word = input.value.trim();
            if (!word) return;

            blockWords.push({ word, type: currentTab });
            saveWords(blockWords);
            input.value = '';
            renderList();

            document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
                a.dataset.blockProcessed = '';
                a.dataset.blockedByScript = '';
                a.style.display = '';
            });
            processArticles();
        });

        document.getElementById('x-block-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                document.getElementById('x-block-add').click();
            }
        });

        document.getElementById('x-show-matched').addEventListener('click', showMatchedUsers);
    }

    function init() {
        createPanel();
        startObserver();
        setTimeout(processArticles, 800);
        setTimeout(processArticles, 2000);
        setTimeout(processArticles, 4000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
