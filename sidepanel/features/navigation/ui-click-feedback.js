/* Lightweight pointer feedback for genuine user clicks inside the sidepanel. */
(() => {
  const show = (x, y, type = 'forward') => {
    const effect = document.createElement('i');
    effect.className = `pointer-feedback pointer-feedback-${type}`;
    effect.style.left = `${Number(x) || 0}px`;
    effect.style.top = `${Number(y) || 0}px`;
    effect.setAttribute('aria-hidden', 'true');
    document.body.append(effect);
    effect.addEventListener('animationend', () => effect.remove(), { once: true });
  };

  document.addEventListener('pointerdown', (event) => {
    if (!event.isTrusted || event.button !== 0) return;
    show(event.clientX, event.clientY);
  }, true);
  document.addEventListener('contextmenu', (event) => {
    if (!event.isTrusted) return;
    show(event.clientX, event.clientY, 'back');
  }, true);
})();