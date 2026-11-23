/**
 * UI 工具：转义、toast、弹窗、确认框。
 * 依赖全局 document，便于在 happy-dom 中测试。
 */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function toast(message, type = '') {
  const root = document.getElementById('toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.remove(); }, 2200);
}

export function openModal(html, { onMount, wide } = {}) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay"><div class="modal${wide ? ' wide' : ''}">${html}</div></div>`;
  const overlay = root.querySelector('.overlay');
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
  if (onMount) onMount(root);
}

export function closeModal() {
  const root = document.getElementById('modalRoot');
  if (root) root.innerHTML = '';
}

/** 确认框，返回 Promise<boolean> */
export function confirmDialog({ title, text, okText = '确认删除', danger = true }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeModal(); resolve(v); };
    openModal(`
      <div class="modal-title">${esc(title)}</div>
      <div class="modal-body confirm-text">${text}</div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-act="cancel">取消</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="ok">${esc(okText)}</button>
      </div>
    `, { onMount: (root) => {
      root.querySelector('[data-act="cancel"]').onclick = () => finish(false);
      root.querySelector('[data-act="ok"]').onclick = () => finish(true);
    }});
  });
}

export const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
export const ICON_PLAN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>';
export const ICON_RECORD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>';

export function emptyHTML(icon, title, text, btnText, btnId) {
  return `<div class="empty">
    <div class="empty-icon">${icon}</div>
    <div class="empty-title">${esc(title)}</div>
    <div class="empty-text">${esc(text)}</div>
    <button class="btn btn-primary" id="${btnId}">${esc(btnText)}</button>
  </div>`;
}
