// ==UserScript==
// @name         虎扑体验增强 (Hupu Plus)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  虎扑手机版 (m.hupu.com) 自动跳转 PC 网页版 (bbs.hupu.com)，并自动缩小网页版回帖中的超大表情包
// @author       GeBron
// @match        *://m.hupu.com/bbs-share/*
// @match        *://m.hupu.com/bbs/*
// @match        https://bbs.hupu.com/*
// @icon         https://w1.hoopchina.com.cn/images/pc/old/favicon.ico
// @run-at       document-start
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    const host = location.hostname;

    // ========== 模块一：手机版 -> 网页版 自动跳转 ==========
    if (host === 'm.hupu.com') {
        const pattern = /\/(?:bbs-share|bbs)\/(\d+)(?:-\d+)?(?:\.html)?/;
        const match = location.pathname.match(pattern);

        if (match && match[1]) {
            const postId = match[1];
            const newUrl = `https://bbs.hupu.com/${postId}.html`;
            location.replace(newUrl);
        }
        return;
    }

    // ========== 模块二：网页版回帖表情包自动缩小 ==========
    if (host === 'bbs.hupu.com') {
        const MAX_SIZE = 150;

        function resizeReplyImages() {
            const replyImgs = document.querySelectorAll(
                '.post-reply-list img, .reply-list img, .comment-content img'
            );

            replyImgs.forEach(img => {
                const src = img.src;
                if (!src || img.dataset.resizingDone) return;

                const m = src.match(/_w_(\d+)_h_(\d+)/);

                if (m) {
                    const width = parseInt(m[1], 10);
                    const height = parseInt(m[2], 10);

                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        img.style.maxWidth = MAX_SIZE + 'px';
                        img.style.maxHeight = MAX_SIZE + 'px';
                        img.style.objectFit = 'contain';
                        img.style.cursor = 'zoom-in';

                        if (src.includes('x-oss-process=')) {
                            img.src = src.replace(/image\/resize,w_\d+/, 'image/resize,w_300');
                        } else {
                            const connector = src.includes('?') ? '&' : '?';
                            img.src = src + connector + 'x-oss-process=image/resize,w_300';
                        }
                    }
                }
                img.dataset.resizingDone = 'true';
            });
        }

        function init() {
            resizeReplyImages();

            const observer = new MutationObserver(() => {
                resizeReplyImages();
            });

            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            }
        }

        if (document.body) {
            init();
        } else {
            document.addEventListener('DOMContentLoaded', init);
        }
    }
})();
