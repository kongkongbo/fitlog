/**
 * 应用入口：初始化数据库、导航路由、PWA。
 */
import * as db from './db.js';
import * as pages from './pages.js';

const renderers = {
  plans: pages.renderPlans,
  records: pages.renderRecords,
  stats: pages.renderStats,
  settings: pages.renderSettings,
};

let current = 'plans';

export function go(page) {
  if (!renderers[page]) return;
  current = page;
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.page === page));
  document.querySelectorAll('.tab-item').forEach((el) => el.classList.toggle('active', el.dataset.page === page));
  const scroller = document.getElementById('scroller');
  if (scroller) scroller.scrollTop = 0;
  const content = document.getElementById('content');
  return renderers[page]({ content, go });
}

function buildTabbar() {
  const items = [
    ['plans', '计划', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'],
    ['records', '记录', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>'],
    ['stats', '进步', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-9"/><path d="M21 6v5h-5"/></svg>'],
    ['settings', '我的', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>'],
  ];
  const bar = document.createElement('nav');
  bar.className = 'tabbar';
  bar.id = 'tabbar';
  bar.innerHTML = items.map(([key, label, icon]) => `<button class="tab-item${key === 'plans' ? ' active' : ''}" data-page="${key}">
    <span class="nav-icon">${icon}</span><span>${label}</span>
  </button>`).join('');
  document.body.appendChild(bar);
  bar.querySelectorAll('.tab-item').forEach((el) => { el.onclick = () => go(el.dataset.page); });
}

export async function init() {
  db.init(typeof indexedDB !== 'undefined' ? indexedDB : null);
  document.querySelectorAll('.nav-item').forEach((el) => { el.onclick = () => go(el.dataset.page); });
  buildTabbar();
  await go('plans');

  if ('serviceWorker' in navigator) {
    const register = () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW 注册失败', err));
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }
}

if (typeof document !== 'undefined' && document.getElementById('nav')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
