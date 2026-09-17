/* UI access gate for Basic, Silver, and Gold features. */
(() => {
  const freeActions = new Set(['scan-map-header', 'scan-profession', 'scan-composter', 'scan-resource-tools']);
  // The data attribute is presentation only. Permission comes from the
  // signed assertion retained by licenseManager in memory.
  const canUse = (required) => window.licenseManager?.hasTier?.(required) === true;
  const labelFor = (required) => required === 'gold' ? 'Gold' : 'Silver';
  const requiredFor = (element) => {
    if (!(element instanceof Element)) return '';
    if (element.closest('.profession-auto-card')) return 'gold';
    if (element.closest('.cheer-card, [data-cheer-action]')) return 'silver';
    const action = element.closest('[data-ui-action]')?.dataset.uiAction;
    return action && !freeActions.has(action) ? 'silver' : '';
  };
  const lockOwnerFor = (element, required) => {
    if (element.closest('.profession-auto-card, .cheer-card')) return element.closest('.profession-auto-card, .cheer-card');
    const action = element.closest('[data-ui-action]');
    // Tool-shop controls and their resource action overlays share a card.
    // Lock just the control so the other control remains reachable.
    if (action?.matches('.resource-tool-buy, .resource-card-hover-overlay')) return action;
    // A manual map action locks its complete card, keeping the card readable
    // until the user hovers it and sees the full premium overlay.
    if (action && required === 'silver') return action.closest('.crop-card') || action;
    return action || element;
  };
  const apply = (root = document) => {
    const elements = root instanceof Element ? [root, ...root.querySelectorAll('*')] : root.querySelectorAll?.('*') || [];
    elements.forEach((element) => {
      if (!(element instanceof Element)) return;
      const required = requiredFor(element);
      const owner = required ? lockOwnerFor(element, required) : null;
      if (!owner || owner.dataset.featureRequired) return;
      owner.dataset.featureRequired = required;
      owner.dataset.featureUpgrade = labelFor(required);
    });
  };
  const refresh = () => {
    document.querySelectorAll('[data-feature-required]').forEach((element) => {
      const required = element.dataset.featureRequired;
      element.dataset.featureUpgrade = labelFor(required);
      element.classList.toggle('is-feature-locked', !canUse(required));
    });
  };
  const gateClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const required = requiredFor(target);
    if (!required || canUse(required)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const owner = target.closest('[data-feature-required]') || target.closest('.profession-auto-card, .cheer-card, [data-ui-action]');
    if (owner instanceof HTMLElement) {
      owner.dataset.featureUpgrade = labelFor(required);
      owner.classList.add('is-feature-locked', 'is-feature-gate-notice');
      window.setTimeout(() => owner.classList.remove('is-feature-gate-notice'), 1800);
    }
  };
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) apply(node);
    }));
    refresh();
  });
  window.refreshFeatureAccess = () => { apply(); refresh(); };
  document.addEventListener('click', gateClick, true);
  window.addEventListener('sunflower-language-changed', () => refresh());
  window.addEventListener('sunflower-license-tier-changed', () => refresh());
  observer.observe(document.body, { childList: true, subtree: true });
  apply();
  refresh();
})();
