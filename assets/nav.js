// OpenClaw Source Analysis · 导航脚本
// 自动高亮当前页面对应的侧边栏链接

(function () {
  'use strict';

  // 移动端侧边栏切换
  const menuToggle = document.querySelector('.menu-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) sidebar.classList.remove('open');
      });
    });
  }

  // 当前路径高亮
  const currentPath = window.location.pathname;
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && currentPath.endsWith(href.replace(/\.\.\//g, ''))) {
      link.classList.add('active');
    }
  });

  // 滚动时侧边栏自动高亮章节
  const headings = document.querySelectorAll('.article h2, .article h3');
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  if (headings.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id) {
            sidebarLinks.forEach(link => {
              const href = link.getAttribute('href');
              if (href && href.includes('#' + id)) {
                link.classList.add('active');
              } else {
                link.classList.remove('active');
              }
            });
          }
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    headings.forEach(h => {
      if (h.id) observer.observe(h);
    });
  }
})();
