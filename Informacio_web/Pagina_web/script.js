const GAME_URL = "";

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
menuButton.hidden = false;
navigation.classList.add('menu-ready');

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  navigation.classList.remove('is-open');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});

function setupGameLink(value) {
  if (!value.trim()) return;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return;
    const link = document.querySelector('#game-link');
    link.href = url.href;
    link.hidden = false;
    document.querySelector('#game-pending').hidden = true;
    document.querySelector('#game-status').textContent = 'Todo listo. Abre el juego en una nueva pestaña y empieza a jugar.';
  } catch {
    // Un enlace incompleto mantiene el estado «Próximamente».
  }
}
setupGameLink(GAME_URL);
