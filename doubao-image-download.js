// ==UserScript==
// @name         豆包/Dola 无水印图片下载
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  为豆包与国际版 Dola 提供无水印图片下载（悬停按钮 + 右键菜单）
// @author       adapted from Qalxry
// @license      GPL-3.0
// @match        https://*.doubao.com/*
// @match        https://*.dola.com/*
// @match        https://*.cici.com/*
// @match        https://chat.dola.com/*
// @match        https://www.dola.com/*
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  function isImgUrl(url) {
    if (typeof url !== "string" || !url.startsWith("http")) return false;
    if (/\.(svg|ico)(\?|$)/i.test(url)) return false;
    if (/logo|avatar|icon|emoji|sprite|placeholder/i.test(url) && !/tos-|obj\//i.test(url)) return false;
    return /byteimg|ciciai|ciciaicdn|bytedance|pstatp|snssdk|ibyteimg|ocean-flow|sf-.*cdn|tos-/i.test(url)
      || /\/obj\//i.test(url);
  }

  function isDirectOk(url) {
    return isImgUrl(url) && !/watermark|wm[_=]|mark[_=]/i.test(url);
  }

  function isObj(v) { return v && typeof v === "object"; }
  function isEl(v) { return isObj(v) && v.nodeType === 1; }

  function toImg(v) {
    if (!v) return null;
    if (typeof v === "string") return isImgUrl(v) ? { url: v } : null;
    if (isObj(v) && isImgUrl(v.url)) {
      return { url: v.url, width: +v.width || +v.w || 0, height: +v.height || +v.h || 0 };
    }
    return null;
  }

  function pick(...vs) {
    for (const v of vs) {
      const i = toImg(v);
      if (i?.url) return i;
    }
    return null;
  }

  function extractKey(u) {
    if (!u) return "";
    const s = String(u).split("?")[0].split("~")[0];
    const i = s.indexOf("tos-");
    if (i >= 0) return s.slice(i);
    try { return new URL(s).pathname.replace(/^\/+/, ""); } catch { return s; }
  }

  function sameKey(a, b) {
    const ka = extractKey(a), kb = extractKey(b);
    return !!(ka && kb && ka === kb);
  }

  function normalize(raw) {
    if (!isObj(raw)) return null;
    const src = raw.realImageInfo || raw.imageContent || raw.imageInfo || raw.image || raw.data || raw;
    if (!isObj(src)) return null;

    const preview = pick(
      src.previewImage, src.preview_img, src.image_preview, src.imagePreview,
      src.preview, src.image_raw, src.originalImage,
      raw.previewImage, raw.preview_img
    );
    const download = pick(
      src.downloadImage, src.download_img, src.image_ori, src.image_dld,
      src.image_download, src.download, raw.downloadImage, raw.image_ori
    );
    const thumb = pick(
      src.thumbImage, src.image_thumb, src.thumb, src.thumbnail, raw.image_thumb
    );
    const pre = preview || thumb;
    if (!pre?.url) return null;
    const dld = download || pre;
    return {
      previewImage: pre,
      downloadImage: dld,
      thumbImage: thumb,
      key: src.key || raw.key || extractKey(pre.url),
      width: +src.width || +raw.width || pre.width || 0,
      height: +src.height || +raw.height || pre.height || 0,
      sameUrl: pre.url === dld.url,
    };
  }

  function extractDirect(obj) {
    if (!obj) return null;
    for (const c of [obj.image_thumb_ori, obj.image_ori_raw, obj.image_raw, obj.originalImage, obj.image_ori]) {
      if (typeof c === "string" && isDirectOk(c)) return c;
      if (c?.url && isDirectOk(c.url)) return c.url;
    }
    return null;
  }

  const FIBER_PREFIX = ["__reactFiber$", "__reactInternalInstance$"];

  function getFiber(el) {
    if (!el) return null;
    const k = Object.keys(el).find(x => FIBER_PREFIX.some(p => x.startsWith(p)));
    return k ? el[k] : null;
  }

  function scanProps(value, out, depth = 0, seen = new WeakSet()) {
    if (!isObj(value) || isEl(value) || seen.has(value) || depth > 8) return;
    seen.add(value);
    const info = normalize(value);
    if (info) out.push({ info, raw: value });
    if (Array.isArray(value)) {
      value.slice(0, 24).forEach(v => scanProps(v, out, depth + 1, seen));
      return;
    }
    for (const k of Object.keys(value).slice(0, 40)) {
      if (/^(children|ref|_owner|stateNode|memoizedState)$/.test(k)) continue;
      if (!/image|img|preview|download|thumb|ori|raw|real|content|creation|props|data|list|item/i.test(k)) continue;
      const c = value[k];
      if (isObj(c) && typeof c !== "function") scanProps(c, out, depth + 1, seen);
    }
  }

  function infoFromElement(el, targetUrl = "") {
    const fiber = getFiber(el);
    if (!fiber) return null;
    let node = fiber, depth = 0, best = null;
    while (node && depth < 24) {
      const props = node.memoizedProps || node.pendingProps;
      if (props) {
        const list = [];
        scanProps(props, list);
        for (const { info, raw } of list) {
          let score = (info.width || 0) + (info.height || 0) + (info.sameUrl ? 0 : 400);
          if (targetUrl) {
            const urls = [
              info.previewImage?.url,
              info.downloadImage?.url,
              info.thumbImage?.url,
              info.key,
            ].filter(Boolean);
            if (!urls.some(u => u === targetUrl || sameKey(u, targetUrl))) continue;
            score += 2000;
          }
          if (!best || score > best._s) best = { info, raw, _s: score };
        }
      }
      node = node.return;
      depth++;
    }
    return best;
  }

  function isRoughlyVisible(el) {
    if (!el || !isEl(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
    const st = getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || +st.opacity === 0) return false;
    return true;
  }

  function findActivePreviewImage(fromEl) {
    const root = fromEl?.closest?.(
      '[role="dialog"], [class*="modal"], [class*="Modal"], [class*="preview"], [class*="Preview"], [class*="lightbox"], [class*="swiper"], [class*="carousel"], [class*="viewer"], [class*="Viewer"]'
    ) || document.body;

    const imgs = [...root.querySelectorAll("img")].filter(img => {
      if (!isRoughlyVisible(img)) return false;
      const u = img.currentSrc || img.src || "";
      const w = img.naturalWidth || img.width || 0;
      return w >= 80 && isImgUrl(u);
    });
    if (!imgs.length) return null;

    const activeSlide = root.querySelector(
      '[class*="active"], [class*="Active"], [class*="selected"], [class*="current"], [aria-selected="true"], [aria-current="true"]'
    );
    if (activeSlide) {
      const inActive = imgs.find(img => activeSlide.contains(img));
      if (inActive) return inActive;
    }

    const cx = innerWidth / 2, cy = innerHeight / 2;
    imgs.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      const areaA = ra.width * ra.height, areaB = rb.width * rb.height;
      const distA = Math.hypot(ra.left + ra.width / 2 - cx, ra.top + ra.height / 2 - cy);
      const distB = Math.hypot(rb.left + rb.width / 2 - cx, rb.top + rb.height / 2 - cy);
      return (areaB - areaA) || (distA - distB);
    });
    return imgs[0];
  }

  function infoFromImgEl(img) {
    const url = img.currentSrc || img.src || "";
    if (!isImgUrl(url)) return null;
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w < 60 && h < 60) return null;
    return {
      previewImage: { url, width: w, height: h },
      downloadImage: { url },
      sameUrl: true,
      key: extractKey(url),
      width: w,
      height: h,
    };
  }

  function resolveInfo(el) {
    if (!el) return null;

    if (el.tagName === "IMG") {
      const url = el.currentSrc || el.src || "";
      const fiberHit = infoFromElement(el, url);
      if (fiberHit?.info) {
        return {
          info: fiberHit.info,
          direct: extractDirect(fiberHit.raw) || (isDirectOk(url) ? url : null),
        };
      }
      const plain = infoFromImgEl(el);
      if (plain) return { info: plain, direct: isDirectOk(url) ? url : null };
    }

    if (el.tagName === "CANVAS") {
      const fiberHit = infoFromElement(el, "");
      if (fiberHit?.info) {
        return { info: fiberHit.info, direct: extractDirect(fiberHit.raw) };
      }
    }

    const activeImg = findActivePreviewImage(el);
    if (activeImg && activeImg !== el) return resolveInfo(activeImg);

    const scope = el.closest?.("div,figure,section,li") || el.parentElement;
    if (scope) {
      const imgs = [...scope.querySelectorAll("img")].filter(isRoughlyVisible);
      imgs.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      });
      if (imgs[0]) return resolveInfo(imgs[0]);
    }

    return null;
  }

  function gmBlob(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        fetch(url, { mode: "cors", credentials: "omit" })
          .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
          .then(resolve, reject);
        return;
      }
      GM_xmlhttpRequest({
        method: "GET", url, responseType: "blob", timeout: 60000,
        onload: r => (r.status >= 200 && r.status < 400) ? resolve(r.response) : reject(new Error("HTTP " + r.status)),
        onerror: () => reject(new Error("网络错误")),
        ontimeout: () => reject(new Error("超时")),
      });
    });
  }

  function removeWatermarkParam(urlStr) {
    if (!urlStr || typeof urlStr !== "string") return urlStr;
    try {
      const u = new URL(urlStr);
      ["watermark", "wm", "mark", "watermark_type"].forEach(k => u.searchParams.delete(k));
      u.pathname = u.pathname.replace(/(~tplv-[^~]+?)(:watermark[^\/~]*)/gi, "$1");
      return u.toString();
    } catch {
      return urlStr.replace(/([?&])(watermark|wm|mark)=[^&]*/gi, "");
    }
  }

  async function mergeImages(blobA, blobB) {
    const ua = URL.createObjectURL(blobA), ub = URL.createObjectURL(blobB);
    try {
      return await new Promise((resolve, reject) => {
        const a = new Image(), b = new Image();
        let loadedCount = 0;
        const done = () => {
          if (++loadedCount < 2) return;
          try {
            const targetW = a.naturalWidth, targetH = a.naturalHeight;
            const c = document.createElement("canvas");
            c.width = targetW; c.height = targetH;
            const ctx = c.getContext("2d");
            ctx.drawImage(a, 0, 0, targetW, targetH);
            const qw = Math.ceil(targetW / 2), qh = Math.ceil(targetH / 2);
            ctx.clearRect(0, 0, qw, qh);

            const srcBw = Math.ceil(b.naturalWidth / 2);
            const srcBh = Math.ceil(b.naturalHeight / 2);
            ctx.drawImage(b, 0, 0, srcBw, srcBh, 0, 0, qw, qh);
            c.toBlob(blob => blob ? resolve(blob) : reject(new Error("toBlob失败")), "image/png");
          } catch (e) { reject(e); }
        };
        a.onload = b.onload = done;
        a.onerror = () => reject(new Error("preview加载失败"));
        b.onerror = () => reject(new Error("download加载失败"));
        a.crossOrigin = b.crossOrigin = "anonymous";
        a.src = ua; b.src = ub;
      });
    } finally {
      URL.revokeObjectURL(ua); URL.revokeObjectURL(ub);
    }
  }

  function saveBlob(blob, namePrefix = "nowm") {
    const mimeMap = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif",
      "image/avif": ".avif"
    };
    const ext = (blob && mimeMap[blob.type]) || ".png";
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${namePrefix}-${Date.now()}${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  }

  function toast(msg, ms = 2800) {
    let el = document.getElementById("nomark-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "nomark-toast";
      el.style.cssText = "position:fixed;bottom:72px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:10px 16px;border-radius:8px;z-index:2147483647;font-size:13px;font-family:system-ui,-apple-system,sans-serif;pointer-events:none;transition:opacity .2s;max-width:80vw;text-align:center";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = "0"; }, ms);
  }

  async function doDownload(info, direct) {
    if (!info?.previewImage?.url) {
      toast("未获取到图片地址");
      return;
    }
    toast("处理中…");
    try {
      if (direct && isDirectOk(direct)) {
        const cleanUrl = removeWatermarkParam(direct);
        const blob = await gmBlob(cleanUrl);
        saveBlob(blob, "nowm-direct");
        toast("已下载（直链）");
        return;
      }
      if (info.sameUrl || info.previewImage.url === info.downloadImage?.url) {
        const url = removeWatermarkParam(info.previewImage.url);
        const blob = await gmBlob(url);
        saveBlob(blob, "nowm");
        toast("已下载");
        return;
      }
      const [ba, bb] = await Promise.all([
        gmBlob(removeWatermarkParam(info.previewImage.url)),
        gmBlob(removeWatermarkParam(info.downloadImage.url)),
      ]);
      const merged = await mergeImages(ba, bb);
      saveBlob(merged, "nowm-merge");
      toast("已下载（重叠去水印）");
    } catch (e) {
      console.warn("[无水印] 下载失败", e);
      toast("失败: " + (e.message || e));
    }
  }

  const BTN_ID = "nomark-hover-btn";
  let hoverBtn = null;
  let currentTarget = null;

  function ensureHoverBtn() {
    if (hoverBtn) return hoverBtn;
    hoverBtn = document.createElement("button");
    hoverBtn.id = BTN_ID;
    hoverBtn.type = "button";
    hoverBtn.textContent = "⬇ 无水印";
    hoverBtn.style.cssText = [
      "all:initial", "position:fixed", "z-index:2147483646", "display:none",
      "padding:6px 12px", "border:none", "border-radius:8px",
      "background:#ff4d4f", "color:#fff", "font-size:13px", "font-weight:600",
      "font-family:system-ui, -apple-system, sans-serif",
      "cursor:pointer", "box-shadow:0 4px 14px rgba(0,0,0,.25)",
      "pointer-events:auto", "user-select:none",
    ].join(";");
    hoverBtn.addEventListener("mousedown", e => { e.preventDefault(); e.stopPropagation(); });
    hoverBtn.addEventListener("click", async e => {
      e.preventDefault();
      e.stopPropagation();
      const el = currentTarget;
      if (!el) return;
      const active = findActivePreviewImage(el) || el;
      const r = resolveInfo(active);
      if (!r) { toast("无法解析该图片"); return; }
      await doDownload(r.info, r.direct);
    });
    document.documentElement.appendChild(hoverBtn);
    return hoverBtn;
  }

  function showHoverOn(el) {
    const btn = ensureHoverBtn();
    currentTarget = el;
    const rect = el.getBoundingClientRect();
    if (rect.width < 60 || rect.height < 60) return;
    btn.style.display = "block";
    btn.style.left = Math.min(rect.right - 88, window.innerWidth - 100) + "px";
    btn.style.top = Math.max(8, rect.top + 8) + "px";
  }

  function hideHover() {
    if (hoverBtn) hoverBtn.style.display = "none";
    currentTarget = null;
  }

  function isCandidateMedia(el) {
    if (!el || !isEl(el)) return false;
    if (el.id === BTN_ID || el.closest?.("#" + BTN_ID)) return false;
    if (el.tagName === "IMG") {
      const u = el.currentSrc || el.src || "";
      const w = el.naturalWidth || el.width || 0;
      return w >= 80 && isImgUrl(u);
    }
    if (el.tagName === "CANVAS") {
      const r = el.getBoundingClientRect();
      return r.width >= 100 && r.height >= 100;
    }
    return false;
  }

  document.addEventListener("mouseover", e => {
    const t = e.target;
    if (isCandidateMedia(t)) showHoverOn(t);
    else {
      const m = t?.closest?.("img,canvas");
      if (m && isCandidateMedia(m)) showHoverOn(m);
    }
  }, true);

  document.addEventListener("mouseout", e => {
    const to = e.relatedTarget;
    if (to && (to === hoverBtn || hoverBtn?.contains(to) || to.closest?.("img,canvas") === currentTarget)) return;
    setTimeout(() => {
      if (!hoverBtn?.matches(":hover") && currentTarget && !currentTarget.matches(":hover")) hideHover();
    }, 120);
  }, true);

  let lastCtxInfo = null;
  let activeObserver = null;
  let observerTimer = null;

  function visible(el) {
    return !!(el && (el.offsetParent !== null || el.getClientRects().length));
  }
  function menuText(el) {
    return (el?.innerText || el?.textContent || "").replace(/\s+/g, " ").trim();
  }
  function findMenuRoot() {
    const cands = [...document.querySelectorAll(
      ".semi-dropdown-content, [class*='context-menu'], [role='menu'], [class*='Dropdown']"
    )].filter(visible);
    const hit = cands.filter(m => /下载|Download|Copy|复制|Save|保存/i.test(menuText(m)));
    return hit.at(-1) || cands.at(-1) || null;
  }

  document.addEventListener("contextmenu", e => {
    const media = e.target.closest?.("img,canvas");
    if (!media && !isCandidateMedia(e.target)) return;

    const el = media || e.target;
    const active = findActivePreviewImage(el) || el;
    lastCtxInfo = resolveInfo(active);

    if (activeObserver) activeObserver.disconnect();
    clearTimeout(observerTimer);

    activeObserver = new MutationObserver(() => {
      const menu = findMenuRoot();
      if (!menu || menu.querySelector(".tm-no-watermark-btn")) return;
      const btn = document.createElement("div");
      btn.className = "tm-no-watermark-btn";
      btn.style.cssText = "color:#ff4d4f;cursor:pointer;padding:8px 12px;font-size:14px;font-family:system-ui,-apple-system,sans-serif;";
      btn.textContent = "下载无水印原图";
      btn.addEventListener("click", ev => {
        ev.preventDefault();
        ev.stopPropagation();
        try { menu.style.display = "none"; } catch {}
        if (lastCtxInfo) doDownload(lastCtxInfo.info, lastCtxInfo.direct);
        else toast("未捕获到图片");
      });
      menu.appendChild(btn);

      if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
      }
    });

    activeObserver.observe(document.documentElement, { childList: true, subtree: true });

    observerTimer = setTimeout(() => {
      if (activeObserver) {
        activeObserver.disconnect();
        activeObserver = null;
      }
    }, 2000);
  }, true);

  function addBadge() {
    if (document.getElementById("nomark-badge")) return;
    const b = document.createElement("div");
    b.id = "nomark-badge";
    b.title = "豆包/Dola 无水印脚本已运行";
    b.style.cssText = "position:fixed;right:14px;bottom:14px;width:12px;height:12px;border-radius:50%;background:#52c41a;z-index:2147483645;box-shadow:0 0 0 3px rgba(82,196,26,.35)";
    document.documentElement.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addBadge);
  else addBadge();
})();

