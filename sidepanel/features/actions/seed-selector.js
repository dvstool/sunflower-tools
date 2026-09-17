/* Temporary seed picker. Betty remains open so the player can inspect a seed directly. */

function seedPickerCount(item) {
  return Math.max(0, Number(item?.count) || 0);
}

function seedPickerKey(name) {
  return String(name || '').replace(/\s+seed$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

let pendingLegacySeedState = null;

function normaliseSeedSeason(value) {
  const season = String(value || '').trim().toLowerCase();
  if (season === 'fall') return 'autumn';
  return ['spring', 'summer', 'autumn', 'winter'].includes(season) ? season : '';
}

function seedCacheEntry(record) {
  const key = seedPickerKey(record?.key || record?.name);
  if (!key) return null;
  return {
    key,
    icon: record?.icon || '',
    count: Math.max(0, Number(seedInventory[key]?.count) || 0),
    name: record?.name || '',
    kind: record?.kind || 'unknown',
    slotIndex: Number.isInteger(record?.slotIndex) ? record.slotIndex : -1
  };
}

function rememberActiveSeasonOrder() {
  const seasonState = seedSeasonLists[activeSeedSeason];
  if (!seasonState) return;
  seasonState.plantingOrder = {
    crop: [...plantingSeedOrder.crop],
    fruit: [...plantingSeedOrder.fruit]
  };
}

function activateSeedSeason(season) {
  const nextSeason = normaliseSeedSeason(season);
  if (!nextSeason || nextSeason === activeSeedSeason) return false;
  rememberActiveSeasonOrder();
  activeSeedSeason = nextSeason;
  const seasonState = seedSeasonLists[nextSeason];
  plantingSeedOrder.crop.splice(0, plantingSeedOrder.crop.length, ...((seasonState?.plantingOrder?.crop || []).map(String).filter(Boolean)));
  plantingSeedOrder.fruit.splice(0, plantingSeedOrder.fruit.length, ...((seasonState?.plantingOrder?.fruit || []).map(String).filter(Boolean)));
  seedBarCache.clear();
  (seasonState?.entries || []).forEach((record) => {
    const entry = seedCacheEntry(record);
    if (entry) seedBarCache.set(entry.key, entry);
  });
  return true;
}

function ensureActiveSeedSeason() {
  const detectedSeason = normaliseSeedSeason(getCurrentSeason());
  if (detectedSeason && detectedSeason !== activeSeedSeason) {
    if (pendingLegacySeedState && !seedSeasonLists[detectedSeason]) {
      seedSeasonLists[detectedSeason] = pendingLegacySeedState;
      pendingLegacySeedState = null;
    }
    activateSeedSeason(detectedSeason);
    persistSeasonalSeedCache();
  }
  return detectedSeason || activeSeedSeason;
}

function persistSeasonalSeedCache() {
  rememberActiveSeasonOrder();
  const seasons = {};
  Object.entries(seedSeasonLists).forEach(([season, state]) => {
    seasons[season] = {
      entries: Array.isArray(state?.entries) ? state.entries : [],
      plantingOrder: {
        crop: Array.isArray(state?.plantingOrder?.crop) ? state.plantingOrder.crop : [],
        fruit: Array.isArray(state?.plantingOrder?.fruit) ? state.plantingOrder.fruit : []
      },
      scannedAt: Number(state?.scannedAt) || 0
    };
  });
  chrome.storage.local.set({
    [SEASONAL_SEED_CACHE_STORAGE_KEY]: {
      version: SEASONAL_SEED_CACHE_VERSION,
      lastSeason: activeSeedSeason,
      seasons,
      inventory: { ...seedInventory }
    }
  }).catch(() => {});
}

function restorePersistedSeedState(stored = {}) {
  const saved = stored?.[SEASONAL_SEED_CACHE_STORAGE_KEY];
  const hasSeasonalCache = saved?.version === SEASONAL_SEED_CACHE_VERSION && saved.seasons && typeof saved.seasons === 'object';
  Object.keys(seedSeasonLists).forEach((key) => delete seedSeasonLists[key]);
  Object.keys(seedInventory).forEach((key) => delete seedInventory[key]);
  activeSeedSeason = '';
  pendingLegacySeedState = null;
  seedBarCache.clear();

  if (hasSeasonalCache) {
    Object.entries(saved.inventory || {}).forEach(([key, value]) => {
      if (!key || !value || typeof value !== 'object') return;
      seedInventory[key] = {
        count: Math.max(0, Number(value.count) || 0),
        updatedAt: Number(value.updatedAt) || 0
      };
    });
    Object.entries(saved.seasons).forEach(([season, state]) => {
      const validSeason = normaliseSeedSeason(season);
      if (!validSeason || !state || typeof state !== 'object') return;
      seedSeasonLists[validSeason] = {
        entries: Array.isArray(state.entries) ? state.entries : [],
        plantingOrder: {
          crop: Array.isArray(state.plantingOrder?.crop) ? state.plantingOrder.crop.map(String).filter(Boolean) : [],
          fruit: Array.isArray(state.plantingOrder?.fruit) ? state.plantingOrder.fruit.map(String).filter(Boolean) : []
        },
        scannedAt: Number(state.scannedAt) || 0
      };
    });
    activateSeedSeason(normaliseSeedSeason(getCurrentSeason()) || normaliseSeedSeason(saved.lastSeason));
    return;
  }

  const legacyOrder = stored?.[PLANTING_SEED_ORDER_STORAGE_KEY] || {};
  plantingSeedOrder.crop.splice(0, plantingSeedOrder.crop.length, ...((legacyOrder.crop || []).map(String).filter(Boolean)));
  plantingSeedOrder.fruit.splice(0, plantingSeedOrder.fruit.length, ...((legacyOrder.fruit || []).map(String).filter(Boolean)));
  Object.entries(stored?.[SEED_BAR_CACHE_KEY] || {}).forEach(([key, value]) => {
    if (!key || !value || typeof value !== 'object') return;
    const entry = { ...value, key };
    seedBarCache.set(key, entry);
    seedInventory[key] = { count: Math.max(0, Number(entry.count) || 0), updatedAt: 0 };
  });
  pendingLegacySeedState = {
    entries: Array.from(seedBarCache.values()).map(({ count, ...entry }) => entry),
    plantingOrder: {
      crop: [...plantingSeedOrder.crop],
      fruit: [...plantingSeedOrder.fruit]
    },
    scannedAt: 0
  };
  const detectedSeason = normaliseSeedSeason(getCurrentSeason());
  if (detectedSeason) {
    seedSeasonLists[detectedSeason] = pendingLegacySeedState;
    pendingLegacySeedState = null;
    activateSeedSeason(detectedSeason);
    persistSeasonalSeedCache();
  }
}

function plantingOrderFor(kind) {
  if (kind !== 'crop' && kind !== 'fruit') return [];
  ensureActiveSeedSeason();
  return plantingSeedOrder[kind] || [];
}

function togglePlantingSeedOrder(kind, seed) {
  if (!window.licenseManager?.hasTier?.('silver')) return;
  const key = seedPickerKey(seed?.name);
  if (!key || (kind !== 'crop' && kind !== 'fruit')) return;
  const order = plantingOrderFor(kind);
  const index = order.indexOf(key);
  if (index >= 0) order.splice(index, 1);
  else order.push(key);
  persistSeasonalSeedCache();
}

function syncSeedPickerCount(name, count) {
  const key = seedPickerKey(name);
  if (!key) return;
  const value = Math.max(0, Number(count) || 0);
  seedInventory[key] = { count: value, updatedAt: Date.now() };
  const cached = seedPickerScan?.find((item) => seedPickerKey(item.name) === key);
  if (cached) cached.count = value;
  const barEntry = seedBarCache.get(key);
  if (barEntry) barEntry.count = value;
  persistSeasonalSeedCache();
}

function updateSeedBarCache(seeds) {
  if (!Array.isArray(seeds)) return false;
  const before = JSON.stringify(Array.from(seedBarCache.values()));
  const season = normaliseSeedSeason(getCurrentSeason()) || activeSeedSeason;
  if (season && season !== activeSeedSeason) activateSeedSeason(season);
  const scannedAt = Date.now();
  const entries = [];
  let storageChanged = false;
  seeds.forEach((seed) => {
    const key = seedPickerKey(seed.name);
    if (!key) return;
    const count = Math.max(0, Number(seed.count) || 0);
    if (!seedInventory[key] || seedInventory[key].count !== count) {
      seedInventory[key] = { count, updatedAt: scannedAt };
      storageChanged = true;
    }
    entries.push({
      key,
      icon: seed.icon || '',
      name: seed.name || '',
      kind: seed.kind || 'unknown',
      slotIndex: Number.isInteger(seed.slotIndex) ? seed.slotIndex : -1
    });
  });
  if (season) {
    const previousState = seedSeasonLists[season];
    const previousOrder = previousState?.plantingOrder || {
      crop: [...plantingSeedOrder.crop],
      fruit: [...plantingSeedOrder.fruit]
    };
    if (JSON.stringify(previousState?.entries || []) !== JSON.stringify(entries)) storageChanged = true;
    seedSeasonLists[season] = { entries, plantingOrder: previousOrder, scannedAt: storageChanged ? scannedAt : (previousState?.scannedAt || scannedAt) };
  }
  seedBarCache.clear();
  entries.forEach((record) => {
    const entry = seedCacheEntry(record);
    if (entry) seedBarCache.set(entry.key, entry);
  });
  const changed = before !== JSON.stringify(Array.from(seedBarCache.values()));
  if (storageChanged) persistSeasonalSeedCache();
  return changed;
}

function getActiveSeed(kind) {
  ensureActiveSeedSeason();
  const order = plantingOrderFor(kind);
  for (const key of order) {
    const entry = seedBarCache.get(key);
    if (entry && entry.count > 0) return entry;
  }
  return null;
}

function moveSeedInOrder(kind, fromIndex, toIndex) {
  const order = plantingOrderFor(kind);
  if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) return;
  const [item] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, item);
  persistSeasonalSeedCache();
}

