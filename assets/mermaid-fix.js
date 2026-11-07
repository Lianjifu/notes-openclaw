/* OpenClaw Docs · Mermaid 渲染后强制覆盖脚本
   解决 mermaid 把 diagram 内的 style ... 编译成 inline !important 后,
   CSS class+!important 特异性(0,0,1,0) < inline !important (1,0,0,0),
   导致 dark mode 下节点深底深字看不清的问题。
   本脚本在 mermaid 渲染完成后,直接重写每个节点的 inline style,
   强制使用浅色填充 + 深色文字(高对比,可读)。 */
(function () {
  'use strict';

  // 调色板:按节点原本的 stroke 颜色判断原始语义角色,给出对应"亮底 + 深字"
  var PALETTES = {
    blue:   { dark: '#dbeafe', border: '#2563eb' },
    purple: { dark: '#ede9fe', border: '#7c3aed' },
    pink:   { dark: '#fce7f3', border: '#c026d3' },
    orange: { dark: '#fef3c7', border: '#d97706' },
    green:  { dark: '#d1fae5', border: '#059669' },
    cyan:   { dark: '#cffafe', border: '#0891b2' },
    red:    { dark: '#fee2e2', border: '#dc2626' },
    gray:   { dark: '#f1f5f9', border: '#94a3b8' },
    white:  { dark: '#ffffff', border: '#2563eb' },
  };

  function classifyStroke(hex) {
    if (!hex) return 'white';
    var h = hex.toLowerCase().replace('#', '');
    if (h === '2563eb' || h === '1e3a8a' || h === '1f6feb') return 'blue';
    if (h === '7c3aed' || h === '5b21b6') return 'purple';
    if (h === 'c026d3' || h === 'a21caf') return 'pink';
    if (h === 'd97706' || h === 'b45309') return 'orange';
    if (h === '059669' || h === '047857' || h === '238636') return 'green';
    if (h === '0891b2' || h === '0e7490') return 'cyan';
    if (h === 'dc2626' || h === 'b91c1c' || h === 'f78166') return 'red';
    if (h === '94a3b8' || h === '64748b' || h === '475569') return 'gray';
    return 'white';
  }

  function parseStyle(style) {
    var out = { fill: null, stroke: null, color: null };
    if (!style) return out;
    style.split(';').forEach(function (kv) {
      var parts = kv.split(':');
      if (parts.length < 2) return;
      var key = parts[0].trim();
      var val = parts.slice(1).join(':').trim().replace(/!important$/, '').trim();
      if (key === 'fill') out.fill = val;
      else if (key === 'stroke') out.stroke = val;
      else if (key === 'color') out.color = val;
    });
    return out;
  }

  function toHex(color) {
    if (!color) return null;
    if (color.charAt(0) === '#') return color.toLowerCase();
    var m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      var h = function (n) { return parseInt(n, 10).toString(16).padStart(2, '0'); };
      return '#' + h(m[1]) + h(m[2]) + h(m[3]);
    }
    return color.toLowerCase();
  }

  // 标记已处理过,避免重复 / 循环。
  // 用数组而不是 DOM 属性: mermaid 渲染时会在 body 里先插一个空的 <svg>,
  // 再把填好的 SVG 以外层 HTML 的形式交出来。那个空 SVG 如果被打上
  // data-mermaid-fixed 标记,标记会随 outerHTML 一起被复制到最终那张图上,
  // 导致最终那张图被当成「已经修过了」而跳过 —— 文字颜色就没被修正。
  var processed = [];
  function markDone(el) { if (processed.indexOf(el) < 0) processed.push(el); }
  function isDone(el)  { return processed.indexOf(el) >= 0; }

  function fixSvg(svg) {
    if (isDone(svg)) return;
    try {
      fixSvgInner(svg);
      markDone(svg);
    } catch (err) {
      // 修正失败不能连累整页:不记入名单,下次再试一次
      if (window.console && console.warn) {
        console.warn('[mermaid-fix] 修正失败:', err && err.message);
      }
    }
  }

  function fixSvgInner(svg) {
    // 1) 节点 rect / polygon — 根据 stroke 颜色判断语义角色
    var nodes = svg.querySelectorAll('rect.basic, polygon.basic, rect, polygon');
    nodes.forEach(function (n) {
      var styleAttr = n.getAttribute('style') || '';
      var p = parseStyle(styleAttr);
      var strokeHex = toHex(p.stroke);
      var fillHex = toHex(p.fill);
      if (!fillHex && !strokeHex) return;
      // 只跳过 cluster 自己的那层边框(父节点是 g.cluster),
      // 不能跳过子图里的节点 —— 否则子图中的节点会保持 mermaid 深色主题的
      // 深底,再配上有意设成深色的文字,就成了深字压深底、整块看不见。
      var parent = n.parentNode;
      if (parent && parent.className && /(^|\s)cluster(\s|$)/.test(parent.className)) return;
      if (!p.stroke && fillHex === '#ffffff') return;
      var key = classifyStroke(strokeHex);
      var pal = PALETTES[key] || PALETTES.white;
      n.style.setProperty('fill', pal.dark, 'important');
      n.style.setProperty('stroke', pal.border, 'important');
    });

    // 2) cluster 容器
    var clusters = svg.querySelectorAll('.cluster rect, .cluster polygon');
    clusters.forEach(function (c) {
      c.style.setProperty('fill', '#f8fafc', 'important');
      c.style.setProperty('stroke', '#94a3b8', 'important');
    });

    // 3) cluster label
    var clusterLabels = svg.querySelectorAll('.cluster .cluster-label, .cluster text');
    clusterLabels.forEach(function (t) {
      t.style.setProperty('fill', '#475569', 'important');
      t.style.setProperty('color', '#475569', 'important');
    });

    // 4) 节点文字: foreignObject div / span / p(关键:覆盖 .article p 浅色规则)
    //    mermaid v11 stateDiagram 用 <span class="nodeLabel"><p>...</p></span> 结构,
    //    p 元素会被 .article p { color: var(--text-secondary) } 覆盖成浅色
    var labelDivs = svg.querySelectorAll(
      'foreignObject div, foreignObject span, foreignObject p, ' +
      '.nodeLabel, .edgeLabel, .nodeLabel p, .edgeLabel p'
    );
    labelDivs.forEach(function (d) {
      d.style.setProperty('color', '#1a1f2b', 'important');
    });
    // 强制 p 标签深色(防止 .article p 优先级覆盖)
    svg.querySelectorAll('foreignObject p, .nodeLabel p, .edgeLabel p').forEach(function (p) {
      p.style.setProperty('color', '#1a1f2b', 'important');
      p.style.setProperty('margin', '0', 'important');
      p.style.setProperty('padding', '0', 'important');
    });
    var labelTexts = svg.querySelectorAll('text, .nodeLabel text, .edgeLabel text, .label text, tspan');
    labelTexts.forEach(function (t) {
      t.style.setProperty('fill', '#1a1f2b', 'important');
      t.style.setProperty('color', '#1a1f2b', 'important');
    });

    // 4.5) 标签的排版必须还原成 mermaid 量尺寸时的样子。
    //      mermaid 是先按自己的排版把每个 <foreignObject> 的宽高量好,
    //      再照这个尺寸去画节点框和标签。站点样式会渗进图里的 HTML:
    //        .doc-section p           { margin:.6rem 0; line-height:1.65 }
    //        .diagram svg .nodeLabel { padding:4px 6px }
    //      这些一改,文字就比量好的 foreignObject 高,
    //      而 SVG 会把超出的部分直接裁掉 —— 表现就是「文字展示不全」:
    //      节点标签只剩第一行,边上的标签只剩前半截。
    //      这里把盒模型与行高还原,让文字重新落回 mermaid 量好的尺寸里。
    svg.querySelectorAll('foreignObject div, foreignObject span, foreignObject p').forEach(function (el) {
      el.style.setProperty('margin', '0', 'important');
      el.style.setProperty('padding', '0', 'important');
      el.style.setProperty('line-height', '1.5', 'important');
    });

    // 5) **关键修复**: edge label 背景强制白底
    //    mermaid v11 渲染的 edgeLabel 可能包含:
    //    - <rect> 元素(老版本)
    //    - <foreignObject> 内 <div>(新版本,htmlLabels: true)
    //    两种都要覆盖
    var edgeLabels = svg.querySelectorAll('.edgeLabel');
    edgeLabels.forEach(function (e) {
      // rect 背景
      var rects = e.querySelectorAll('rect');
      rects.forEach(function (r) {
        r.style.setProperty('fill', '#ffffff', 'important');
        r.style.setProperty('stroke', '#94a3b8', 'important');
        r.style.setProperty('stroke-width', '1px', 'important');
      });
      // foreignObject div 背景
      var fDivs = e.querySelectorAll('foreignObject div');
      fDivs.forEach(function (d) {
        d.style.setProperty('background', '#ffffff', 'important');
        d.style.setProperty('background-color', '#ffffff', 'important');
        d.style.setProperty('color', '#1a1f2b', 'important');
        d.style.setProperty('padding', '2px 6px', 'important');
        d.style.setProperty('border-radius', '4px', 'important');
      });
      // 容器自身
      e.style.setProperty('background', '#ffffff', 'important');
    });

    // 6) edge label 的 tspan(箭头上的文字)
    var edgeLabelTexts = svg.querySelectorAll('.edgeLabel tspan, .edgeLabel foreignObject span');
    edgeLabelTexts.forEach(function (t) {
      t.style.setProperty('fill', '#1a1f2b', 'important');
      t.style.setProperty('color', '#1a1f2b', 'important');
    });

    // 7) 状态图(stateDiagram)节点 — 强制白底深字
    var stateNodes = svg.querySelectorAll('[class*="state"] rect, [class*="state"] polygon');
    stateNodes.forEach(function (n) {
      n.style.setProperty('fill', '#ffffff', 'important');
      n.style.setProperty('stroke', '#2563eb', 'important');
    });

    // 8) 按自然尺寸渲染,不要压缩。
    //    mermaid 用 useMaxWidth 把 svg 写成 width="100%" + max-width:<自然宽>px,
    //    容器再一 max-width:100%,宽图就被等比压扁 —— 16px 的字缩到 2px,
    //    整张图糊成一片黑块(「文字不清晰」「背景淹没文字」都是这个引起的)。
    //    这里把宽度写死成 viewBox 的自然宽度,图按 1:1 画,
    //    超宽的部分由 .diagram 容器横向滚动承接。
    var vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(parseFloat);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.setProperty('width', vb[2] + 'px', 'important');
      svg.style.setProperty('height', vb[3] + 'px', 'important');
      svg.style.setProperty('max-width', 'none', 'important');
      // .diagram 是 flex 容器,不加 flex:0 0 auto 会被压回容器宽度
      svg.style.setProperty('flex', '0 0 auto', 'important');
    }
    // 9) 兜底:万一还有溢出(比如某个标签天生就比框高),
    //      把 foreignObject 撑到刚好装下,并同步放大节点框,保证文字不被裁。
    svg.querySelectorAll('foreignObject').forEach(function (fo) {
      var inner = fo.querySelector('div');
      if (!inner) return;
      // 文字真正占用的盒子:取最里层的文字元素,再加上 div 自己的 padding
      // (div 是 display:table-cell,量它本身会被表格布局撑大,不能直接用)
      var txt = inner.querySelector('p') || inner.querySelector('span');
      var ics = getComputedStyle(inner);
      var padV = (parseFloat(ics.paddingTop) || 0) + (parseFloat(ics.paddingBottom) || 0);
      var padH = (parseFloat(ics.paddingLeft) || 0) + (parseFloat(ics.paddingRight) || 0);
      var fw = parseFloat(fo.getAttribute('width')) || 0;
      var fh = parseFloat(fo.getAttribute('height')) || 0;
      var fr = fo.getBoundingClientRect();
      if (!fw || !fh || !fr.width || !fr.height) return;
      var scale = fr.width / fw;                 // svg 被 CSS 缩放时的比例
      var bh, bw;
      if (txt) {
        var tr = txt.getBoundingClientRect();
        bh = tr.height + padV;
        bw = tr.width + padH;
      } else {
        var ir = inner.getBoundingClientRect();
        bh = ir.height;
        bw = ir.width;
      }
      var needH = Math.ceil(bh / scale);
      var needW = Math.ceil(bw / scale);
      if (needH <= fh + 1 && needW <= fw + 1) return;
      var newH = Math.max(fh, needH);
      var newW = Math.max(fw, needW);
      fo.setAttribute('height', newH);
      fo.setAttribute('width', newW);
      var g = fo.closest('g.label');
      if (g) g.setAttribute('transform', 'translate(' + (-newW / 2) + ',' + (-newH / 2) + ')');
      var node = fo.closest('g.node');
      var rect = node && node.querySelector('rect');
      if (rect) {
        var rh = parseFloat(rect.getAttribute('height')) || 0;
        var rw = parseFloat(rect.getAttribute('width')) || 0;
        var rx = parseFloat(rect.getAttribute('x')) || 0;
        var ry = parseFloat(rect.getAttribute('y')) || 0;
        if (newH > fh) { rect.setAttribute('height', rh + (newH - fh)); rect.setAttribute('y', ry - (newH - fh) / 2); }
        if (newW > fw) { rect.setAttribute('width', rw + (newW - fw)); rect.setAttribute('x', rx - (newW - fw) / 2); }
      }
    });

    // 10) 宽度自适应:能缩到容器宽度就缩,让整张图一次看全。
    //     时序图天生很宽(7 个参与者就有一千多像素),之前一律按自然尺寸画,
    //     结果左右两端被卡片裁掉 —— 表现就是「图显示不全」。
    //     缩放比低于 MIN_SCALE 时文字就太小了,这时保持原尺寸,
    //     交给卡片横向滚动(配合 .diagram 的 safe center,两端都滚得到)。
    var MIN_SCALE = 0.68;
    var box = svg.parentElement;
    if (box && box.classList && box.classList.contains('diagram')) {
      var bcs = getComputedStyle(box);
      var inner = (box.clientWidth || 0) -
                  (parseFloat(bcs.paddingLeft) || 0) -
                  (parseFloat(bcs.paddingRight) || 0);
      if (inner > 0 && vb[2] > 0) {
        // 先回到自然尺寸再决定缩放还是滚动 ——
        // 否则窗口变窄后,上一轮缩小的宽度会一直留着。
        svg.style.setProperty('width', vb[2] + 'px', 'important');
        svg.style.setProperty('height', vb[3] + 'px', 'important');
        svg.style.setProperty('max-width', 'none', 'important');
        var hint = box.nextElementSibling;
        var hasHint = !!(hint && hint.classList && hint.classList.contains('diagram-scroll-hint'));
        if (vb[2] > inner) {
          var sc = inner / vb[2];
          if (sc >= MIN_SCALE) {
            svg.style.setProperty('width', inner + 'px', 'important');
            svg.style.setProperty('height', Math.round(vb[3] * sc) + 'px', 'important');
            box.classList.remove('is-wide');
            if (hasHint) hint.parentNode.removeChild(hint);
          } else {
            // 缩不动就横向滚动,并给出提示
            box.classList.add('is-wide');
            if (!hasHint) {
              var tip = document.createElement('p');
              tip.className = 'diagram-scroll-hint';
              tip.textContent = '← 可横向滚动查看完整图 →';
              box.parentNode.insertBefore(tip, box.nextSibling);
            }
          }
        } else {
          box.classList.remove('is-wide');
          if (hasHint) hint.parentNode.removeChild(hint);
        }
      }
    }

  }

  function fixAll() {
    document.querySelectorAll('.diagram > svg').forEach(fixSvg);
  }

  // 单张图修正:渲染完立刻调用,不用等轮询
  window.OPENCLAW_FIX_SVG = function (svg) {
    if (svg) fixSvg(svg);
  };

  // 监听新插入的 svg,插进来就修 —— 不再每 100ms 全量轮询 3 秒。
  // (02-architecture.html 一次全量扫描 74ms,轮询 30 次就是 2.2 秒白烧)
  // 只处理 .diagram 容器里的 svg:mermaid 渲染时会在 body 里先插一个空的
  // <svg> 占位,那个不能碰 —— 它会被填好后连同属性一起交给页面。
  if (window.MutationObserver) {
    var mo = new MutationObserver(function (records) {
      records.forEach(function (rec) {
        Array.prototype.forEach.call(rec.addedNodes, function (node) {
          if (node.nodeType !== 1) return;
          if (node.tagName && node.tagName.toLowerCase() === 'svg') {
            if (node.closest && node.closest('.diagram')) fixSvg(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('.diagram > svg').forEach(fixSvg);
          }
        });
      });
    });
    if (document.body) {
      mo.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        mo.observe(document.body, { childList: true, subtree: true });
      });
    }
  }

  // 布局变了(窗口缩放)再统一修一遍
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      window.OPENCLAW_MERMAID_FIX();
    }, 200);
  });

  // 暴露手动调用(主题切换 / 异步渲染后重跑)
  // 清空「已处理」名单,重跑所有 svg
  window.OPENCLAW_MERMAID_FIX = function () {
    processed.length = 0;
    fixAll();
  };
})();
