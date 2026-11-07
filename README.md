# OpenClaw 源码解读

> 跨平台 AI 助手框架 **OpenClaw** 的深度架构与时序分析 —— 一个纯静态、零构建的个人笔记博客平台。
>
> 10 大模块 · 155 张 Mermaid 图 · 22 条时序图 · 约 24 万字

配套解读对象:[github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)(Apache 2.0),对齐版本 `v2026.9.2` / commit `87d32a44`。

---

## 这是什么

不是一个「把文档搬上网」的项目,而是一套**按统一规范写、按统一规则渲染**的源码解读站:

- **内容侧** —— 每个模块页都遵循同一副骨架:一句话定位 → 三个原则 → 模块位置 → 主题详解 → 阅读路径 + FAQ + 总结。编号、目录、交叉引用由脚本统一维护,不会出现「§ 4.17」这种跳号。
- **渲染侧** —— 155 张 Mermaid 图全部按需加载、滚动到哪画到哪,并在渲染后强制修正样式,保证任何主题、任何屏宽下文字都清晰可读。

站点本身 **没有构建步骤**:纯 HTML + CSS + 原生 JS,克隆下来用 `python3 -m http.server` 就能跑。

## 亮点

| 能力 | 实现方式 |
|---|---|
| **按需渲染 Mermaid** | mermaid.min.js(约 860KB / 解压 3.3MB)**仅在页面真的有图时**才异步加载;图按滚动位置渲染(视口上下 1500px 内才画),空闲时后台一张张补齐。没有图的页面一个字节都不下载。 |
| **渲染后强制修正样式** | Mermaid 会把主题色编译成 inline `!important`,导致暗色模式下深底深字。`mermaid-fix.js` 在渲染完成后重写每个节点的 fill / stroke / 文字色,实测最低对比度 **13.49:1**(WCAG AA 要求 4.5:1)。 |
| **文字不被裁切** | 站点样式会渗进图里的 HTML(行高、padding 改变),导致 SVG 把超出的文字裁掉。修正脚本把盒模型还原成 mermaid 量尺寸时的样子,并兜底撑开 `foreignObject` 与节点框。 |
| **宽图也能看全** | 宽图先尝试等比缩到容器宽度(下限 0.68),缩不动才横向滚动,并给出「← 可横向滚动查看完整图 →」提示。左右两端都滚得到。 |
| **左到右优先** | 能横向表达的流程图一律用 `flowchart LR`(106 张),只有真正需要纵向堆叠的才保留 TB(24 张:分层架构、决策树、优先级列表、状态机)。 |
| **零构建、零依赖** | 没有 npm、没有打包器、没有框架。唯一的外部依赖是 CDN 上的 mermaid,且带 SRI 校验。 |
| **暗色 / 亮色** | 跟随 `localStorage`,无闪烁;图表配色在两种主题下都保证可读。 |
| **响应式** | 375 / 768 / 1440 / 1920 四档实测无横向溢出;宽屏下正文列自动填满,右侧目录固定 280–340px。 |
| **搜索 / 标签 / RSS** | 客户端搜索、标签云、文章索引、RSS 与 sitemap 全部内置。 |

## 快速开始

```bash
git clone <your-repo-url>
cd openclaw-docs-site

# 任意静态服务器都可以,项目自带一个:
python3 -m http.server 8000
# → http://localhost:8000
```

在 Claude Code 里,`.claude/launch.json` 已经配好 `docs-site` 这个启动项,可以直接跑预览;用别的工具就手动起静态服务器。

> 需要联网:页面里的 Mermaid 图从 `cdn.jsdelivr.net` 加载。离线环境下页面文字与布局正常,只有图会缺。

## 目录结构

```
.
├── index.html                  # 首页:模块目录、按角色入口、硬数据快照
├── 01-overview.html            # 01 概览
├── 02-architecture.html        # 02 核心架构
├── 03-channels.html            # 03 消息通道
├── 04-models-runtimes.html     # 04 模型与运行时
├── 05-sessions.html            # 05 会话与状态
├── 06-tools-hooks.html         # 06 工具与钩子
├── 07-end-to-end.html          # 07 端到端流程
├── 08-performance.html         # 08 性能与延迟
├── 09-error-handling.html      # 09 异常与降级
├── 10-source-walkthrough.html  # 10 源码导览
├── search.html  tags.html  articles.html   # 搜索 / 标签云 / 文章索引
├── sitemap.xml  rss.xml
└── assets/
    ├── gitbook.css             # 全部样式(设计变量 + 组件 + 响应式)
    ├── site.js                 # 主题、面包屑、进度条、侧栏注入、锚点定位
    ├── platform.js             # 代码复制、文章列表、标签云、搜索
    ├── nav.js                  # 移动端侧栏切换、当前页高亮
    ├── mermaid-render.js       # Mermaid 按需加载 + 调度(核心)
    ├── mermaid-fix.js          # 渲染后样式强制修正(核心)
    ├── sidebar.html            # 侧栏组件(运行时 fetch 注入,全站复用)
    └── articles.json           # 35 篇文章的元数据与跳转锚点
```

