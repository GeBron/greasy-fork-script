# Greasy Fork 油猴脚本合集

个人维护的 Tampermonkey 用户脚本集合，用于增强日常常用网站的浏览体验。

## 脚本列表

| 脚本 | 版本 | 适用站点 | 功能简介 |
|------|------|----------|----------|
| [4d4y-newbab.js](./4d4y-newbab.js) | 1.0 | 4d4y 论坛 | 帖子标题点击新标签页打开 |
| [cnblogs-plus.js](./cnblogs-plus.js) | 1.0 | 博客园 | 自动展开代码块 + 标题新标签页打开 |
| [github-rss-inoreader-helper.js](./github-rss-inoreader-helper.js) | 1.0 | GitHub | 仓库侧边栏注入 RSS 订阅按钮，支持一键导入 Inoreader |
| [hupu-plus.js](./hupu-plus.js) | 1.0 | 虎扑 | 手机版自动跳转网页版 + 回帖表情包自动缩小 |
| [x-bird-logo.js](./x-bird-logo.js) | 1.0 | X (Twitter) | 修复用户名小鸟图标无法显示的问题 |
| [x-time.js](./x-time.js) | 1.0 | X (Twitter) | 动态时间格式化（今天/今年/往年） |

## 安装方式

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 点击上方脚本链接，进入源码页面
3. 复制全部内容，在 Tampermonkey 中新建脚本并粘贴保存

或直接将 `.js` 文件拖入 Tampermonkey 管理面板导入。

## 脚本详情

### 4D4Y 帖子新标签页打开

- **文件**: `4d4y-newbab.js`
- **匹配**: `*://www.4d4y.com/forum/forumdisplay.php*`

强制 4d4y 论坛帖子列表中的标题链接在新标签页打开，避免覆盖当前页面。为链接添加 `target="_blank"` 和 `rel="noopener noreferrer"`。

---

### 博客园增强：自动展开代码 + 标题新标签页打开

- **文件**: `cnblogs-plus.js`
- **匹配**: `*://www.cnblogs.com/*`

两个功能合一：

1. **自动展开代码块** — 博客园折叠状态的代码块自动点击展开，无需手动逐个点击。
2. **标题新标签页打开** — 博主主页的文章标题链接在新标签页打开（官方首页跳过此功能，但代码展开仍然生效）。

通过 `MutationObserver` + 防抖 + 有限轮询三重保障，覆盖异步加载和无限滚动场景。

---

### GitHub RSS & Inoreader Helper

- **文件**: `github-rss-inoreader-helper.js`
- **匹配**: `https://github.com/*/*`

在 GitHub 仓库页面的右侧边栏注入 RSS 订阅区域，支持四种 Feed：

| Feed | URL 后缀 | 默认状态 |
|------|----------|----------|
| Tags | `tags.atom` | 开启 |
| Releases | `releases.atom` | 开启 |
| Issues | `issues.atom` | 开启 |
| Commits | `commits.atom` | 关闭（更新频繁，减少噪音） |

每个 Feed 提供两个操作：
- **Inoreader** — 一键跳转到 Inoreader 订阅页面
- **Copy** — 复制 RSS 链接到剪贴板

通过 Tampermonkey 菜单可逐项开关各 Feed 类型。兼容 GitHub 2026 最新 UI（基于 `data-component` / `data-position` 语义化属性定位，不依赖构建哈希变化的 CSS Modules 类名）。

---

### 虎扑：手机版自动跳转网页版 + 回帖表情包自动缩小

- **文件**: `hupu-plus.js`
- **匹配**: `*://m.hupu.com/bbs-share/*`、`*://m.hupu.com/bbs/*`、`https://bbs.hupu.com/*`

两个模块：

1. **手机版 → 网页版自动跳转** — 访问 `m.hupu.com` 的帖子链接时，自动重定向到 `bbs.hupu.com` 的 PC 网页版。兼容 Google 搜索链接（无 `.html` 后缀）和 App 分享链接。
2. **回帖表情包自动缩小** — 网页版中超过 150px 的回帖表情包图片自动缩小显示，主帖图片保持不变。缩小后鼠标悬停提示可放大，并优化图片加载源以减少带宽。

---

### X (Twitter) 官方小鸟图标修复 / Chirp Bird Glyph Fix

- **文件**: `x-bird-logo.js`
- **匹配**: `https://x.com/*`、`https://twitter.com/*`

修复部分系统（如 Windows）上无法显示的用户名小鸟图标问题。X 使用 `U+EA00` 私有区字符表示小鸟图标，该字符在缺少 Chirp 字体的系统上会显示为方块。

实现方式：
- 引用 X 官方 Chirp 字体，限定 `unicode-range: U+EA00`
- 主动预加载字体，避免首次渲染时方块字符来不及替换
- 字体放在 `font-family` 最前面，防止其他图标字体截胡该码位
- 监听 `MutationObserver`（childList + characterData）、路由变化（History API）、低频定时扫描，覆盖虚拟滚动列表复用和页面切换场景

---

### X (Twitter) 动态时间格式化

- **文件**: `x-time.js`
- **匹配**: `https://x.com/*`、`https://twitter.com/*`

根据日期智能显示时间格式：

| 时间范围 | 显示格式 | 示例 |
|----------|----------|------|
| 今天 | `HH:mm` | `14:30` |
| 今年（非今天） | `MM-DD HH:mm` | `07-24 14:30` |
| 往年 | `YYYY-MM-DD HH:mm` | `2025-07-24 14:30` |

X 客户端会周期性地把时间重写回相对格式（如 "5m" → "6m"），脚本通过 `characterData` 监听捕获并重新格式化，确保始终显示绝对时间。

## 技术特点

- 所有脚本均使用 IIFE 封装，不污染全局作用域
- 动态内容通过 `MutationObserver` 实时处理，适配 SPA 和异步加载
- 关键场景搭配防抖、轮询兜底，确保可靠性
- 兼容各站点最新 UI 变化

## 作者

GeBron

## License

MIT
