/* ============================================================
   theme.js — theme state + toggle widget
   (the actual early data-theme set happens via an inline script
   in each page's <head>, before CSS paints, to avoid a flash)
   ============================================================ */

const Theme = {
  KEY: 'ft_theme',
  get() { return document.documentElement.getAttribute('data-theme') || 'light'; },
  set(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(Theme.KEY, theme);
    window.dispatchEvent(new CustomEvent('ft-theme-changed', { detail: theme }));
  },
  toggle() { Theme.set(Theme.get() === 'dark' ? 'light' : 'dark'); }
};
window.Theme = Theme;

function renderThemeToggle(container) {
  const current = Theme.get();
  container.innerHTML = `
    <div class="theme-toggle" role="group" aria-label="Theme">
      <button type="button" data-theme-btn="light" class="${current === 'light' ? 'active' : ''}" aria-label="Light theme">${Icons.sun}</button>
      <button type="button" data-theme-btn="dark" class="${current === 'dark' ? 'active' : ''}" aria-label="Dark theme">${Icons.moon}</button>
    </div>
  `;
  container.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.onclick = () => {
      Theme.set(btn.dataset.themeBtn);
      renderThemeToggle(container);
    };
  });
}
window.renderThemeToggle = renderThemeToggle;