## 十大模块

| # | 模块 | 回答什么 | 图 |
|---|---|---|---|
| 01 | [概览](01-overview.html) | OpenClaw 是什么?设计哲学是什么? | 3 |
| 02 | [核心架构](02-architecture.html) | 三原则、四层架构、网关 7 子模块、信任边界 | 45 |
| 03 | [消息通道](03-channels.html) | 通道插件、协议帧、15+ 通道清单、字段映射 | 18 |
| 04 | [模型与运行时](04-models-runtimes.html) | Provider / Model / Runtime 的区分、5 种 Runtime、故障切换 | 18 |
| 05 | [会话与状态](05-sessions.html) | 生命周期、SQLite + Markdown 分层、8 层 Prompt、DM 隔离 | 29 |
| 06 | [工具与钩子](06-tools-hooks.html) | 工具执行、4 档沙箱、钩子拦截、8 个核心决策 | 9 |
| 07 | [端到端流程](07-end-to-end.html) | WhatsApp 完整旅程、13 参与者、9 阶段、31 步时序图 | 5 |
| 08 | [性能与延迟](08-performance.html) | 9 阶段耗时分布、TTFT 优化、5 大类优化手段 | 5 |
| 09 | [异常与降级](09-error-handling.html) | 5 大类错误、4 种恢复策略、可观测性 4 件套、SLO | 6 |
| 10 | [源码导览](10-source-walkthrough.html) | 顶层目录、`src/` 7 大模块、`packages/`、`extensions/`、`apps/` | 17 |

## 内容规范

每个模块页统一遵循「笔记解读规范」:

```
§ 1  一句话定位        一段话讲清这个模块是什么
§ 2  三个原则          可迁移的判断依据,而不是功能罗列
§ 3  模块位置        在整体架构中的位置 + 与相邻模块的关系
§ 4 .. N  主题详解    按逻辑分组,每节只讲一件事
§ N+1  阅读路径 + FAQ + 总结
```

正文里所有指向小节的交叉引用(`§ 6`、`模块 01 § 2`、区间 `§ 4-8`)都指向真实存在的小节,并在结构变化后由脚本统一重写;右侧目录由标题树生成,不会出现死链。

## Mermaid 渲染是怎么做的

这是整个站点最花功夫的部分,单独说:

```
页面 <head>
  └─ <script defer src="assets/mermaid-render.js">
         ├─ 页面上没有 .diagram[data-mermaid] → 直接返回,3.3MB 根本不下载
         ├─ 异步注入 mermaid.min.js(带 SRI),不阻塞 HTML 解析
         ├─ IntersectionObserver(rootMargin: 1500px)→ 滚到哪画到哪
         ├─ scroll / resize / 800ms 定时扫描兜底(后台标签页不触发 IO 时也保证画出来)
         └─ 空闲 2.5s 后后台一张张补齐,用户滚动时先让路
                    │
                    ▼
         mermaid.render() → res.svg
                    │
                    ▼
         assets/mermaid-fix.js 立刻修正
           ├─ 节点 fill / stroke:按原 stroke 色判断语义角色,换成「亮底 + 深字」
           ├─ cluster、edgeLabel 背景同样强制白底
           ├─ 还原盒模型(margin / padding / line-height)→ 文字不再被 SVG 裁掉
           ├─ 兜底撑开 foreignObject 与节点框
           └─ 宽度自适应:先缩到容器宽度(下限 0.68),缩不动则横向滚动 + 提示
```

单页 45 张图的 `02-architecture.html`,DOMContentLoaded **73ms**、load **131ms**。

## 部署

纯静态站点,推到任何静态托管即可:

```bash
# GitHub Pages
#   仓库 Settings → Pages → Source: Deploy from a branch → main / (root)

# Vercel / Netlify / Cloudflare Pages
#   Build command: 留空      Output directory: /
#   (不要设 build command,这个项目没有构建步骤)
```

部署到子目录时,页面里用的是**相对路径**(`assets/xxx.js`),无需改配置。若换成自定义域名,记得同步更新 `sitemap.xml` / `rss.xml` 里的 `<loc>`。

## 约定

- **改完静态资源要换版本号**:全站引用都带 `?v=<token>`,token 一致,改完资产后统一 bump 一次,避免浏览器拿旧缓存。
- **新增页面**:复制一个模块页,改名成 `NN-slug.html`,同步更新 `assets/sidebar.html`、`assets/articles.json`、以及其它页面里的链接。
- **加图**:直接写 `<div class="diagram" data-mermaid='flowchart LR ...'></div>`,渲染与样式修正会自动接管。

## 许可与致谢

- 解读对象 OpenClaw 遵循 **Apache 2.0**,版权归 [openclaw/openclaw](https://github.com/openclaw/openclaw) 所有;本站是对第三方项目的解读与整理。
- 本文档站(代码与文字)自身的许可由仓库所有者指定,详见仓库根目录的 `LICENSE`。
- 图中引用的第三方库:grammY、Baileys、discord.js、changesets 等版权归各自作者。
