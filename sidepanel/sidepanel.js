/* Side-panel composition root: DOM references and shared runtime state. */

const status = document.querySelector('#connection-status');
const disconnectedContent = document.querySelector('#disconnected-content');
const connectedContent = document.querySelector('#connected-content');
const landInfo = document.querySelector('#land-info');
const scanMapButton = document.querySelector('#scan-map');
const cropResults = document.querySelector('#crop-results');
const treeResults = document.querySelector('#tree-results');
const miningResults = document.querySelector('#mining-results');
const cropGrowingResults = document.querySelector('#crop-growing-results');
const treeGrowingResults = document.querySelector('#tree-growing-results');
const miningGrowingResults = document.querySelector('#mining-growing-results');
const blockedResults = document.querySelector('#blocked-results');
const panelLog = document.querySelector('#panel-log');
const connectButton = document.querySelector('#connect-button');
const scanFertilisersButton = document.querySelector('#scan-fertilisers');
const cheerResults = document.querySelector('#cheer-results');
const seedPickerResults = document.querySelector('#seed-picker-results');
const seedPickerModal = document.querySelector('#seed-picker-modal');
const seedPickerTitle = document.querySelector('#seed-picker-title');
const overviewResults = document.querySelector('#overview-results');
const reloadExtensionButton = document.querySelector('#reload-extension');
const codeRelease = document.querySelector('#code-release');
const readyNotificationsToggle = document.querySelector('#ready-notifications');
const mapHoverHighlightsToggle = document.querySelector('#map-hover-highlights');
const notificationStatus = document.querySelector('#notification-status');
const toolTabs = Array.from(document.querySelectorAll('[data-tool-tab]'));
const toolTabPanels = Array.from(document.querySelectorAll('[data-tool-panel]'));
const mapActivityTabs = Array.from(document.querySelectorAll('[data-map-activity-tab]'));
const mapActivityContent = document.querySelector('#map-activity-content');
const seasonIcons = {
  spring: 'data:image/webp;base64,UklGRmwAAABXRUJQVlA4TF8AAAAvCkADECegoG0bNlQ+fwQmECBDMgygoG0bph/Z+EOa5j8A8Hs8O1+BISTJrmYNLhC8fwQvCCR/rM8Q0f8Acxe23xR7zcRenWSvbyW7zhK73hS91hRWM4HmApoALP5wAAA=',
  summer: 'data:image/webp;base64,UklGRpIAAABXRUJQVlA4TIYAAAAvDoADEDegoG0bpvx5lNj+5aMgbQMmgubf3VHUtg1UICVX9heCaZ/5D4CcuhG2Pf/HENhGkuRkrPNf+oRAXRGA9v8ffE3+OagYIvpPIGmzF7g1gJXXiPJ039V2C8R2Gc1TMckJTMGYUViTM6ZsxKymLlbWpKplg6lRHQXirMX//P46flwfJw==',
  autumn: 'data:image/webp;base64,UklGRpgAAABXRUJQVlA4TIsAAAAvDIADED+gqI0UaHfx7wv+WDgF4EUhI0nM+QOdwjeQZ+hR2kgS8pqhq++/DPLv5j8AEF8LzeukiCe6eJYJbCPbVnKyG+MNfIk/mls/zut/oIiI/k8AIL778dMUAlN0MjVHdJYpll1fOE1z28+t9sn53mhSN3SZYtkOudM+O7+eMC1bJ9jtMYD95ccAAA==',
  winter: 'data:image/webp;base64,UklGRoAAAABXRUJQVlA4THQAAAAvDoADECdApG0z/wLGJ/L4NgiybUYztEkd9mraNmDCs/zfIljzH4D/tyhTAatIsuLMxzMAKCCJgXcI4PKvKg8NEf1X2LYNMmZ4Axj88ROAceo6QFhzE/i0WheI5s2FYVbNFl9R1dIliRS+tOW70x/Xv2AAAA=='
};
const fertiliserIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAANCAMAAACn6Q83AAAABGdBTUEAALGOfPtRkwAAACFQTFRFAAAAwMvcWmmIGBQl////JlxCY8dNJitEeMVop/+Ukv96pgoFnAAAAAt0Uk5TAP////////////99dn3VAAAAOElEQVQImVXMMQ4AMAgCQBck8f8PLqIdZLoEQoRCxoaZ/Koat8Yjm7URgQZwqFPXvGc9cX2ptZcPwv4Cs0IVRlAAAAAASUVORK5CYII=';
const cropFertiliserIcons = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAICAYAAADA+m62AAAAAXNSR0IArs4c6QAAAKtJREFUGJVtkLEKglAYhb8b2dLWEkJLlxLa0iVcbGzsYXwOHyoXadExqNAluGjQpgQOtngvCZ7x45z/5xxBrzDwO0YUxYkAENq029oUhwW2NwdApTXr64fbQxHFiZiGgd+dT3sAvt4MgKzNcT2J87Zw5BKgm+gX97wE4PJ64lpywACMsU9yXG3I2nzAjLGpFE2lUGkNgGtJVFobPrhYlLUpoQOaDVqPTfM/0Q81AUYm90CvAwAAAABJRU5ErkJggg==',
  'data:image/webp;base64,UklGRroAAABXRUJQVlA4TK0AAAAvD8ADEE+gkJEk5lQO4BWa1VM9x5M0IzWNpEBn4SowQI00hKLoj9pIUht8B2S2CPqviFGubP4DAPW76xkfokZNJc/nFxEozuCotra4+TvuayEKOoACDgqge1YZDLQWwABJ/LYe3hfR/wkweAmA+5uTAUmeH14Y3EPM7mQkn2PCCPml6Ix7wHGy0vfg9uXatyU4tWXa9lG0T9n2m2jXstUBtWupGpCuvVXQtnz/AgA='
];
const fruitFertiliserIcons = [
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAICAYAAADA+m62AAAAAXNSR0IArs4c6QAAALVJREFUGJVt0LFqwmAUhuEnwaHgItIQMqUVW+jWKeDi2rEX43V4Uy5CbkBopa1T+GsJLjab6RKLAb/x5T2cc75Il8V81rqS5WodQXSWnh4yt19HRToGZaj93A1t3ivL1ToaLOaz9vXlGUybAzjt9oo8sZ2MPE5SaOPzirePAA7bSpwnPQb/YjdpNM2cdvsegwH8flfdXY0iHYvzRBlqN0nTF+EzHGViZahdsvt0qPf1tWouK/oDwkw9oii9HTMAAAAASUVORK5CYII=',
  'data:image/webp;base64,UklGRpAAAABXRUJQVlA4TIMAAAAvD0ACEEegJgDQhDTUICXF9JX5GqmNZIN6/Rf2QagCISWIiDYgfOlezSsmidr8BwAYSSfytmZyK1i/DpvAKLbtJm/19y8OQnOAgTQD/OzpOAAL33cGDxH9nwBgNRMA60TugrUMdOGUkgfPoOeTB7qg75oHMqiseTZbVNbaVCna5PP7BQA='
];
let countdownTimer;
let treeRefreshTimer;
let fruitRefreshTimer;
let fruitUnknownTimeRefreshTimer;
let miningRefreshTimer;
let treeUnknownTimeRefreshTimer;
let petSleepTimer;
let petSleepCheckInProgress = false;
let scanMapQueue = Promise.resolve();
let mapScanWaitingTimer;
let mapIntegrityRetryTimer;
let cachePruneTimer;
let suspiciousMapScanStreak = 0;
let lastScanData;
let selectedPlantSeed;
let lastCheerScan;
let selectedFruitSeed;
let seedPickerKind = '';
let seedPickerMode = 'single';
let seedPickerScan = null;
let toolBagScanned = false;
let currentCoins = null;
function setCurrentCoins(value) {
  currentCoins = Math.max(0, Number(value) || 0);
  return currentCoins;
}
function isFruitSeed(seed) {
  return Boolean(seed?.isFruitSeed || /^(apple|banana|blueberry|lemon|orange|grape)$/i.test(String(seed?.name || '').replace(/\s+(?:seed|plant)$/i, '').trim()));
}
let readyNotificationsEnabled = false;
const sentReadyNotifications = new Set();
const FERTILISER_INVENTORY_STORAGE_KEY = 'fertiliserInventory';
const FERTILISER_INVENTORY_CACHE_VERSION = 1;
let fertiliserInventoryPersistenceEnabled = false;
let fertiliserInventoryPersistScheduled = false;

