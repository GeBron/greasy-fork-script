// ==UserScript==
// @name         GitHub RSS & Inoreader Helper
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  兼容 GitHub 2026 最新 UI
// @author       GeBron
// @match        https://github.com/*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 优化样式：增加分割线和原生字体间距
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
            color: var(--color-fg-default); 
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
    // 注意：仓库主页是 /owner/repo 或 /owner/repo/tree/xxx、/owner/repo/blob/xxx 等，
    // 这些不应被过滤掉，只有明确的功能性子页面才需要跳过。
    const SUBPAGE_BLACKLIST = [
        'settings', 'pulls', 'issues', 'actions', 'projects',
        'security', 'insights', 'wiki', 'pulse', 'graphs',
        'network', 'community', 'discussions'
    ];

    function isRepoSubpage(pathParts) {
        // pathParts[0] = owner, pathParts[1] = repo, pathParts[2] = 子页面（如果存在）
        if (pathParts.length <= 2) return false; // /owner/repo 本身，视为主页
        return SUBPAGE_BLACKLIST.includes(pathParts[2]);
    }

    function inject() {
        if (document.getElementById('github-rss-helper')) return;

        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length < 2) return;
        const [owner, repo] = pathParts;

        // 修复：原逻辑误判 repo 名称本身，而不是子页面路径段
        if (isRepoSubpage(pathParts)) return;

        // 定位侧边栏
        // 2026 版 GitHub 改用 Primer 的 SplitPageLayout 组件系统，样式类名（如 prc-PageLayout-Pane-xxxxx、
        // CodeViewSidebar-module__xxxxx）都是随构建哈希变化的 CSS Modules 类名，不能作为选择器依赖。
        // data-component / data-position 是语义化属性，不会随构建哈希变化，是目前最稳定的锚点。
        const sidebar =
            document.querySelector('div[data-position="end"] [data-component="SplitPageLayout.Pane"]') ||
            // 兼容旧版结构（如果 GitHub 对部分页面/账号灰度回退到旧 UI）
            document.querySelector('aside[aria-label="Repository sidebar"]') ||
            document.querySelector('.Layout-sidebar') ||
            document.querySelector('.BorderGrid')?.parentElement ||
            document.querySelector('div[data-testid="sidebar"]');

        if (!sidebar) {
            // 兜底提示：方便在 GitHub 改版导致选择器失效时快速定位问题
            console.warn('[GitHub RSS Helper] 未找到侧边栏容器，可能是页面结构已变化，脚本暂时无法注入。');
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
            copyBtn.dataset.url = url; // 通过 DOM API 赋值，避免拼接字符串的转义问题
            copyBtn.textContent = 'Copy';

            btns.appendChild(inoreaderLink);
            btns.appendChild(copyBtn);
            item.appendChild(label);
            item.appendChild(btns);
            container.appendChild(item);
        });

        if (!hasActive) return;

        // 插入到侧边栏最后
        sidebar.appendChild(container);

        // 绑定复制事件（修复：正确处理 clipboard 的异步结果）
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
    // 默认值说明：除 Commits 外均默认开启（Commits 更新过于频繁，默认关闭以减少噪音）
    FEED_TYPES.forEach(type => {
        if (GM_getValue(type.id) === undefined) GM_setValue(type.id, type.id !== 'show_commits');
        GM_registerMenuCommand(`${GM_getValue(type.id) ? '✅' : '❌'} ${type.label}`, () => {
            GM_setValue(type.id, !GM_getValue(type.id));
            location.reload();
        });
    });

    // 监控页面动态变化
    // GitHub 前端基于 Turbo (Hotwired)，SPA 式跳转会派发 turbo:load 事件，
    // 优先使用该事件精准触发注入，避免全局 MutationObserver 带来的性能开销。
    let timer = null;
    const scheduleInject = () => {
        clearTimeout(timer);
        timer = setTimeout(inject, 300);
    };

    document.addEventListener('turbo:load', scheduleInject);
    document.addEventListener('turbo:render', scheduleInject);
    document.addEventListener('pjax:end', scheduleInject); // 兼容旧版 GitHub 前端

    // 兜底：以防 Turbo 事件在某些场景未覆盖，监听范围收窄到主内容区域而非整个 body
    const mainContent =
        document.querySelector('#js-repo-pjax-container') ||
        document.querySelector('main') ||
        document.body;

    const observer = new MutationObserver(scheduleInject);
    observer.observe(mainContent, { childList: true, subtree: true });

    inject();
})();
