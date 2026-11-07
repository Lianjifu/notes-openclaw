/* OpenClaw Docs · Mermaid 渲染调度
   ---------------------------------------------------------------
   之前的做法有三个大开销:
     1) 每个页面在 <head> 里同步加载 mermaid.min.js(压缩后约 860KB,
        解压 3.3MB),它是普通脚本,会卡住 HTML 解析;
     2) 页面加载后一次性把所有图渲染一遍 —— 02-architecture.html 有 44 张,
        实测总耗时 7.6 秒,主线程被占死;
     3) 没有图的页面(index / search / tags / articles)照样下载这 3.3MB。

   这里改成:
     · 页面上没有 [data-mermaid] → 根本不加载 mermaid;
     · mermaid 异步注入,不阻塞 HTML 解析;
     · 图按滚动位置渲染(视口上下 1200px 之内才画),滚到哪画到哪;
     · 首屏之外的图在浏览器空闲时一张一张补齐,不影响交互。

   每页的 Mermaid 配置通过 window.OPENCLAW_MERMAID_INIT(mermaid) 提供,
   没有配置时用默认主题。
*/
(function () {
  'use strict';

  var MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.15.0/dist/mermaid.min.js';
  var MERMAID_INTEGRITY = 'sha384-yQ4mmBBT+vhTAwjFH0toJXNYJ6O4usWnt6EPIdWwrRvx2V/n5lXuDZQwQFeSFydF';

  /* 视口上下多少像素之内就开始画:1500px ≈ 一屏半 */
  var NEAR_MARGIN = 1500;
  /* 页面空闲多久之后开始补齐剩余的图(毫秒) */
  var BACKGROUND_DELAY = 2500;
  /* 兜底扫描的间隔 —— 部分环境(后台标签页 / 无头浏览器)不触发
     IntersectionObserver,靠它保证图最终一定会画出来 */
  var SCAN_INTERVAL = 800;
  /* 后台补图时,两张之间隔多久(毫秒)—— 留出时间给用户交互 */
  var SWEEP_GAP = 150;
  /* 用户滚动后,后台补图要等多久才继续(毫秒) */
  var SCROLL_QUIET = 600;

  var seq = 0;

  function loadMermaid() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = MERMAID_URL;
      s.integrity = MERMAID_INTEGRITY;
      s.crossOrigin = 'anonymous';
      s.async = true;
      s.onload = function () { resolve(window.mermaid); };
      s.onerror = function () { reject(new Error('mermaid 加载失败')); };
      document.head.appendChild(s);
    });
  }

  function boot() {
    var hosts = Array.prototype.slice.call(document.querySelectorAll('.diagram[data-mermaid]'));
    if (!hosts.length) return;              /* 没有图 → 3.3MB 不用下载 */

    var queue = [];
    var busy = false;

    function enqueue(el) {
      if (el.getAttribute('data-mermaid-done') === '1') return;
      if (el.getAttribute('data-mermaid-queued') === '1') return;
      el.setAttribute('data-mermaid-queued', '1');
      queue.push(el);
      if (!busy) drain();
    }

    function drain() {
      busy = true;
      var el = queue.shift();
      if (!el) { busy = false; return; }

      var src = el.getAttribute('data-mermaid');
      el.setAttribute('data-mermaid-done', '1');
      el.removeAttribute('data-mermaid-queued');

      window.mermaid.render('mmd-' + (seq++), src).then(function (res) {
        el.innerHTML = res.svg;
        /* 画完立刻交给 mermaid-fix 做样式修正,不用等轮询 */
        var s = el.querySelector('svg');
        if (window.OPENCLAW_FIX_SVG && s) window.OPENCLAW_FIX_SVG(s);
        drain();
      }).catch(function (err) {
        el.innerHTML = '<pre style="color:#f78166;font-size:0.8rem;">Mermaid 错误: ' + err.message + '</pre>';
        drain();
      });
    }

    /* 视口附近的图先画 */
    function pump() {
      var vh = window.innerHeight || 800;
      hosts.forEach(function (el) {
        if (el.getAttribute('data-mermaid-done') === '1') return;
        if (el.getAttribute('data-mermaid-queued') === '1') return;
        var r = el.getBoundingClientRect();
        if (r.bottom > -NEAR_MARGIN && r.top < vh + NEAR_MARGIN) enqueue(el);
      });
    }

    loadMermaid().then(function (mermaid) {
      if (typeof window.OPENCLAW_MERMAID_INIT === 'function') {
        window.OPENCLAW_MERMAID_INIT(mermaid);
      } else {
        mermaid.initialize({ startOnLoad: false });
      }

      /* 首选 IntersectionObserver:滚动时零成本 */
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            io.unobserve(entry.target);
            enqueue(entry.target);
          });
        }, { rootMargin: NEAR_MARGIN + 'px 0px' });
        hosts.forEach(function (el) { io.observe(el); });
      }

      /* 兜底:滚动 / 缩放 / 定时扫描 —— 保证任何环境下都会画 */
      var ticking = false;
      var lastScroll = 0;
      window.addEventListener('scroll', function () {
        lastScroll = Date.now();
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () { ticking = false; pump(); });
      }, { passive: true });
      window.addEventListener('resize', pump);
      setInterval(pump, SCAN_INTERVAL);
      pump();

      /* 后台把还没滚到的图一张一张补齐,免得 Ctrl+F 搜不到图里的字。
         每张之间留一点间隔,用户滚动时先让路 —— 别把主线程占死。 */
      function sweepTick() {
        if (Date.now() - lastScroll < SCROLL_QUIET) {
          setTimeout(sweepTick, 400);
          return;
        }
        var next = null;
        for (var i = 0; i < hosts.length; i++) {
          var el = hosts[i];
          if (el.getAttribute('data-mermaid-done') !== '1' &&
              el.getAttribute('data-mermaid-queued') !== '1') { next = el; break; }
        }
        if (!next) return;
        enqueue(next);
        setTimeout(sweepTick, SWEEP_GAP);
      }
      setTimeout(sweepTick, BACKGROUND_DELAY);
    }).catch(function (err) {
      hosts.forEach(function (el) {
        el.innerHTML = '<pre style="color:#f78166;font-size:0.8rem;">' + err.message + '</pre>';
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
