// ==UserScript==
// @name         4D4Y 帖子新标签页打开
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  强制 4d4y 论坛帖子列表在点击标题时新开标签页
// @author       GeBron
// @match        *://www.4d4y.com/forum/forumdisplay.php*
// @grant        none
// ==/UserScript==
 
(function() {
    'use strict';
    // 选取所有在 th.subject 内的标题链接
    const links = document.querySelectorAll('th.subject span a[href^="viewthread.php?tid="]');
    links.forEach(link => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
    });
})();
