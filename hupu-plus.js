// ==UserScript==
// @name         虎扑：手机版自动跳转网页版 + 回帖表情包自动缩小
// @version      1.0
// @description  兼容 Google 搜索链接与 App 分享链接自动跳转 PC 网页版；在网页版中仅缩小回帖表情包，主帖图片保持不变
// @author       GeBron
// @match        *://m.hupu.com/bbs-share/*
// @match        *://m.hupu.com/bbs/*
// @match        https://bbs.hupu.com/*
// @icon         https://w1.hoopchina.com.cn/images/pc/old/favicon.ico
// @run-at       document-start
// @grant        none
// @license      MIT
// @namespace    http://tampermonkey.net/
// ==/UserScript==

(function () {
    'use strict';

    const host = location.hostname;

    // ========== 模块一：手机版 -> 网页版 自动跳转 ==========
    if (host === 'm.hupu.com') {
        // 优化后的正则：
        // 1. (?:bbs-share|bbs) 非捕获组匹配路径
        // 2. (\d+) 捕获纯数字 ID
        // 3. (?:-\d+)? 忽略可能存在的页码（如 -1）
        // 4. (?:\.html)? 关键点：将 .html 设为可选，兼容 Google 搜索页链接
        const pattern = /\/(?:bbs-share|bbs)\/(\d+)(?:-\d+)?(?:\.html)?/;
        const match = location.pathname.match(pattern);

        if (match && match[1]) {
            const postId = match[1];
            const newUrl = `https://bbs.hupu.com/${postId}.html`;
            // 使用 replace 替换历史记录，防止回退死循环
            location.replace(newUrl);
        }
        return; // 手机域名下无需执行表情包缩小逻辑
    }

    // ========== 模块二：网页版回帖表情包自动缩小 ==========
    if (host === 'bbs.hupu.com') {
        const MAX_SIZE = 150;

        function resizeReplyImages() {
            // 关键点：只选择回帖列表或评论内容区域里的图片，避开主帖
            const replyImgs = document.querySelectorAll(
                '.post-reply-list img, .reply-list img, .comment-content img'
            );

            replyImgs.forEach(img => {
                const src = img.src;
                if (!src || img.dataset.resizingDone) return;

                // 识别宽高
                const m = src.match(/_w_(\d+)_h_(\d+)/);

                if (m) {
                    const width = parseInt(m[1], 10);
                    const height = parseInt(m[2], 10);

                    // 如果长或宽超过阈值
                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        // 缩小显示尺寸
                        img.style.maxWidth = MAX_SIZE + 'px';
                        img.style.maxHeight = MAX_SIZE + 'px';
                        img.style.objectFit = 'contain';
                        img.style.cursor = 'zoom-in'; // 提示可放大

                        // 优化图片加载源
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

        // 注意：由于整体脚本 @run-at 为 document-start（跳转模块需要），
        // 此时 document.body 可能尚未生成，必须等待其就绪后
        // 再执行首次处理并启动 MutationObserver，否则 observer.observe 会报错。
        function init() {
            resizeReplyImages();

            const observer = new MutationObserver(() => {
                resizeReplyImages();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        if (document.body) {
            init();
        } else {
            document.addEventListener('DOMContentLoaded', init);
        }
    }
})();