function persistFertiliserInventory() {
  const items = Array.from(fertiliserCounts, ([icon, count]) => ({
    icon: String(icon || ''),
    count: Math.max(0, Number(count) || 0)
  })).filter((item) => item.icon);
  return chrome.storage.local.set({
    [FERTILISER_INVENTORY_STORAGE_KEY]: {
      version: FERTILISER_INVENTORY_CACHE_VERSION,
      updatedAt: Date.now(),
      items
    }
  });
}

function scheduleFertiliserInventoryPersist() {
  if (!fertiliserInventoryPersistenceEnabled || fertiliserInventoryPersistScheduled) return;
  fertiliserInventoryPersistScheduled = true;
  queueMicrotask(() => {
    fertiliserInventoryPersistScheduled = false;
    void persistFertiliserInventory().catch(() => {});
  });
}

class PersistedFertiliserCounts extends Map {
  set(icon, count) {
    const result = super.set(icon, count);
    scheduleFertiliserInventoryPersist();
    return result;
  }

  clear() {
    super.clear();
    scheduleFertiliserInventoryPersist();
  }
}

const fertiliserCounts = new PersistedFertiliserCounts();

function restorePersistedFertiliserInventory(saved) {
  if (saved?.version !== FERTILISER_INVENTORY_CACHE_VERSION || !Array.isArray(saved.items) || !saved.items.length) return false;
  saved.items.forEach((item) => {
    const icon = String(item?.icon || '');
    if (icon) fertiliserCounts.set(icon, Math.max(0, Number(item.count) || 0));
  });
  fertilisersScanned = fertiliserCounts.size > 0;
  return fertilisersScanned;
}
let fertilisersScanned = false;
const TOOL_INVENTORY_STORAGE_KEY = 'resourceToolInventory';
const TOOL_INVENTORY_CACHE_VERSION = 1;
let toolInventoryPersistenceEnabled = false;
let toolInventoryPersistScheduled = false;

