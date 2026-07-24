// ==UserScript==
// @name         X (Twitter) 动态时间格式化
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  根据日期智能显示时间：今天(HH:mm)、今年(MM-DD HH:mm)、往年(YYYY-MM-DD HH:mm)，并自动修正 X 客户端把时间重写回相对格式的问题
// @author       GeBron
// @match        https://x.com/*
// @match        https://twitter.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    function computeDisplayTime(date, now) {
        const isToday = date.toDateString() === now.toDateString();
        const isThisYear = date.getFullYear() === now.getFullYear();

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        if (isToday) {
            return `${hours}:${minutes}`;
        } else if (isThisYear) {
            return `${month}-${day} ${hours}:${minutes}`;
        } else {
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        }
    }

    // 格式化单个 <time> 元素。若当前文本已经是目标值则跳过写入，
    // 这样既避免了死循环（我们写入触发的 mutation 会因文本相同而被短路），
    // 也减少了无意义的 DOM 操作。
    function formatOne(timeEl) {
        if (!timeEl || timeEl.tagName !== 'TIME') return;

        const datetime = timeEl.getAttribute('datetime');
        if (!datetime) return;

        const date = new Date(datetime);
        if (isNaN(date.getTime())) return; // 无效日期，跳过，避免显示 "Invalid Date"

        const displayTime = computeDisplayTime(date, new Date());

        // X 的结构通常是 <time><span>相对时间</span></time>
        const target = timeEl.querySelector('span') || timeEl;

        if (target.textContent !== displayTime) {
            target.textContent = displayTime;
        }
    }

    // 只扫描给定节点及其子树内的 <time>，而不是每次都扫描整个 document
    function formatAllWithin(root) {
        if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;

        if (root.tagName === 'TIME') {
            formatOne(root);
        }
        if (root.querySelectorAll) {
            root.querySelectorAll('time').forEach(formatOne);
        }
    }

    // 从文本节点（或任意节点）向上找最近的 <time> 祖先
    function closestTimeElement(node) {
        let el = node.nodeType === 3 ? node.parentElement : node;
        while (el && el.tagName !== 'TIME') {
            el = el.parentElement;
        }
        return el;
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // 新增节点：只处理这些新节点内部的 <time>
                mutation.addedNodes.forEach(formatAllWithin);
            } else if (mutation.type === 'characterData') {
                // X 会周期性地把相对时间原地改回去（如 "5m" -> "6m"），
                // 这种改动不产生新节点，只能靠 characterData 捕获并重新格式化
                const timeEl = closestTimeElement(mutation.target);
                if (timeEl) formatOne(timeEl);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    // 首次全量格式化（仅执行一次）
    formatAllWithin(document.body);
})();
