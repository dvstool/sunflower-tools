/* Local state transitions for crop, mining, salt and fruit actions. */

const sidepanelCacheTtlMs = 30 * 60 * 1000;
const expiredCountdownGraceMs = 5 * 60 * 1000;

function collectLiveMapCacheKeys(data = lastScanData) {
  const itemKeys = new Set();
  const groupKeys = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (Array.isArray(value.mapKeys)) {
      value.mapKeys.forEach((mapKey) => itemKeys.add(mapKey));
      if (value.mapKeys.length) groupKeys.add(value.mapKeys.join('||'));
    }
    Object.entries(value).forEach(([key, child]) => { if (key !== 'mapKeys') visit(child); });
  };
  visit(data);
  return { itemKeys, groupKeys };
}

function pruneSidepanelCaches() {
  if (!lastScanData) return;
  const now = Date.now();
  const { itemKeys, groupKeys } = collectLiveMapCacheKeys();
  countdownTargets.forEach((target, key) => {
    if (!groupKeys.has(key) || !Number.isFinite(Number(target)) || Number(target) < now - expiredCountdownGraceMs) countdownTargets.delete(key);
  });
  composterDetails.forEach((detail, mapKey) => {
    if (!itemKeys.has(mapKey) || (Number(detail?.updatedAt) && now - Number(detail.updatedAt) > sidepanelCacheTtlMs)) composterDetails.delete(mapKey);
  });
}

function startSidepanelCachePruning() {
  if (cachePruneTimer) return;
  pruneSidepanelCaches();
  cachePruneTimer = window.setInterval(pruneSidepanelCaches, 5 * 60 * 1000);
}

function applyPlantResult(result) {
  const normaliseSeedName = (value) => String(value || '').replace(/\s+seed$/i, '').trim().toLowerCase().replace(/brocolli/g, 'broccoli');
  const plantedSeedName = normaliseSeedName(result.seedName);
  if (lastScanData?.heldSeed?.isSeed && normaliseSeedName(lastScanData.heldSeed.name) === plantedSeedName) lastScanData.heldSeed.count = Number(result.remainingSeeds) || 0;
  if (selectedPlantSeed && normaliseSeedName(selectedPlantSeed.name) === plantedSeedName) selectedPlantSeed.count = Math.max(0, Number(result.remainingSeeds) || 0);
  if (typeof syncSeedPickerCount === 'function') syncSeedPickerCount(result.seedName, result.remainingSeeds);
  if (typeof getActiveSeed === 'function') {
    const nextSeed = getActiveSeed('crop');
    selectedPlantSeed = nextSeed ? { ...nextSeed } : undefined;
  }
  if (lastScanData) {
    const plantedKeys = new Set((result.growing || []).flatMap((item) => item.mapKeys || []));
    const plantedCounts = new Map((result.emptyCounts || []).map((item) => [Number(item.fertiliserType || 0), Number(item.count || 0)]));
    lastScanData.empty = (lastScanData.empty || []).flatMap((item) => {
      const itemKeys = item.mapKeys || [];
      if (itemKeys.length) {
        const remainingKeys = itemKeys.filter((key) => !plantedKeys.has(key));
        return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
      }
      const fertiliserType = Number(item.fertiliserType || 0);
      const remaining = Math.max(0, Number(item.count || 0) - (plantedCounts.get(fertiliserType) || 0));
      return remaining ? [{ ...item, count: remaining, mapKeys: [] }] : [];
    });
    if ((result.growing || []).length) lastScanData.growing = [...(lastScanData.growing || []), ...(result.growing || [])];
    return;
  }
  const emptySection = cropResults.querySelector('[data-activity="crop"] .crop-section');
  result.emptyCounts.forEach(({ fertiliserType, count }) => {
    const card = emptySection && Array.from(emptySection.querySelectorAll('.crop-card')).find((item) => item.querySelector('[data-ui-action="plant"]') && Number(item.dataset.fertiliserType) === fertiliserType);
    if (!card) return;
    const remaining = Math.max(0, Number(card.dataset.count) - count);
    if (!remaining) card.remove();
    else { card.dataset.count = String(remaining); card.querySelector('.crop-quantity').textContent = `×${remaining}`; }
  });
  if (emptySection && !emptySection.querySelector('[data-ui-action="plant"]') && !emptySection.querySelector('.crop-card')) emptySection.remove();
  if (!result.growing.length) return;
  let growingSection = cropGrowingResults.querySelector('[data-activity="crop"] .crop-section');
  if (!growingSection) {
    growingSection = document.createElement('div');
    growingSection.className = 'crop-section';
    growingSection.dataset.cropSection = 'growing';
    growingSection.innerHTML = '<div class="crop-grid"></div>';
    let cropPanel = cropGrowingResults.querySelector('[data-crop-panel="growing"]');
    if (!cropPanel) { cropGrowingResults.innerHTML = '<section class="crop-panel" data-crop-panel="growing"><h2>Đang hồi</h2></section>'; cropPanel = cropGrowingResults.querySelector('[data-crop-panel="growing"]'); }
    const group = document.createElement('div');
    group.className = 'activity-group';
    group.dataset.activity = 'crop';
    group.innerHTML = '<h3>Crop</h3>';
    group.append(growingSection);
    cropPanel.append(group);
  }
  const grid = growingSection.querySelector('.crop-grid');
  result.growing.forEach((item) => grid.insertAdjacentHTML('beforeend', cropCard(item, 'growing')));
  startCountdowns();
}

