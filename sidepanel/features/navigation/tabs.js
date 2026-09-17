/* Panel navigation, settings view, and the temporary seed-picker flow. */

let previousToolTab = 'map';
let previousMapActivity = 'overview';
const navigationHistory = [];
const MAX_NAVIGATION_HISTORY = 60;
const settingsButton = document.querySelector('#open-settings');
const logButton = document.querySelector('#open-log');
const seedLibraryButton = document.querySelector('#open-seed-library');

function getToolTabPanels() {
  return Array.from(document.querySelectorAll('[data-tool-panel]'));
}

function playBottomNavigationPress(button) {
  button?.classList.remove('is-pressing');
  if (!button) return;
  void button.offsetWidth;
  button.classList.add('is-pressing');
  window.setTimeout(() => button.classList.remove('is-pressing'), 320);
}

function currentPanelLocation() {
  const toolTab = getToolTabPanels().find((panel) => !panel.hidden)?.dataset.toolPanel || 'map';
  const mapActivity = mapActivityTabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.mapActivityTab || 'overview';
  return { toolTab, mapActivity };
}

function locationsMatch(left, right) {
  return left.toolTab === right.toolTab && (left.toolTab !== 'map' || left.mapActivity === right.mapActivity);
}

function rememberCurrentPanel() {
  const location = currentPanelLocation();
  if (navigationHistory.length && locationsMatch(navigationHistory.at(-1), location)) return;
  navigationHistory.push(location);
  if (navigationHistory.length > MAX_NAVIGATION_HISTORY) navigationHistory.shift();
}

function activateToolTab(tabName, options = {}) {
  const panels = getToolTabPanels();
  const currentTab = panels.find((panel) => !panel.hidden)?.dataset.toolPanel;
  if (currentTab && currentTab !== tabName && options.history !== false) rememberCurrentPanel();
  if ((tabName === 'settings' || tabName === 'log') && currentTab && currentTab !== tabName) previousToolTab = currentTab;
  toolTabs.forEach((item) => {
    const active = item.dataset.toolTab === tabName;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', String(active));
  });
  panels.forEach((panel) => { panel.hidden = panel.dataset.toolPanel !== tabName; });
  const bottomPanels = [
    { name: 'settings', button: settingsButton },
    { name: 'log', button: logButton },
    { name: 'seeds', button: seedLibraryButton }
  ];
  bottomPanels.forEach(({ name, button }) => {
    const active = tabName === name;
    button?.classList.toggle('is-active', active);
    button?.setAttribute('aria-pressed', String(active));
  });
  Array.from(bottomNavigation?.querySelectorAll('[data-bottom-nav-id]:not([data-map-activity-tab])') || []).forEach((button) => {
    const active = button.dataset.bottomNavId === tabName;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
mapActivityTabs.forEach((tab) => {
    const mapActive = tabName === 'map' && tab.getAttribute('aria-selected') === 'true';
    tab.classList.toggle('is-suspended', tabName !== 'map');
    tab.classList.toggle('is-active', mapActive);
  });
}

function activateMapActivityTab(activity, options = {}) {
  const previousActivity = mapActivityTabs.find((tab) => tab.classList.contains('is-active'))?.dataset.mapActivityTab || '';
  if (previousActivity && previousActivity !== activity && options.history !== false) rememberCurrentPanel();
  if (previousActivity && previousActivity !== activity) previousMapActivity = previousActivity;
  updateMapActivityTabIndicators();
  mapActivityTabs.forEach((tab) => {
    const active = tab.dataset.mapActivityTab === activity;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  mapActivityContent.querySelectorAll('.activity-group').forEach((group) => { group.hidden = group.dataset.activity !== activity; });
  mapActivityContent.querySelectorAll('.crop-panel').forEach((panel) => { panel.hidden = !panel.querySelector('.activity-group:not([hidden])'); });
  mapActivityContent.querySelectorAll('.empty-state').forEach((state) => { state.hidden = activity !== 'crop' && state.dataset.activity !== activity; });
  if (previousActivity === 'cheer' && activity !== 'cheer' && typeof closeCheerPanel === 'function') void closeCheerPanel();
}

function updateMapActivityTabIndicators() {
  mapActivityTabs.forEach((tab) => {
    const activity = tab.dataset.mapActivityTab;
    const readySelector = activity === 'crop' || activity === 'fruit' ? `[data-activity="${activity}"] .crop-card.is-ready, [data-activity="${activity}"] .crop-card.is-empty` : activity === 'tools' ? `[data-activity="tools"] .shop-card` : `[data-activity="${activity}"] .crop-card.is-ready`;
    tab.classList.toggle('has-ready', Boolean(mapActivityContent.querySelector(readySelector)));
  });
}

settingsButton?.addEventListener('click', () => { playBottomNavigationPress(settingsButton); activateToolTab('settings'); });
logButton?.addEventListener('click', () => { playBottomNavigationPress(logButton); activateToolTab('log'); });
seedLibraryButton?.addEventListener('click', () => { playBottomNavigationPress(seedLibraryButton); activateToolTab('seeds'); });
toolTabs.forEach((tab) => tab.addEventListener('click', () => activateToolTab(tab.dataset.toolTab)));
mapActivityTabs.forEach((tab) => tab.addEventListener('click', () => {
  playBottomNavigationPress(tab);
  activateToolTab('map');
  activateMapActivityTab(tab.dataset.mapActivityTab);
}));

// Side mouse button 4 and the right mouse button follow the full panel history.
// Right-click remains normal in editable fields.
const isEditableTarget = (target) => target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
const returnToPreviousPanel = () => {
  const current = currentPanelLocation();
  while (navigationHistory.length) {
    const target = navigationHistory.pop();
    if (!target || locationsMatch(target, current)) continue;
    if (target.toolTab === 'map') {
      const mapTab = mapActivityTabs.find((tab) => tab.dataset.mapActivityTab === target.mapActivity && !tab.hidden);
      if (!mapTab) continue;
      activateToolTab('map', { history: false });
      activateMapActivityTab(target.mapActivity, { history: false });
      return true;
    }
    const toolTab = getToolTabPanels().find((panel) => panel.dataset.toolPanel === target.toolTab);
    if (!toolTab) continue;
    activateToolTab(target.toolTab, { history: false });
    return true;
  }
  return false;
};
const handleMouseBack = (event) => {
  const isSeedPicker = !seedPickerModal?.hidden;
  if (event.button === 3 && isSeedPicker && typeof cancelSeedPicker === 'function') { event.preventDefault(); event.stopPropagation(); void cancelSeedPicker(); return; }
  if (event.button !== 3 || isEditableTarget(event.target) || !returnToPreviousPanel()) return;
  event.preventDefault();
  event.stopPropagation();
};
document.addEventListener('mousedown', handleMouseBack, true);
document.addEventListener('mouseup', (event) => { if (event.button === 3) event.preventDefault(); }, true);
document.addEventListener('auxclick', (event) => { if (event.button === 3) event.preventDefault(); }, true);
document.addEventListener('contextmenu', (event) => {
  const isSeedPicker = !seedPickerModal?.hidden;
  if (isSeedPicker && typeof cancelSeedPicker === 'function') { event.preventDefault(); event.stopPropagation(); void cancelSeedPicker(); return; }
  if (isEditableTarget(event.target) || !returnToPreviousPanel()) return;
  event.preventDefault();
  event.stopPropagation();
}, true);

window.sunflowerPanelNavigation = Object.freeze({ activateToolTab });

const bottomNavigation = document.querySelector('.bottom-map-activity-tabs');