function removeSeedFromOrder(kind, key) {
  const order = plantingOrderFor(kind);
  const index = order.indexOf(key);
  if (index >= 0) order.splice(index, 1);
  persistSeasonalSeedCache();
}

async function openBettySeedList() {
  await window.licenseManager.requireTier('silver');
  await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      if (document.querySelector('#SeasonSeeds')) return true;
      const marketPattern = /\/game-assets\/(?:[^/]+\/)*buildings\/(?:[^/]+\/)*(?:bettys_)?market\.(?:webp|png)(?:[?#]|$)/i;
      const image = Array.from(document.querySelectorAll('img')).find((item) => marketPattern.test(item.currentSrc || item.src || ''));
      const target = image?.closest('.cursor-pointer') || image?.parentElement;
      if (!target) return false;
      target.click();
      let buyClicked = false;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        if (document.querySelector('#SeasonSeeds')) return true;
        const buy = Array.from(document.querySelectorAll('button, div.cursor-pointer')).find((item) => item.textContent.trim() === 'Buy');
        if (buy && !buyClicked) {
          buy.click();
          buyClicked = true;
        }
        await sleep(8);
      }
      return false;
    }
  });
}


function seedPickerCatalogItem(icon) {
  return typeof findSeedCatalogEntryFromBettyIcon === 'function' ? findSeedCatalogEntryFromBettyIcon(icon) : null;
}

