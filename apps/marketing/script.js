(() => {
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const menuLabel = menuButton?.querySelector('.sr-only');
  const nav = document.querySelector('[data-nav]');
  const year = document.querySelector('[data-year]');

  const setMenuOpen = (open) => {
    menuButton?.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('open', open);
    if (menuLabel) menuLabel.textContent = open ? 'Close navigation' : 'Open navigation';
  };

  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true';
    setMenuOpen(!open);
  });

  nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    setMenuOpen(false);
  }));

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || menuButton?.getAttribute('aria-expanded') !== 'true') return;
    setMenuOpen(false);
    menuButton.focus();
  });

  document.addEventListener('click', (event) => {
    if (menuButton?.getAttribute('aria-expanded') !== 'true') return;
    const target = event.target;
    if (target instanceof Node && (menuButton.contains(target) || nav?.contains(target))) return;
    setMenuOpen(false);
  });

  const setHeader = () => header?.classList.toggle('scrolled', window.scrollY > 18);
  window.addEventListener('scroll', setHeader, { passive: true });
  setHeader();

  if (year) year.textContent = new Date().getFullYear().toString();
})();
