// ==UserScript==
// @name         4D4Y 论坛帖子新标签页打开
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  强制 4D4Y 论坛帖子列表中的标题链接在点击时于新标签页打开
// @author       GeBron
// @match        *://www.4d4y.com/forum/forumdisplay.php*
// @grant        none
// @noframes
// @license      MIT
// @updateURL    https://raw.githubusercontent.com/GeBron/greasy-fork-script/master/4d4y-open-in-new-tab.js
// @downloadURL  https://raw.githubusercontent.com/GeBron/greasy-fork-script/master/4d4y-open-in-new-tab.js
// ==/UserScript==

(function () {
    'use strict';

    function applyTargetBlank() {
        const links = document.querySelectorAll('th.subject span a[href*="viewthread.php"]');
        links.forEach(link => {
            if (link.getAttribute('target') !== '_blank') {
                link.setAttribute('target', '_blank');
                link.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }

    function debounce(fn, wait) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    applyTargetBlank();

    const observer = new MutationObserver(debounce(applyTargetBlank, 200));
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            applyTargetBlank();
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
})();