function getCurrentSeason() {
  const span = document.querySelector('#land-info .land-details span');
  const text = (span?.textContent || '').trim().toLowerCase();
  if (/winter/i.test(text)) return 'winter';
  if (/summer/i.test(text)) return 'summer';
  if (/autumn|fall/i.test(text)) return 'autumn';
  if (/spring/i.test(text)) return 'spring';
  return '';
}

function normaliseBettySeedIcon(icon) {
  const catalogItem = seedPickerCatalogItem(icon);
  return catalogItem?.seedIcon || String(icon || '').replace(/(\/game-assets\/crops\/[^/]+\/)crop\.png([?#].*)?$/i, '$1seed.png$2');
}

function seedNameFromIcon(icon) {
  const catalogItem = seedPickerCatalogItem(icon);
  if (catalogItem?.name) return catalogItem.name;
  const source = String(icon || '');
  const crop = source.match(/\/crops\/([^/]+)\/(?:crop|seed)\.png/i)?.[1];
  const fruit = source.match(/\/fruit\/([^/]+?)(?:_seed|\/seed)\.png/i)?.[1];
  const filename = source.match(/\/([^/?#]+?)(?:_seed|seed)?\.(?:png|webp)(?:[?#]|$)/i)?.[1];
  const slug = crop || fruit || filename || 'seed';
  return slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) + ' Seed';
}

function resolveBettySeedCatalogItem(sources) {
  const icons = Array.isArray(sources) ? sources.filter(Boolean) : [];
  const directMatch = icons.map((icon) => seedPickerCatalogItem(icon)).find(Boolean);
  if (directMatch) return directMatch;
  if (typeof findSeedCatalogEntryByName !== 'function') return null;
  return icons.map((icon) => findSeedCatalogEntryByName(seedNameFromIcon(icon))).find(Boolean) || null;
}

function inferBettySeedKind(sources, catalogItem = null) {
  const icons = Array.isArray(sources) ? sources.filter(Boolean) : [];
  if (icons.some((icon) => typeof isGreenhouseSeedIcon === 'function' && isGreenhouseSeedIcon(icon))) return 'greenhouse';
  if (catalogItem?.type) return catalogItem.type;
  if (icons.some((icon) => /\/game-assets\/crops\/[^/]+\/(?:crop|seed)\.(?:png|webp)(?:[?#]|$)/i.test(String(icon)))) return 'crop';
  if (icons.some((icon) => /\/game-assets\/(?:fruit|fruits)\//i.test(String(icon)))) return 'fruit';
  return 'unknown';
}

function describeUnknownSeedSource(seed) {
  const source = String(seed?.sourceIcon || '');
  if (!source) return seed?.name || 'unknown icon';
  if (/^data:/i.test(source)) return `${seed?.name || 'Unknown seed'} (embedded image)`;
  return `${seed?.name || 'Unknown seed'} (${source.replace(/[?#].*$/, '')})`;
}

function renderSeedPicker() {
  if (!seedPickerResults) return;
  if (!seedPickerScan) {
    seedPickerResults.innerHTML = '<div class="empty-state">Opening Betty and reading seeds...</div>';
    return;
  }
  const order = seedPickerMode === 'planting-order' ? plantingOrderFor(seedPickerKind) : [];
  // Betty determines availability and order; catalog metadata only identifies each seed.
  const seeds = seedPickerScan
    .map((item) => ({ ...item, key: seedPickerKey(item.name) }))
    .filter((item) => item.key && item.kind === seedPickerKind);
  seeds.sort((a, b) => (Number.isInteger(a.slotIndex) ? a.slotIndex : Number.MAX_SAFE_INTEGER) - (Number.isInteger(b.slotIndex) ? b.slotIndex : Number.MAX_SAFE_INTEGER));
  if (!seeds.length) {
    seedPickerResults.innerHTML = `<div class="empty-state">No ${seedPickerKind === 'fruit' ? 'Fruit' : 'Crop'} seeds for this season.</div>`;
    return;
  }
  seedPickerResults.innerHTML = seeds.map((item) => {
    const orderIndex = order.indexOf(item.key);
    const selected = orderIndex >= 0;
    const overlay = seedPickerMode === 'planting-order' && selected ? String(orderIndex + 1) : '';
    const countDisplay = item.count < 0 ? '?' : formatExactCount(item.count);
    return `<button class="seed-picker-card${selected ? ' is-ordered' : ''}" type="button" data-seed-picker-choice="true" data-seed-name="${escapeHtml(item.name)}" data-seed-slot-index="${item.slotIndex}" title="${selected ? `#${orderIndex + 1}` : item.name}"><img class="seed-picker-icon" src="${escapeHtml(item.icon)}" alt="" /><b>&times;${countDisplay}</b><span class="seed-picker-overlay">${overlay}</span></button>`;
  }).join('');
}

let seedHoverTimer;
let seedHoverQueue = Promise.resolve();
let pendingSeedHoverSlot = null;

async function openBettySeedSlot(slotIndex) {
  if (!Number.isInteger(slotIndex)) return;
  await executeOnSunflowerTabs({
    func: (index) => {
      const seasonSeeds = document.querySelector('#SeasonSeeds');
      const slots = Array.from(seasonSeeds?.querySelectorAll('img[alt="item"]') || [])
        .map((image) => image.closest('.bg-brown-600, .bg-brown-700') || image.closest('.cursor-pointer') || image.parentElement)
        .filter((slot, slotIndex, items) => slot && items.indexOf(slot) === slotIndex);
      const slot = slots[index];
      if (!slot) return false;
      (slot.closest('.cursor-pointer') || slot).click();
      return true;
    },
    args: [slotIndex]
  });
}

async function closeBettySeedPicker() {
  try {
    await executeOnSunflowerTabs({
      func: () => {
        const dialog = Array.from(document.querySelectorAll('div.relative.max-h-\\[90vh\\]')).find((item) => item.querySelector('#SeasonSeeds'));
        dialog?.querySelector('img[src*="/game-assets/icons/close.png"]')?.click();
      }
    });
  } catch { /* Closing the game dialog is best effort only. */ }
}

async function readBettySeeds() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const marketPattern = /\/game-assets\/(?:[^/]+\/)*buildings\/(?:[^/]+\/)*(?:bettys_)?market\.(?:webp|png)(?:[?#]|$)/i;
      const marketImage = Array.from(document.querySelectorAll('img')).find((image) => marketPattern.test(image.currentSrc || image.src || ''));
      const target = marketImage?.closest('.cursor-pointer') || marketImage?.parentElement;
      if (!target) return { error: 'Không tìm thấy Betty trên map.' };
      let seasonSeeds = document.querySelector('#SeasonSeeds');
      if (!seasonSeeds) target.click();
      let buyClicked = Boolean(seasonSeeds);
      for (let attempt = 0; !seasonSeeds && attempt < 120; attempt += 1) {
        const buy = Array.from(document.querySelectorAll('button, div.cursor-pointer')).find((element) => element.textContent.trim() === 'Buy');
        if (buy && !buyClicked) { buy.click(); buyClicked = true; }
        await sleep(8);
        seasonSeeds = document.querySelector('#SeasonSeeds');
      }
      if (!seasonSeeds) return { error: 'Không mở được danh sách hạt của Betty.' };
      const countOf = (slot) => {
        const text = String(slot.parentElement?.innerText || slot.textContent || '').replace(/,/g, '').toLowerCase();
        const token = text.match(/\d+(?:\.\d+)?\s*k?/i)?.[0] || '0';
        const number = Number.parseFloat(token);
        return Number.isFinite(number) ? Math.round(number * (/k/i.test(token) ? 1000 : 1)) : 0;
      };
      const slots = Array.from(seasonSeeds.querySelectorAll('img[alt="item"]'))
        .map((image) => image.closest('.bg-brown-600, .bg-brown-700') || image.closest('.cursor-pointer') || image.parentElement)
        .filter((slot, index, items) => slot && seasonSeeds.contains(slot) && items.indexOf(slot) === index);
      return { items: slots.map((slot, slotIndex) => {
        const image = slot.querySelector('img[alt="item"]');
        return { slotIndex, rawIcon: image?.getAttribute('src') || '', resolvedIcon: image?.currentSrc || image?.src || '', count: countOf(slot) };
      }).filter((item) => item.rawIcon || item.resolvedIcon) };
    }
  });
  if (result?.error) throw new Error(result.error);
  return (result?.items || []).map((item) => {
    const sources = [item.rawIcon, item.resolvedIcon].filter(Boolean);
    const catalogItem = resolveBettySeedCatalogItem(sources);
    const source = item.resolvedIcon || item.rawIcon;
    return {
      slotIndex: item.slotIndex,
      icon: catalogItem?.seedIcon || normaliseBettySeedIcon(source),
      count: item.count,
      kind: inferBettySeedKind(sources, catalogItem),
      name: catalogItem?.name || seedNameFromIcon(source),
      seasons: catalogItem?.seasons || [],
      sourceIcon: source
    };
  });
}

async function readOpenBettySeeds() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: () => {
      const seasonSeeds = document.querySelector('#SeasonSeeds');
      if (!seasonSeeds) return { closed: true };
      const countOf = (slot) => {
        const text = String(slot.parentElement?.innerText || slot.textContent || '').replace(/,/g, '').toLowerCase();
        const token = text.match(/\d+(?:\.\d+)?\s*k?/i)?.[0] || '0';
        const number = Number.parseFloat(token);
        return Number.isFinite(number) ? Math.round(number * (/k/i.test(token) ? 1000 : 1)) : 0;
      };
      const slots = Array.from(seasonSeeds.querySelectorAll('img[alt="item"]'))
        .map((image) => image.closest('.bg-brown-600, .bg-brown-700') || image.closest('.cursor-pointer') || image.parentElement)
        .filter((slot, index, items) => slot && seasonSeeds.contains(slot) && items.indexOf(slot) === index);
      return {
        items: slots
          .map((slot, slotIndex) => {
            const image = slot.querySelector('img[alt="item"]');
            return {
              slotIndex,
              rawIcon: image?.getAttribute('src') || '',
              resolvedIcon: image?.currentSrc || image?.src || '',
              count: countOf(slot)
            };
          })
          .filter((item) => item.rawIcon || item.resolvedIcon)
      };
    }
  });
  if (result?.closed) return null;
  return (result?.items || []).map((item) => {
    const sources = [item.rawIcon, item.resolvedIcon].filter(Boolean);
    const catalogItem = resolveBettySeedCatalogItem(sources);
    const source = item.resolvedIcon || item.rawIcon;
    return {
      slotIndex: item.slotIndex,
      icon: catalogItem?.seedIcon || normaliseBettySeedIcon(source),
      count: item.count,
      kind: inferBettySeedKind(sources, catalogItem),
      name: catalogItem?.name || seedNameFromIcon(source),
      seasons: catalogItem?.seasons || [],
      sourceIcon: source
    };
  });
}

let bettySeedPollTimer = 0;
let bettySeedPollGeneration = 0;

function applyBettySeedSnapshot(seeds, { forceRender = false } = {}) {
  if (!Array.isArray(seeds)) return false;
  seedPickerScan = seeds;
  const changed = updateSeedBarCache(seeds);
  if (forceRender && typeof log === 'function') {
    const cropCount = seeds.filter((seed) => seed.kind === 'crop').length;
    const fruitCount = seeds.filter((seed) => seed.kind === 'fruit').length;
    const unknownCount = seeds.filter((seed) => seed.kind === 'unknown').length;
    const otherCount = seeds.length - cropCount - fruitCount - unknownCount;
    log(`Betty scanned: ${seeds.length} slots, ${cropCount} Crop, ${fruitCount} Fruit, ${otherCount} other, ${unknownCount} unknown.`);
    if (unknownCount) {
      const unknownSeeds = seeds.filter((seed) => seed.kind === 'unknown').map(describeUnknownSeedSource);
      log(`Unmatched Betty seeds: ${unknownSeeds.join(', ')}.`);
    }
  }
  if (changed) {
    const cropActive = getActiveSeed('crop');
    const fruitActive = getActiveSeed('fruit');
    selectedPlantSeed = cropActive ? { ...cropActive } : undefined;
    selectedFruitSeed = fruitActive ? { ...fruitActive } : undefined;
  }
  if (changed || forceRender) {
    renderSeedPicker();
    if (typeof renderOverview === 'function') renderOverview();
  }
  return changed;
}

function stopBettySeedPolling() {
  bettySeedPollGeneration += 1;
  window.clearTimeout(bettySeedPollTimer);
  bettySeedPollTimer = 0;
}

function startBettySeedPolling() {
  stopBettySeedPolling();
  const generation = bettySeedPollGeneration;
  const poll = async () => {
    if (generation !== bettySeedPollGeneration || seedPickerModal?.hidden) return;
    try {
      const fresh = await readOpenBettySeeds();
      if (generation !== bettySeedPollGeneration || seedPickerModal?.hidden) return;
      if (!fresh) {
        stopBettySeedPolling();
        return;
      }
      applyBettySeedSnapshot(fresh);
    } catch {
      stopBettySeedPolling();
      return;
    }
    if (generation === bettySeedPollGeneration && !seedPickerModal?.hidden) {
      bettySeedPollTimer = window.setTimeout(poll, 500);
    }
  };
  bettySeedPollTimer = window.setTimeout(poll, 500);
}

async function openSeedPicker(kind, mode = 'single') {
  await window.licenseManager.requireTier('silver');
  if (!seedPickerModal) return;
  stopBettySeedPolling();
  seedPickerModal.hidden = false;
  seedPickerKind = kind;
  seedPickerMode = mode;
  if (seedPickerTitle) {
    const season = getCurrentSeason();
    const seasonLabel = season ? ` (${season.charAt(0).toUpperCase() + season.slice(1)})` : '';
    const titleText = mode === 'planting-order'
      ? `Planting Order — ${kind === 'fruit' ? 'Fruit' : 'Crop'}${seasonLabel}`
      : `Choose ${kind === 'fruit' ? 'Fruit' : 'Crop'} Seed${seasonLabel}`;
    seedPickerTitle.textContent = titleText;
  }
  seedPickerScan = null;
  renderSeedPicker();
  const finishLog = startActionLog('Opening Betty and reading seasonal seeds...');
  try {
    const fresh = await readBettySeeds();
    applyBettySeedSnapshot(fresh, { forceRender: true });
    if (!seedPickerModal.hidden) startBettySeedPolling();
  } catch (error) {
    logActionError(error?.message || 'Failed to read Betty.');
  } finally {
    finishLog();
  }
}

async function cancelSeedPicker() {
  stopBettySeedPolling();
  if (seedPickerModal) seedPickerModal.hidden = true;
  seedPickerMode = 'single';
  pendingSeedHoverSlot = null;
  window.clearTimeout(seedHoverTimer);
  // Sync active seed from planting order
  const cropActive = getActiveSeed('crop');
  selectedPlantSeed = cropActive ? { ...cropActive, count: cropActive.count } : undefined;
  const fruitActive = getActiveSeed('fruit');
  selectedFruitSeed = fruitActive ? { ...fruitActive, count: fruitActive.count } : undefined;
  if (typeof renderOverview === 'function') renderOverview();
  await closeBettySeedPicker();
}


seedPickerModal?.addEventListener('pointerover', (event) => {
  const card = event.target.closest('[data-seed-picker-choice]');
  if (!card || card.contains(event.relatedTarget)) return;
  const slotIndex = Number(card.dataset.seedSlotIndex);
  if (!Number.isInteger(slotIndex) || pendingSeedHoverSlot === slotIndex) return;
  pendingSeedHoverSlot = slotIndex;
  window.clearTimeout(seedHoverTimer);
  seedHoverTimer = window.setTimeout(() => {
    const requestedSlot = pendingSeedHoverSlot;
    seedHoverQueue = seedHoverQueue.catch(() => {}).then(async () => {
      if (requestedSlot !== pendingSeedHoverSlot) return;
      await openBettySeedSlot(requestedSlot);
    });
  }, 75);
});

seedPickerModal?.addEventListener('pointerout', (event) => {
  const card = event.target.closest('[data-seed-picker-choice]');
  if (!card || card.contains(event.relatedTarget)) return;
  pendingSeedHoverSlot = null;
  window.clearTimeout(seedHoverTimer);
});

const seedPickerRefreshButton = seedPickerModal?.querySelector('[data-ui-action="refresh-seed-counts"]');
if (seedPickerRefreshButton) {
  seedPickerRefreshButton.innerHTML = '<span class="reload-action-icon reload-action-static"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg></span><span class="reload-action-icon reload-action-loading" aria-hidden="true"><span class="card-loading-spinner"></span></span>';
}


seedPickerModal?.addEventListener('click', (event) => {
  const refreshButton = event.target.closest('[data-ui-action="refresh-seed-counts"]');
  if (refreshButton) {
    stopBettySeedPolling();
    const finishLog = startActionLog('Scanning Betty for seed counts...');
    setCardLoading(refreshButton);
    void (async () => {
      try {
        const fresh = await readBettySeeds();
        applyBettySeedSnapshot(fresh, { forceRender: true });
        if (!seedPickerModal.hidden) startBettySeedPolling();
      } catch (error) {
        logActionError(error.message || 'Failed to read Betty.');
      } finally {
        finishLog();
        clearCardLoading(refreshButton);
      }
    })();
    return;
  }
  const choice = event.target.closest('[data-seed-picker-choice]');
  if (choice) {
    const slotIndex = Number(choice.dataset.seedSlotIndex);
    const seed = seedPickerScan?.find((item) => Number(item.slotIndex) === slotIndex);
    if (!seed) return;
    if (seedPickerMode === 'planting-order') {
      togglePlantingSeedOrder(seedPickerKind, seed);
      renderSeedPicker();
      return;
    }
    const selected = { ...seed };
    if (seedPickerKind === 'fruit') selectedFruitSeed = selected;
    else selectedPlantSeed = selected;
    renderOverview();
    void cancelSeedPicker();
    return;
  }
  if (event.target.closest('[data-ui-action="close-seed-picker"]')) void cancelSeedPicker();
});

mapActivityContent.addEventListener('click', (event) => {
  const action = event.target.closest('[data-ui-action]')?.dataset.uiAction;
  if (action === 'choose-crop-seed') void openSeedPicker('crop', 'planting-order');
  if (action === 'choose-fruit-seed') void openSeedPicker('fruit', 'planting-order');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !seedPickerModal?.hidden) void cancelSeedPicker();
});

// ── Seed Bar: remove button handler ──────────────────────────────────────────
mapActivityContent.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-ui-action="remove-seed-from-bar"]');
  if (!btn) return;
  event.stopPropagation();
  const key = btn.dataset.seedBarKey;
  const resource = btn.dataset.seedBarResource;
  if (key && resource) {
    removeSeedFromOrder(resource, key);
    // Sync active seed
    const active = getActiveSeed(resource);
    if (resource === 'crop') selectedPlantSeed = active ? { ...active } : undefined;
    else selectedFruitSeed = active ? { ...active } : undefined;
    if (typeof renderOverview === 'function') renderOverview();
  }
});

// ── Seed Bar: Drag & Drop reorder ─────────────────────────────────────────────
let seedDragKey = null;
let seedDragResource = null;
let seedDragFromIndex = -1;

document.addEventListener('dragstart', (event) => {
  const slot = event.target.closest('[data-seed-bar-index]');
  if (!slot) return;
  seedDragKey = slot.dataset.seedBarKey;
  seedDragResource = slot.dataset.seedBarResource;
  seedDragFromIndex = Number(slot.dataset.seedBarIndex);
  slot.classList.add('is-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', seedDragKey);
});

document.addEventListener('dragend', (event) => {
  document.querySelectorAll('.seed-slot.is-dragging, .seed-slot.is-drag-over')
    .forEach((el) => el.classList.remove('is-dragging', 'is-drag-over'));
  seedDragKey = null;
  seedDragResource = null;
  seedDragFromIndex = -1;
});

document.addEventListener('dragover', (event) => {
  const slot = event.target.closest('[data-seed-bar-index]');
  if (!slot || !seedDragKey) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.seed-slot.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
  if (slot.dataset.seedBarKey !== seedDragKey) slot.classList.add('is-drag-over');
});

document.addEventListener('dragleave', (event) => {
  const slot = event.target.closest('[data-seed-bar-index]');
  if (slot) slot.classList.remove('is-drag-over');
});

document.addEventListener('drop', (event) => {
  const slot = event.target.closest('[data-seed-bar-index]');
  if (!slot || !seedDragKey) return;
  event.preventDefault();
  const toIndex = Number(slot.dataset.seedBarIndex);
  if (seedDragFromIndex !== -1 && toIndex !== seedDragFromIndex && slot.dataset.seedBarResource === seedDragResource) {
    moveSeedInOrder(seedDragResource, seedDragFromIndex, toIndex);
    // Sync active seed
    const active = getActiveSeed(seedDragResource);
    if (seedDragResource === 'crop') selectedPlantSeed = active ? { ...active } : undefined;
    else selectedFruitSeed = active ? { ...active } : undefined;
    if (typeof renderOverview === 'function') renderOverview();
  }
  document.querySelectorAll('.seed-slot.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
});

// Betty polling removed — seed picker now renders from catalog without opening Betty
