// ==UserScript==
// @name         X (Twitter) 动态绝对时间格式化
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  将 X (Twitter) 相对时间转化为精确绝对时间：今天 (HH:mm)、今年 (MM-DD HH:mm)、往年 (YYYY-MM-DD HH:mm)，防客户端覆写
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

    function formatOne(timeEl) {
        if (!timeEl || timeEl.tagName !== 'TIME') return;

        const datetime = timeEl.getAttribute('datetime');
        if (!datetime) return;

        const date = new Date(datetime);
        if (isNaN(date.getTime())) return;

        const displayTime = computeDisplayTime(date, new Date());

        const target = timeEl.querySelector('span') || timeEl;

        if (target.textContent !== displayTime) {
            target.textContent = displayTime;
        }
    }

    function formatAllWithin(root) {
        if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;

        if (root.tagName === 'TIME') {
            formatOne(root);
        }
        if (root.querySelectorAll) {
            root.querySelectorAll('time').forEach(formatOne);
        }
    }

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
                mutation.addedNodes.forEach(formatAllWithin);
            } else if (mutation.type === 'characterData') {
                const timeEl = closestTimeElement(mutation.target);
                if (timeEl) formatOne(timeEl);
            }
        }
    });

    if (document.body) {
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        formatAllWithin(document.body);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
            formatAllWithin(document.body);
        });
    }
})();
