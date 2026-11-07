// OpenClaw Docs Site · 代码块复制按钮 + 平台脚本

(function () {
  'use strict';

  /* ---------- 代码块复制按钮 ---------- */
  function initCodeCopy() {
    document.querySelectorAll('.article pre').forEach((pre) => {
      // 跳过已有按钮的
      if (pre.parentElement.classList.contains('code-block-wrapper')) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '复制';
      btn.setAttribute('aria-label', '复制代码');
      wrapper.appendChild(btn);

      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('copied');
          }, 2000);
        } catch (err) {
          // Fallback
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(() => {
            btn.textContent = '复制';
            btn.classList.remove('copied');
          }, 2000);
        }
      });
    });
  }

  /* ---------- 文章列表渲染 ---------- */
  function renderArticleList(articles, targetSelector, options = {}) {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const sorted = [...articles].sort((a, b) => {
      if (options.sortBy === 'module') return a.module.localeCompare(b.module) || a.title.localeCompare(b.title);
      return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    });
    target.innerHTML = sorted.map(a => `
      <a class="article-list-item" href="${a.path}">
        <div class="article-title">${a.title}</div>
        <div class="article-summary">${a.summary}</div>
        <div class="article-footer">
          <span>${a.date}</span>
          <span>${a.readingTime} 分钟</span>
          <span>${a.category}</span>
          ${a.tags.slice(0, 3).map(t => `<span class="footer-tag">${t}</span>`).join('')}
        </div>
      </a>
    `).join('');
  }

  /* ---------- 标签云渲染 ---------- */
  function renderTagCloud(articles, targetSelector) {
    const target = document.querySelector(targetSelector);
    if (!target) return;
    const counts = {};
    articles.forEach(a => a.tags.forEach(t => {
      counts[t] = (counts[t] || 0) + 1;
    }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    target.innerHTML = sorted.map(([tag, count]) =>
      `<a class="tag-pill" href="articles.html?tag=${encodeURIComponent(tag)}">${tag}<span class="count">${count}</span></a>`
    ).join('');
  }

  /* ---------- 搜索 ---------- */
  function initSearch() {
    const input = document.querySelector('.search-box input');
    const results = document.querySelector('.search-results');
    if (!input || !results) return;

    let articles = window.OPENCLAW_ARTICLES || [];

    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function highlight(text, query) {
      if (!query) return escapeHtml(text);
      const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return escapeHtml(text).replace(re, '<mark>$1</mark>');
    }

    function search(query) {
      const q = query.trim().toLowerCase();
      if (!q) {
        results.innerHTML = '';
        return;
      }
      const matches = articles.filter(a => {
        const hay = (a.title + ' ' + a.summary + ' ' + a.tags.join(' ') + ' ' + a.category).toLowerCase();
        return hay.includes(q);
      });
      if (matches.length === 0) {
        results.innerHTML = '<div class="search-empty">没有找到相关文章</div>';
        return;
      }
      results.innerHTML = matches.map(a => `
        <a class="search-result-item" href="${a.path}">
          <div class="result-title">${highlight(a.title, q)}</div>
          <div class="result-meta">${a.category} · ${a.readingTime} 分钟 · ${a.date}</div>
          <div class="result-snippet">${highlight(a.summary, q)}</div>
        </a>
      `).join('');
    }

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => search(input.value), 200);
    });

    // URL 参数自动填充
    const urlParams = new URLSearchParams(window.location.search);
    const qParam = urlParams.get('q');
    if (qParam) {
      input.value = qParam;
      search(qParam);
    }
  }

  /* ---------- 文章筛选器 ---------- */
  function initArticleFilters() {
    const container = document.querySelector('.article-list-container');
    if (!container) return;
    const articles = window.OPENCLAW_ARTICLES || [];

    // 构建分类和模块选项
    const categories = [...new Set(articles.map(a => a.category))].sort();
    const modules = [...new Set(articles.map(a => a.module))].sort();
    const allTags = [...new Set(articles.flatMap(a => a.tags))].sort();

    const filterBar = document.querySelector('.filter-bar');
    if (filterBar) {
      filterBar.innerHTML = `
        <select id="filter-module">
          <option value="">所有模块</option>
          ${modules.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <select id="filter-category">
          <option value="">所有分类</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <select id="filter-sort">
          <option value="date">按日期排序</option>
          <option value="module">按模块排序</option>
          <option value="readingTime">按阅读时长</option>
        </select>
        <select id="filter-tag" style="min-width:140px;">
          <option value="">所有标签</option>
          ${allTags.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      `;
    }

    const listEl = document.querySelector('.article-list');

    function apply() {
      const mod = document.getElementById('filter-module').value;
      const cat = document.getElementById('filter-category').value;
      const sort = document.getElementById('filter-sort').value;
      const tag = document.getElementById('filter-tag').value;
      let filtered = articles.filter(a => {
        if (mod && a.module !== mod) return false;
        if (cat && a.category !== cat) return false;
        if (tag && !a.tags.includes(tag)) return false;
        return true;
      });
      filtered.sort((a, b) => {
        if (sort === 'module') return a.module.localeCompare(b.module);
        if (sort === 'readingTime') return a.readingTime - b.readingTime;
        return b.date.localeCompare(a.date);
      });
      renderArticleList(filtered, '.article-list', { sortBy: sort });
      document.querySelector('.list-count').textContent = `共 ${filtered.length} 篇`;
    }

    document.querySelectorAll('.filter-bar select').forEach(s => s.addEventListener('change', apply));

    // 从 URL 读取标签筛选
    const urlTag = new URLSearchParams(window.location.search).get('tag');
    if (urlTag) {
      const sel = document.getElementById('filter-tag');
      if (sel) sel.value = urlTag;
    }

    apply();
  }

  /* ---------- 初始化 ---------- */
  function init() {
    initCodeCopy();
    if (document.querySelector('.article-list-container')) {
      initArticleFilters();
    }
    if (document.querySelector('.search-box')) {
      initSearch();
    }
    if (document.querySelector('.tag-cloud')) {
      renderTagCloud(window.OPENCLAW_ARTICLES || [], '.tag-cloud');
    }
    if (document.querySelector('.recent-articles')) {
      const recent = (window.OPENCLAW_ARTICLES || [])
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6);
      renderArticleList(recent, '.recent-articles');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
