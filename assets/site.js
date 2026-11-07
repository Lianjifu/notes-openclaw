// OpenClaw Docs Site · 主入口脚本
// 提供:主题切换、阅读进度、文章元数据加载、上一篇下一篇、面包屑

(function () {
  'use strict';

  /* ---------- 资源版本号 ----------
     页面里以 <script src="assets/site.js?v=xxx"> 引入,这里把同一个版本号
     借给 fetch 的子资源(sidebar.html),否则改了 sidebar 又会被浏览器
     拿旧缓存顶上,侧边栏里的表情删不掉。 */
  var SITE_VERSION = (function () {
    var cur = document.currentScript && document.currentScript.src;
    var m = cur && cur.match(/[?&]v=([^&]+)/);
    return m ? m[1] : '';
  })();

  function withVersion(url) {
    if (!SITE_VERSION) return url;
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + SITE_VERSION;
  }

  /* ---------- 主题切换 ---------- */
  function initTheme() {
    const saved = localStorage.getItem('openclaw-docs-theme-v2') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function bindThemeToggle() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('openclaw-docs-theme-v2', next);
      btn.innerHTML = next === 'dark' ? '暗色' : '亮色';
    });
    // 初始化按钮文字
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    btn.innerHTML = current === 'dark' ? '暗色' : '亮色';
  }

  /* ---------- 阅读进度条 ---------- */
  function initReadingProgress() {
    const bar = document.querySelector('.reading-progress');
    if (!bar) return;
    function update() {
      const h = document.documentElement;
      const scrollTop = h.scrollTop || document.body.scrollTop;
      const scrollHeight = (h.scrollHeight || document.body.scrollHeight) - h.clientHeight;
      const pct = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      bar.style.width = pct + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- 当前文章元数据 ---------- */
  function getCurrentArticle() {
    const path = window.location.pathname;
    if (!window.OPENCLAW_ARTICLES) return null;
    return window.OPENCLAW_ARTICLES.find(a => path.endsWith(a.path));
  }

  function getPrevNext() {
    const list = window.OPENCLAW_ARTICLES || [];
    const i = list.findIndex(a => window.location.pathname.endsWith(a.path));
    if (i === -1) return { prev: null, next: null };
    return {
      prev: i > 0 ? list[i - 1] : null,
      next: i < list.length - 1 ? list[i + 1] : null
    };
  }

  /* ---------- 面包屑 ---------- */
  function renderBreadcrumb() {
    const slot = document.querySelector('[data-slot="breadcrumb"]');
    if (!slot) return;
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    // 推断模块:parts[-2] 如 02-architecture
    const moduleDir = parts.length >= 2 ? parts[parts.length - 2] : '';
    const moduleNames = {
      '01-overview': '概览',
      '02-architecture': '核心架构',
      '03-channels': '消息通道',
      '04-models-runtimes': '模型与运行时',
      '05-sessions': '会话与状态',
      '06-tools-hooks': '工具与钩子',
      '07-end-to-end': '端到端流程',
      '08-performance': '性能与延迟',
      '09-error-handling': '异常与降级',
      '10-source-walkthrough': '源码导览'
    };
    const moduleName = moduleNames[moduleDir] || moduleDir;
    const current = getCurrentArticle();
    if (!current) return;
    slot.innerHTML = `
      <a href="${parts.length >= 3 ? '../index.html' : 'index.html'}">首页</a>
      <span class="sep">›</span>
      <a href="${parts.length >= 3 ? '../' + moduleDir + '/index.html' : moduleDir + '/index.html'}">${moduleName}</a>
      <span class="sep">›</span>
      <span class="current">${current.title}</span>
    `;
  }

  /* ---------- 文章元信息条 ---------- */
  function renderArticleMeta() {
    const slot = document.querySelector('[data-slot="article-meta"]');
    if (!slot) return;
    const article = getCurrentArticle();
    if (!article) return;
    slot.innerHTML = `
      <div class="meta-item"><strong>${article.date}</strong></div>
      <div class="meta-item">阅读 <strong>${article.readingTime} 分钟</strong></div>
      <div class="meta-item">作者 <strong>${article.author}</strong></div>
      <div class="meta-item">分类 <strong>${article.category}</strong></div>
      ${article.tags.map(t => `<div class="meta-item"><strong>${t}</strong></div>`).join('')}
    `;
  }

  /* ---------- 上一篇 / 下一篇 ---------- */
  function renderPrevNext() {
    const slot = document.querySelector('[data-slot="prev-next"]');
    if (!slot) return;
    const { prev, next } = getPrevNext();
    const parts = window.location.pathname.split('/').filter(Boolean);
    const prefix = parts.length >= 3 ? './' : '';
    slot.innerHTML = `
      <a class="nav-card ${prev ? '' : 'disabled'}" href="${prev ? prefix + prev.path : '#'}">
        <div class="nav-label">← 上一篇</div>
        <div class="nav-title">${prev ? prev.title : '已是第一篇'}</div>
      </a>
      <a class="nav-card next ${next ? '' : 'disabled'}" href="${next ? prefix + next.path : '#'}">
        <div class="nav-label">下一篇 →</div>
        <div class="nav-title">${next ? next.title : '已是最后一篇'}</div>
      </a>
    `;
  }

  /* ---------- 注入侧边栏 ---------- */
  function injectSidebar() {
    const slot = document.querySelector('.sidebar');
    if (!slot) return;
    if (slot.dataset.injected === 'true') return;
    fetch(withVersion('../assets/sidebar.html'))
      .then(r => r.ok ? r.text() : (slot.dataset.path === 'root' ? fetch(withVersion('assets/sidebar.html')).then(rr => rr.text()) : ''))
      .then(html => {
        if (html) {
          slot.innerHTML = html;
          slot.dataset.injected = 'true';
          highlightActiveLink();
        }
      })
      .catch(() => {});
  }

  function highlightActiveLink() {
    const path = window.location.pathname;
    document.querySelectorAll('.sidebar-link, .sidebar-home').forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      if (path.endsWith(href.replace(/^\.\.\//, '').replace(/^\.\//, ''))) {
        link.classList.add('active');
      }
    });
  }

  /* ---------- 移动端切换 ---------- */
  function bindMenuToggle() {
    const btn = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (btn && sidebar) {
      btn.addEventListener('click', () => sidebar.classList.toggle('open'));
    }
    document.addEventListener('click', (e) => {
      if (window.innerWidth > 900) return;
      const sidebar = document.querySelector('.sidebar');
      if (!sidebar || !sidebar.classList.contains('open')) return;
      if (e.target.closest('.sidebar-link')) sidebar.classList.remove('open');
    });
  }

  /* ---------- 滚动时激活当前 h2 ---------- */
  function initHeadingObserver() {
    const headings = document.querySelectorAll('.article h2, .article h3');
    if (!headings.length) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (!id) return;
          document.querySelectorAll('.sidebar-link').forEach(link => {
            const href = link.getAttribute('href') || '';
            if (href.includes('#' + id)) link.classList.add('active');
            else if (!href.includes('#')) link.classList.remove('active');
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach(h => { if (h.id) observer.observe(h); });
  }

  /* ---------- 深链接锚点定位 ---------- */
  /* Mermaid 渲染会在锚点上方插入 SVG,文档高度随之增长,把小节推下去;
     浏览器在加载时的片段跳转按初始布局计算落点,结果常常偏掉甚至落空。
     这里在布局稳定前反复重新定位,保证深链接最终停在正确的小节。 */
  function initHashAnchor() {
    const hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    let target = null;
    try {
      target = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch (e) {
      return;
    }
    if (!target) return;

    let lastHeight = -1;
    let stable = 0;
    let ticks = 0;
    let stopped = false;

    // 用户一旦手动滚动就停止跟随,不再把人拉回去
    ['wheel', 'touchstart', 'keydown'].forEach(evt => {
      window.addEventListener(evt, () => { stopped = true; }, { passive: true, once: true });
    });

    function place() {
      if (stopped) return;
      const height = document.documentElement.scrollHeight;
      if (height === lastHeight) {
        stable++;
      } else {
        lastHeight = height;
        stable = 0;
      }
      // 用绝对偏移而不是 scrollIntoView:后者会连带滚动祖先容器,
      // 且在视口高度异常时会把页面顶到底部。
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const top = target.getBoundingClientRect().top + window.scrollY - margin;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      ticks++;
      // 连续 12 次(约 600ms)高度不变,认为布局已稳定
      if (stable >= 12 || ticks >= 120) return;
      // 用定时器而非 rAF:后台标签页里 rAF 会被暂停,深链接就再也定位不了
      setTimeout(place, 50);
    }
    setTimeout(place, 0);
  }

  /* ---------- 初始化 ---------- */
  function init() {
    initTheme();
    bindThemeToggle();
    bindMenuToggle();
    initReadingProgress();
    injectSidebar();
    renderBreadcrumb();
    renderArticleMeta();
    renderPrevNext();
    initHeadingObserver();
    initHashAnchor();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
