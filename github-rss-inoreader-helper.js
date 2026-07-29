// ==UserScript==
// @name         GitHub RSS & Inoreader Helper
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  在 GitHub 仓库侧边栏注入 RSS 订阅区域（Tags/Releases/Issues/Commits），支持一键导入 Inoreader 和快捷复制 Feed 链接
// @author       GeBron
// @match        https://github.com/*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 样式配置：增加分割线和原生 CSS 变量适配
    GM_addStyle(`
        #github-rss-helper { 
            padding-top: 16px;
            margin-top: 16px;
            border-top: 1px solid var(--color-border-muted, #d0d7de);
        }
        .rss-title { 
            font-size: 14px; 
            font-weight: 600; 
            margin-bottom: 12px; 
            color: var(--color-fg-default, #1f2328); 
        }
        .rss-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 10px; 
        }
        .rss-label { 
            font-size: 12px; 
            font-weight: 500; 
            color: var(--color-fg-default, #1f2328); 
        }
        .rss-btns { 
            display: flex; 
            gap: 6px; 
        }
        .rss-btn { 
            padding: 3px 10px; 
            font-size: 11px; 
            font-weight: 500;
            border-radius: 6px; 
            background-color: var(--color-btn-bg, #f6f8fa); 
            border: 1px solid var(--color-btn-border, rgba(31,35,40,0.15));
            color: var(--color-btn-text, #24292f); 
            cursor: pointer; 
            text-decoration: none; 
            line-height: 1.2;
            box-shadow: var(--color-calendar-graph-day-L1-shadow, 0 1px 0 rgba(27,31,36,0.04));
        }
        .rss-btn:hover { 
            background-color: var(--color-btn-hover-bg, #f3f4f6); 
            border-color: var(--color-btn-hover-border, rgba(31,35,40,0.15));
            text-decoration: none; 
        }
        .rss-btn.rss-btn-error {
            color: #cf222e;
            border-color: #cf222e;
        }
    `);

    const FEED_TYPES = [
        { id: 'show_tags', label: 'Tags', suffix: 'tags.atom' },
        { id: 'show_releases', label: 'Releases', suffix: 'releases.atom' },
        { id: 'show_issues', label: 'Issues', suffix: 'issues.atom' },
        { id: 'show_commits', label: 'Commits', suffix: 'commits.atom' }
    ];

    // GitHub 仓库子页面的第二级路径关键字（/owner/repo/<subpage>/...）
    const SUBPAGE_BLACKLIST = [
        'settings', 'pulls', 'issues', 'actions', 'projects',
        'security', 'insights', 'wiki', 'pulse', 'graphs',
        'network', 'community', 'discussions'
    ];

    function isRepoSubpage(pathParts) {
        if (pathParts.length <= 2) return false;
        return SUBPAGE_BLACKLIST.includes(pathParts[2]);
    }

    function inject() {
        if (document.getElementById('github-rss-helper')) return;

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length < 2) return;
        const [owner, repo] = pathParts;

        if (isRepoSubpage(pathParts)) return;

        // 定位侧边栏
        const sidebar =
            document.querySelector('div[data-position="end"] [data-component="SplitPageLayout.Pane"]') ||
            document.querySelector('aside[aria-label="Repository sidebar"]') ||
            document.querySelector('.Layout-sidebar') ||
            document.querySelector('.BorderGrid')?.parentElement ||
            document.querySelector('div[data-testid="sidebar"]');

        if (!sidebar) {
            return;
        }

        // 创建容器
        const container = document.createElement('div');
        container.id = 'github-rss-helper';

        const titleEl = document.createElement('div');
        titleEl.className = 'rss-title';
        titleEl.textContent = 'RSS Feeds';
        container.appendChild(titleEl);

        let hasActive = false;
        FEED_TYPES.forEach(feed => {
            if (GM_getValue(feed.id) === false) return;
            hasActive = true;
            const url = `https://github.com/${owner}/${repo}/${feed.suffix}`;

            const item = document.createElement('div');
            item.className = 'rss-item';

            const label = document.createElement('span');
            label.className = 'rss-label';
            label.textContent = feed.label;

            const btns = document.createElement('div');
            btns.className = 'rss-btns';

            const inoreaderLink = document.createElement('a');
            inoreaderLink.href = `https://www.inoreader.com/?add_feed=${encodeURIComponent(url)}`;
            inoreaderLink.target = '_blank';
            inoreaderLink.rel = 'noopener noreferrer';
            inoreaderLink.className = 'rss-btn';
            inoreaderLink.textContent = 'Inoreader';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'rss-btn copy-rss';
            copyBtn.dataset.url = url;
            copyBtn.textContent = 'Copy';

            btns.appendChild(inoreaderLink);
            btns.appendChild(copyBtn);
            item.appendChild(label);
            item.appendChild(btns);
            container.appendChild(item);
        });

        if (!hasActive) return;

        sidebar.appendChild(container);

        // 绑定复制事件
        container.querySelectorAll('.copy-rss').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const original = btn.textContent;
                navigator.clipboard.writeText(btn.dataset.url)
                    .then(() => {
                        btn.textContent = 'OK!';
                        btn.classList.remove('rss-btn-error');
                        setTimeout(() => { btn.textContent = original; }, 1000);
                    })
                    .catch(() => {
                        btn.textContent = '失败';
                        btn.classList.add('rss-btn-error');
                        setTimeout(() => {
                            btn.textContent = original;
                            btn.classList.remove('rss-btn-error');
                        }, 1500);
                    });
            };
        });
    }

    // 菜单管理
    FEED_TYPES.forEach(type => {
        if (GM_getValue(type.id) === undefined) GM_setValue(type.id, type.id !== 'show_commits');
        GM_registerMenuCommand(`${GM_getValue(type.id) ? '✅' : '❌'} ${type.label}`, () => {
            GM_setValue(type.id, !GM_getValue(type.id));
            location.reload();
        });
    });

    let timer = null;
    const scheduleInject = () => {
        clearTimeout(timer);
        timer = setTimeout(inject, 300);
    };

    document.addEventListener('turbo:load', scheduleInject);
    document.addEventListener('turbo:render', scheduleInject);
    document.addEventListener('pjax:end', scheduleInject);

    const mainContent =
        document.querySelector('#js-repo-pjax-container') ||
        document.querySelector('main') ||
        document.body;

    const observer = new MutationObserver(scheduleInject);
    observer.observe(mainContent, { childList: true, subtree: true });

    inject();
})();