function applyFertiliserResult(resource, mapKeys = [], fertiliserType = 0) {
  const changedKeys = new Set(mapKeys);
  const collection = resource === 'fruit' ? lastScanData?.fruit : lastScanData;
  if (!changedKeys.size || !collection?.growing) return;

  const fertilised = [];
  collection.growing = collection.growing.flatMap((item) => {
    const affectedKeys = (item.mapKeys || []).filter((key) => changedKeys.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !changedKeys.has(key));
    if (affectedKeys.length) fertilised.push({ ...item, count: affectedKeys.length, mapKeys: affectedKeys, fertilised: true, fertiliserType });
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  fertilised.forEach((item) => {
    const existing = collection.growing.find((candidate) => candidate.label === item.label && Number(candidate.fertiliserType || 0) === Number(item.fertiliserType || 0) && Number(candidate.seconds) === Number(item.seconds) && Boolean(candidate.fertilised));
    if (existing) {
      existing.count += item.count;
      existing.mapKeys.push(...item.mapKeys);
    } else collection.growing.push(item);
  });
}

function refreshAffectedSection(card, sections = []) {
  if (!lastScanData) return;
  const keys = new Set(String(card?.dataset?.mapKeys || '').split('||').filter(Boolean));
  if (!keys.size) return;
  const prune = (items = []) => items.map((item) => {
    const mapKeys = (item.mapKeys || []).filter((key) => !keys.has(key));
    return { ...item, mapKeys, count: mapKeys.length };
  }).filter((item) => item.mapKeys.length);
  if (sections.includes('crop')) ['ready', 'growing', 'empty'].forEach((state) => { lastScanData[state] = prune(lastScanData[state]); });
  if (sections.includes('fruit') && lastScanData.fruit) ['ready', 'growing', 'empty', 'dead'].forEach((state) => { lastScanData.fruit[state] = prune(lastScanData.fruit[state]); });
  if (sections.includes('tree') && lastScanData.trees) ['ready', 'growing'].forEach((state) => { lastScanData.trees[state] = prune(lastScanData.trees[state]); });
  if (sections.includes('mining') && lastScanData.mining) ['ready', 'growing'].forEach((state) => { lastScanData.mining[state] = prune(lastScanData.mining[state]); });
  if (sections.includes('composter') && lastScanData.composters) {
    ['ready', 'empty', 'growing'].forEach((state) => { lastScanData.composters[state] = prune(lastScanData.composters[state]); });
    keys.forEach((key) => composterDetails.delete(key));
  }
  if (sections.includes('salt') && lastScanData.salt) ['ready', 'growing', 'upgrade'].forEach((state) => { lastScanData.salt[state] = prune(lastScanData.salt[state]); });
  if (sections.includes('pet') && lastScanData.pets) lastScanData.pets.sleeping = prune(lastScanData.pets.sleeping);
  if (sections.includes('mushroom') && lastScanData.mushrooms) Object.values(lastScanData.mushrooms).forEach((item) => { if (item) { item.mapKeys = (item.mapKeys || []).filter((key) => !keys.has(key)); item.count = item.mapKeys.length; } });
  renderOverview();
  startCountdowns();
}

function applyComposterStates(states = []) {
  if (!lastScanData || !states.length) return;
  const groups = { ready: [], empty: [], growing: [] };
  states.forEach((state) => {
    const detail = composterDetails.get(state.mapKey) || {};
    const keepGrowing = state.state === 'ready' && detail.state === 'growing' && Number(detail.transitionUntil) > Date.now();
    const nextState = keepGrowing ? 'growing' : state.state;
    const nextIcon = keepGrowing ? composterIconForState(state.icon || detail.icon, 'growing') : state.icon;
    groups[nextState].push({ label: state.label, icon: nextIcon, count: 1, mapKeys: [state.mapKey] });
    if (nextState !== 'growing') composterDetails.delete(state.mapKey);
  });
  lastScanData.composters = groups;
}

function applyFruitStates(states = [], options = {}) {
  if (!lastScanData?.fruit || !states.length) return;
  const changed = new Set(states.map((state) => state.mapKey));
  const originalByKey = new Map();
  ['ready', 'growing', 'empty', 'dead'].forEach((state) => (lastScanData.fruit[state] || []).forEach((item) => (item.mapKeys || []).forEach((mapKey) => originalByKey.set(mapKey, item))));
  // A harvested/planted Fruit keeps its map key, but its old countdown must
  // never be reused for the next lifecycle. Remove every affected cache key.
  changed.forEach((mapKey) => {
    const original = originalByKey.get(mapKey);
    if (original?.mapKeys?.length) countdownTargets.delete(original.mapKeys.join('||'));
    countdownTargets.delete(mapKey);
  });
  ['ready', 'growing', 'empty', 'dead'].forEach((state) => {
    lastScanData.fruit[state] = (lastScanData.fruit[state] || []).flatMap((item) => {
      const mapKeys = (item.mapKeys || []).filter((mapKey) => !changed.has(mapKey));
      return mapKeys.length ? [{ ...item, count: mapKeys.length, mapKeys }] : [];
    });
  });
  states.forEach((state) => {
    const original = originalByKey.get(state.mapKey) || {};
    const target = lastScanData.fruit[state.state] || (lastScanData.fruit[state.state] = []);
    const label = state.state === 'empty' ? 'Đất Fruit trống' : state.state === 'dead' ? 'Gốc Fruit chết' : state.label || original.label || 'Fruit';
    const newlyPlanted = Boolean(options.newlyPlanted && state.state === 'growing');
    const candidate = {
      ...original,
      label,
      icon: state.icon || original.icon,
      count: 1,
      mapKeys: [state.mapKey],
      seconds: state.state === 'growing' ? state.seconds : null,
      countdownTarget: null,
      // Empty Fruit soil may have been fertilised, but a Fruit just planted
      // on it must not inherit that UI state.
      ...(newlyPlanted ? { fertilised: false, fertiliserType: 0 } : {})
    };
    const group = target.find((item) => item.label === candidate.label && Number(item.fertiliserType || 0) === Number(candidate.fertiliserType || 0) && Number(item.seconds) === Number(candidate.seconds));
    if (group) { group.count += 1; group.mapKeys.push(state.mapKey); } else target.push(candidate);
  });
}

function moveHarvestedCropsToEmpty(mapKeys = []) {
  if (!lastScanData || !mapKeys.length) return;
  const harvested = new Set(mapKeys);
  const moved = [];
  lastScanData.ready = (lastScanData.ready || []).flatMap((item) => {
    const movedKeys = (item.mapKeys || []).filter((key) => harvested.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !harvested.has(key));
    // Fertiliser belongs to the harvested crop, never to the newly empty soil.
    // Reset it here so slots harvested from differently fertilised crop cards
    // are reconciled into one empty-soil card.
    if (movedKeys.length) moved.push({ ...item, icon: 'https://sunflower-land.com/game-assets/crops/soil2.png', fertilised: false, fertiliserType: 0, count: movedKeys.length, mapKeys: movedKeys, seconds: null, countdownTarget: null });
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  lastScanData.empty = [...(lastScanData.empty || []), ...moved];
}

function moveMinedRocksToGrowing(mapKeys = []) {
  if (!lastScanData?.mining || !mapKeys.length) return;
  const mined = new Set(mapKeys);
  const moved = [];
  lastScanData.mining.ready = (lastScanData.mining.ready || []).flatMap((item) => {
    const movedKeys = (item.mapKeys || []).filter((key) => mined.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !mined.has(key));
    if (movedKeys.length) moved.push({ ...item, count: movedKeys.length, mapKeys: movedKeys, seconds: null, countdownTarget: null });
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  lastScanData.mining.growing = [...(lastScanData.mining.growing || []), ...moved];
}

function applyMiningTimers(timerEntries = []) {
  if (!lastScanData?.mining || !timerEntries.length) return;
  const secondsByKey = new Map(timerEntries.filter((entry) => Number.isFinite(entry.seconds)).map((entry) => [entry.mapKey, entry.seconds]));
  const grouped = new Map();
  (lastScanData.mining.growing || []).forEach((item) => (item.mapKeys || []).forEach((mapKey) => {
    const seconds = secondsByKey.has(mapKey) ? secondsByKey.get(mapKey) : item.seconds;
    const key = `${item.resource}|${Number.isFinite(seconds) ? seconds : 'unknown'}|${item.icon}`;
    const current = grouped.get(key) || { ...item, count: 0, seconds: Number.isFinite(seconds) ? seconds : null, countdownTarget: null, mapKeys: [] };
    current.count += 1;
    current.mapKeys.push(mapKey);
    grouped.set(key, current);
  }));
  lastScanData.mining.growing = Array.from(grouped.values());
}

function advanceHarvestedSalt(mapKeys = [], hitsTaken = 1) {
  if (!lastScanData?.salt || !mapKeys.length) return;
  const harvested = new Set(mapKeys);
  const nextReady = [];
  const movedToGrowing = [];
  lastScanData.salt.ready = (lastScanData.salt.ready || []).flatMap((item) => {
    const keys = item.mapKeys || [];
    return keys.flatMap((mapKey) => {
      if (!harvested.has(mapKey)) return [{ ...item, count: 1, mapKeys: [mapKey] }];
      const remainingHits = Math.max(0, Number(item.hits || 1) - Math.max(1, Number(hitsTaken) || 1));
      const nextState = { ...item, hits: remainingHits, count: 1, mapKeys: [mapKey], seconds: null, countdownTarget: null };
      if (remainingHits) nextReady.push(nextState);
      else movedToGrowing.push(nextState);
      return [];
    });
  });
  lastScanData.salt.ready.push(...nextReady);
  (lastScanData.salt.growing || (lastScanData.salt.growing = [])).push(...movedToGrowing);
}

function moveFruitCards(mapKeys = [], fromState, toState, icon) {
  if (!lastScanData?.fruit || !mapKeys.length) return;
  const changed = new Set(mapKeys);
  const moved = [];
  lastScanData.fruit[fromState] = (lastScanData.fruit[fromState] || []).flatMap((item) => {
    const movedKeys = (item.mapKeys || []).filter((key) => changed.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !changed.has(key));
    if (movedKeys.length) moved.push({ ...item, icon: icon || item.icon, count: movedKeys.length, mapKeys: movedKeys, seconds: null, countdownTarget: null });
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  lastScanData.fruit[toState] = [...(lastScanData.fruit[toState] || []), ...moved];
}