function persistToolInventory() {
  const items = Array.from(toolCounts, ([icon, count]) => ({
    icon: String(icon || ''),
    count: Math.max(0, Number(count) || 0)
  })).filter((item) => item.icon);
  return chrome.storage.local.set({
    [TOOL_INVENTORY_STORAGE_KEY]: {
      version: TOOL_INVENTORY_CACHE_VERSION,
      updatedAt: Date.now(),
      items
    }
  });
}

function scheduleToolInventoryPersist() {
  if (!toolInventoryPersistenceEnabled || toolInventoryPersistScheduled) return;
  toolInventoryPersistScheduled = true;
  queueMicrotask(() => {
    toolInventoryPersistScheduled = false;
    void persistToolInventory().catch(() => {});
  });
}

class PersistedToolCounts extends Map {
  set(icon, count) {
    const result = super.set(icon, count);
    scheduleToolInventoryPersist();
    return result;
  }

  clear() {
    super.clear();
    scheduleToolInventoryPersist();
  }
}

const toolCounts = new PersistedToolCounts();

function restorePersistedToolInventory(saved) {
  if (saved?.version !== TOOL_INVENTORY_CACHE_VERSION || !Array.isArray(saved.items) || !saved.items.length) return false;
  saved.items.forEach((item) => {
    const icon = String(item?.icon || '');
    if (icon) toolCounts.set(icon, Math.max(0, Number(item.count) || 0));
  });
  toolBagScanned = toolCounts.size > 0;
  return toolBagScanned;
}
const professionAutoEnabled = new Set();
const PROFESSION_AUTO_STORAGE_KEY = 'professionAutoEnabled';
const PLANTING_SEED_ORDER_STORAGE_KEY = 'plantingSeedOrder';
const SEED_BAR_CACHE_KEY = 'seedBarCache';
const SEASONAL_SEED_CACHE_STORAGE_KEY = 'seasonalSeedCache';
const SEASONAL_SEED_CACHE_VERSION = 1;
const plantingSeedOrder = { crop: [], fruit: [] };
const seedSeasonLists = Object.create(null);
const seedInventory = Object.create(null);
let activeSeedSeason = '';
let pendingSeedStorageState = null;
// The active season's seed list, merged with the latest shared inventory counts.
const seedBarCache = new Map();
chrome.storage.local.get({
  [PROFESSION_AUTO_STORAGE_KEY]: [],
  [PLANTING_SEED_ORDER_STORAGE_KEY]: {},
  [SEED_BAR_CACHE_KEY]: {},
  [SEASONAL_SEED_CACHE_STORAGE_KEY]: null,
  [FERTILISER_INVENTORY_STORAGE_KEY]: null,
  [TOOL_INVENTORY_STORAGE_KEY]: null
}).then((stored) => {
  const scopes = Array.isArray(stored[PROFESSION_AUTO_STORAGE_KEY]) ? stored[PROFESSION_AUTO_STORAGE_KEY] : [];
  scopes.forEach((scope) => professionAutoEnabled.add(String(scope)));
  restorePersistedFertiliserInventory(stored[FERTILISER_INVENTORY_STORAGE_KEY]);
  fertiliserInventoryPersistenceEnabled = true;
  restorePersistedToolInventory(stored[TOOL_INVENTORY_STORAGE_KEY]);
  toolInventoryPersistenceEnabled = true;
  pendingSeedStorageState = stored;
  window.setTimeout(() => {
    if (typeof restorePersistedSeedState === 'function') restorePersistedSeedState(pendingSeedStorageState);
    if (typeof getActiveSeed === 'function') {
      const cropActive = getActiveSeed('crop');
      const fruitActive = getActiveSeed('fruit');
      selectedPlantSeed = cropActive ? { ...cropActive } : undefined;
      selectedFruitSeed = fruitActive ? { ...fruitActive } : undefined;
    }
    if (lastScanData && typeof renderOverview === 'function') renderOverview();
    if (professionAutoEnabled.has('crop') && typeof startAutoCrop === 'function') startAutoCrop();
  }, 0);
}).catch(() => {
  fertiliserInventoryPersistenceEnabled = true;
  toolInventoryPersistenceEnabled = true;
});
const composterDetails = new Map();
const countdownTargets = new Map();
const cropTiers = new Map();
const axeIcon = 'https://sunflower-land.com/game-assets/tools/axe.png';
const pickaxeTools = {
  stone: { name: 'Pickaxe', fallback: 'https://sunflower-land.com/game-assets/tools/wood_pickaxe.png', pattern: /\/tools\/(?:wood_)?pickaxe\.png(?:[?#]|$)/i },
  iron: { name: 'Stone Pickaxe', fallback: 'https://sunflower-land.com/game-assets/tools/stone_pickaxe.png', pattern: /\/tools\/stone_pickaxe\.png(?:[?#]|$)/i },
  gold: { name: 'Iron Pickaxe', fallback: 'https://sunflower-land.com/game-assets/tools/iron_pickaxe.png', pattern: /\/tools\/iron_pickaxe\.png(?:[?#]|$)/i }
};
const saltRakeFallback = 'https://sunflower-land.com/game-assets/tools/salt_rake.webp';
// Update this timestamp whenever the extension code is released.
const CODE_RELEASED_AT = '17/09/2026 · 17:35';
const beeIcon = 'data:image/webp;base64,UklGRl4AAABXRUJQVlA4TFIAAAAvCcABEC9AEECSRGhzDTfQGmQBJtOYP00iOXRFJmCxNEshuU8y8x+A/1VrdJMUELSNYkXkHODg7ggG4BU8Ef0PEgapbFrZs852/cPsP9DvEGEH';

codeRelease.textContent = CODE_RELEASED_AT;

window.addEventListener('error', (event) => {
  const source = event.filename ? ` (${event.filename.split('/').pop()}:${event.lineno || 0})` : '';
  logActionError(`Lỗi panel: ${event.message || 'Không xác định'}${source}`);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Không xác định');
  logActionError(`Promise bị từ chối: ${reason}`);
});
