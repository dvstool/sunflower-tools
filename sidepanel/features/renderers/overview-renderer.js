/* Overview rendering and card transition effects. */

function renderOverview() {
  if (!overviewResults) return;
  const data = lastScanData;
  if (!data) return;
  const cardKey = (card) => [card.dataset.resource || '', card.dataset.cropName || '', card.dataset.miningResource || '', card.dataset.mapKeys || ''].join('|');
  const cardSignature = (card) => [
    Array.from(card.classList).filter((name) => name !== 'card-appear' && name !== 'card-state-change').sort().join(' '),
    card.dataset.count || '',
    card.dataset.saltHits || '',
    card.querySelector('.crop-card-state')?.textContent?.trim() || '',
    card.querySelector('.crop-card-title')?.textContent?.trim() || '',
    card.querySelector('.crop-image')?.currentSrc || card.querySelector('.crop-image')?.src || ''
  ].join('|');
  const previousCards = new Map(Array.from(overviewResults.querySelectorAll('.crop-card')).map((card) => {
    const key = cardKey(card);
    const box = card.getBoundingClientRect();
    const parentBox = overviewResults.getBoundingClientRect();
    return [key, { html: card.outerHTML, signature: cardSignature(card), left: box.left - parentBox.left, top: box.top - parentBox.top, width: box.width, height: box.height }];
  }));
  const previousCardOrderByMapKey = new Map();
  Array.from(overviewResults.querySelectorAll('.crop-card')).forEach((card, position) => {
    String(card.dataset.mapKeys || '').split('||').filter(Boolean).forEach((mapKey) => {
      if (!previousCardOrderByMapKey.has(mapKey)) previousCardOrderByMapKey.set(mapKey, position);
    });
  });  const cropSeed = selectedPlantSeed || null;
  const fruitSeed = typeof getActiveSeed === 'function' ? getActiveSeed('fruit') : null;
  const cropEmpty = Array.from((data.empty || []).reduce((groups, item) => {
    const key = `${item.fertiliserType || 0}|${Boolean(item.fertilised)}`;
    const current = groups.get(key) || { ...item, count: 0, mapKeys: [] };
    current.count += Number(item.count || (item.mapKeys || []).length || 0);
    current.mapKeys.push(...(item.mapKeys || []));
    groups.set(key, current);
    return groups;
  }, new Map()).values());
  const hasCropSoil = cropEmpty.length > 0;
  const hasFruitSoil = (data.fruit?.empty || []).length > 0;
  const hasFruit = Boolean((data.fruit?.empty?.length || 0) + (data.fruit?.ready?.length || 0) + (data.fruit?.growing?.length || 0) + (data.fruit?.dead?.length || 0));
  const cropCards = [
    ...cropEmpty.map((item) => cropCard({ ...item, label: 'Đất Crop trống', canPlant: Boolean(cropSeed), seedName: cropSeed?.name || '', seedIcon: cropSeed?.icon || '', seedCount: getSeedCount(cropSeed) }, 'empty')),
    ...(data.frozen?.count ? [cropCard({ ...data.frozen, label: 'Frozen Crop' }, 'frozen')] : []),
    ...(data.tornado?.count ? [cropCard({ ...data.tornado, label: 'Tornado Crop' }, 'tornado')] : []),
    ...(data.ready || []).map((item) => cropCard(item, 'ready'))
  ];
  const cropGrowingCards = (data.growing || []).map((item) => cropCard(item, 'growing'));
  const hasUnfertilisedCrop = (data.growing || []).some((item) => !item.fertilised);
  const fruitCards = [
    ...(data.fruit?.empty || []).map((item) => fruitCard(item, 'empty', fruitSeed)),
    ...(data.fruit?.ready || []).map((item) => fruitCard(item, 'ready', fruitSeed)),
    ...(data.fruit?.dead || []).map((item) => fruitCard(item, 'dead', fruitSeed))
  ];
  const fruitGrowingCards = (data.fruit?.growing || []).map((item) => fruitCard(item, 'growing', fruitSeed));
  const hasUnfertilisedFruit = (data.fruit?.growing || []).some((item) => !item.fertilised);
  const enrichComposters = (items = []) => {
    return items.flatMap((item) => (item.mapKeys || []).map((mapKey) => {
      const detail = composterDetails.get(mapKey) || {};
      return { ...item, count: 1, seconds: detail.seconds ?? item.seconds ?? null, recipe: detail.recipe || item.recipe || [], requirements: detail.requirements || item.requirements || [], canCompost: detail.canCompost, mapKeys: [mapKey] };
    }));
  };
  const composters = {
    ready: enrichComposters(data.composters?.ready),
    empty: enrichComposters(data.composters?.empty),
    growing: enrichComposters(data.composters?.growing)
  };
  const composterPosition = (item) => {
    const identity = `${item.label || ''} ${item.icon || ''}`.toLowerCase();
    if (identity.includes('premium')) return 2;
    if (identity.includes('turbo')) return 1;
    if (identity.includes('compost bin') || identity.includes('compost_bin')) return 0;
    return 99;
  };
  const composterCards = [
    ...composters.ready.map((item) => ({ item, type: 'ready' })),
    ...composters.empty.map((item) => ({ item, type: 'empty' })),
    ...composters.growing.map((item) => ({ item, type: 'growing' }))
  ].sort((left, right) => composterPosition(left.item) - composterPosition(right.item))
    .map(({ item, type }) => composterCard(item, type));
  const hasComposters = Boolean(composterCards.length);
  const readyTrees = data.trees?.ready || [];
  const growingTrees = data.trees?.growing || [];
  const treeCards = readyTrees.map((item) => treeCard(item, 'ready'));
  const treeGrowingCards = growingTrees.map((item) => treeCard(item, 'growing'));
  const miningOrder = { stone: 0, iron: 1, gold: 2 };
  const sortMining = (items) => [...items].sort((left, right) => (miningOrder[left.resource] ?? 99) - (miningOrder[right.resource] ?? 99));
  const readyMining = sortMining(data.mining?.ready || []);
  const growingMining = sortMining(data.mining?.growing || []);
  const miningCards = readyMining.map((item) => miningCard(item, 'ready'));
  const miningGrowingCards = growingMining.map((item) => miningCard(item, 'growing'));
  const saltReady = data.salt?.ready || [];
  const saltGrowing = data.salt?.growing || [];
  const saltCards = saltReady.map((item) => saltCard(item));
  const saltGrowingCards = saltGrowing.map((item) => saltCard(item, true));
  const resourceCards = [...treeCards, ...miningCards, ...saltCards];
  const resourceGrowingCards = [...treeGrowingCards, ...miningGrowingCards, ...saltGrowingCards];
  const dailyShipment = data.dailyShipment;
  // Keep the Foraging card visible even when no mushroom is currently on map,
  // so its hover action can reload the map and look for the next spawn.
  const mushroomCards = [mushroomCard(data.mushrooms || {})];
  const sleepingPetCards = (data.pets?.sleeping || []).map((item) => petCard(item, 'sleeping'));
  const awakePetCards = (data.pets?.awake || []).map((item) => petCard(item, 'awake'));
  const mapCards = (() => {
    const detail = landInfo?.querySelector('.land-details');
    const balances = Array.from(landInfo?.querySelectorAll('.land-balance') || []);
    const landName = Array.from(detail?.querySelector('strong')?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(' ') || '';
    const landIcon = detail?.querySelector('.land-thumbnail')?.currentSrc || detail?.querySelector('.land-thumbnail')?.src || '';
    const season = detail?.querySelector('span')?.textContent.trim() || '';
    const cards = [];
    if (landName) {
      cards.push(`<article class="crop-card map-overview-card map-land-card" data-resource="map-land"><div class="crop-icon-box">${landIcon ? `<img class="crop-image" src="${escapeHtml(landIcon)}" alt="" />` : '<span class="map-card-fallback">⌂</span>'}</div><div class="crop-card-content"><span class="crop-card-state">Land</span><strong class="crop-card-title">${escapeHtml(landName)}</strong>${season ? `<span class="crop-card-meta">${escapeHtml(season)}</span>` : ''}</div></article>`);
    }
    balances.forEach((balance, index) => {
      const rawLabel = balance.querySelector('img')?.alt || 'Số dư';
      const label = ({ coins: 'COINS', gems: 'GEMS', flw: 'FLOWER', flower: 'FLOWER' })[rawLabel.trim().toLowerCase()] || rawLabel.toUpperCase();
      const icon = balance.querySelector('img')?.currentSrc || balance.querySelector('img')?.src || '';
      const value = balance.querySelector('b')?.textContent.trim() || balance.textContent.trim();
      if (!value) return;
      cards.push(`<article class="crop-card map-overview-card map-${escapeHtml(label.toLowerCase())}-card" data-resource="map-balance-${index}"><div class="crop-icon-box">${icon ? `<img class="crop-image" src="${escapeHtml(icon)}" alt="" />` : '<span class="map-card-fallback">●</span>'}</div><div class="crop-card-content"><span class="crop-card-state">${escapeHtml(label)}</span><strong class="crop-card-title">${escapeHtml(value)}</strong></div></article>`);
    });
    if (dailyShipment?.icon) {
      cards.push(`<article class="crop-card map-overview-card daily-shipment-card is-ready" data-ui-action="open-daily-shipment" data-resource="daily-shipment" data-map-keys="${escapeHtml((dailyShipment.mapKeys || []).join('||'))}" data-count="${dailyShipment.count || 1}"><div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(dailyShipment.icon)}" alt="Daily Shipment" />${dailyShipment.count > 1 ? `<b class="crop-quantity">×${dailyShipment.count}</b>` : ''}</div><div class="crop-card-content"><span class="crop-card-state">Restock</span><strong class="crop-card-title">Daily Shipment</strong></div></article>`);
    }
    return cards;
  })();
  const reloadButton = (name, scanScope) => {
    const buttonLabel = `Reload ${name}`;
    const icon = '<span class="reload-action-icon reload-action-static"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg></span><span class="reload-action-icon reload-action-loading" aria-hidden="true"><span class="card-loading-spinner"></span></span>';
    return scanScope === 'fertilisers'
      ? `<button class="profession-scan profession-fertiliser-scan${fertilisersScanned ? '' : ' is-unscanned'}" type="button" data-ui-action="scan-fertilisers" title="Quét túi đồ để đọc Fertilisers" aria-label="Quét Fertilisers"><img src="${fertiliserIcon}" alt="" /></button>`
      : scanScope === 'map'
      ? `<button class="profession-scan" type="button" data-ui-action="scan-map-header" title="Reload Map" aria-label="Reload Map">${icon}</button>`
      : scanScope === 'tools'
      ? `<button class="profession-scan" type="button" data-ui-action="scan-tools-header" title="Quét Tools đầy đủ" aria-label="Quét Tools đầy đủ">${icon}</button>`
      : scanScope === 'resource-tools'
      ? `<button class="profession-scan" type="button" data-ui-action="scan-resource-tools" title="Đọc số lượng Tools" aria-label="Đọc số lượng Tools">${icon}</button>`
      : scanScope === 'composter'
      ? `<button class="profession-scan" type="button" data-ui-action="scan-composter" title="${buttonLabel}" aria-label="${buttonLabel}">${icon}</button>`
      : `<button class="profession-scan" type="button" data-ui-action="scan-profession" data-scan-scope="${scanScope}" title="${buttonLabel}" aria-label="${buttonLabel}">${icon}</button>`;
  };
  const fertiliserButtons = (resource, hasUnfertilised) => {
    const icons = resource === 'fruit' ? fruitFertiliserIcons : cropFertiliserIcons;
    return `<span class="seed-bar-divider" aria-hidden="true"></span><div class="seed-bar-fertiliser-group">${icons.map((icon, index) => {
      const count = fertilisersScanned ? Math.max(0, Number(fertiliserCounts.get(icon)) || 0) : null;
      const state = !fertilisersScanned ? ' is-unscanned' : !count ? ' is-empty' : '';
      const needsScan = !fertilisersScanned || !count;
      const canSelect = fertilisersScanned && Boolean(count) && hasUnfertilised;
      const title = needsScan
        ? 'Quét túi đồ để đọc Fertilisers'
        : fertilisersScanned
        ? (hasUnfertilised ? `Chọn để bón phân ${index + 1} cho ${resource === 'fruit' ? 'Fruit' : 'Crop'}` : `Phân bón ${index + 1}: chưa có cây cần bón`)
        : 'Quét túi đồ để đọc Fertilisers';
      const action = needsScan ? 'scan-fertilisers' : (canSelect ? 'select-fertiliser' : '');
      const scanOverlay = needsScan ? '<span class="fertiliser-scan-overlay" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg></span>' : '';
      const disabled = fertilisersScanned && Boolean(count) && !canSelect;
      return `<button class="seed-slot seed-fertiliser-slot profession-fertiliser-button${state}" type="button"${action ? ` data-ui-action="${action}"` : ''} data-resource="${resource}" data-fertiliser-index="${index}" title="${title}" aria-label="${title}"${disabled ? ' disabled' : ''}><img src="${icon}" alt="" /><b>x${count === null ? '--' : formatExactCount(count)}</b>${scanOverlay}</button>`;
    }).join('')}</div>`;
  };
  const professionAutoControls = (name, scanScope) => {
    if (!scanScope || ['map', 'mushroom', 'pet'].includes(scanScope)) return '';
    const enabled = professionAutoEnabled.has(scanScope);
    const toggleLabel = `${enabled ? 'T\u1eaft' : 'B\u1eadt'} Auto ${name}`;
    const settingsIcon = '<svg class="map-tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    return `<div class="profession-auto-card" aria-label="\u0110i\u1ec1u khi\u1ec3n t\u1ef1 \u0111\u1ed9ng ${name}"><button class="profession-auto-toggle${enabled ? ' is-on' : ''}" type="button" data-ui-action="toggle-profession-auto" data-profession="${scanScope}" aria-pressed="${enabled}" title="${toggleLabel}"><span class="profession-auto-switch" aria-hidden="true"></span><span>AUTO</span></button></div>`;
  };
  // Seed Bar: shows planting order from plantingSeedOrder with drag-drop reorder
  const buildSeedBar = (resource, hasUnfertilised) => {
    const order = plantingOrderFor(resource);
    const activeSeed = getActiveSeed(resource);
    const activeKey = activeSeed?.key || '';
    let availableOrder = 0;
    const slots = order.map((key, index) => {
      const entry = seedBarCache.get(key);
      if (!entry) return '';
      const icon = resource === 'crop' ? cropSeedDisplayIcon(entry) : (entry.icon || '');
      const count = Math.max(0, Number(entry.count) || 0);
      const isActive = key === activeKey;
      const isDepleted = count <= 0;
      const priority = isDepleted ? 0 : ++availableOrder;
      return `<div class="seed-slot${isActive ? ' is-active' : ''}${isDepleted ? ' is-depleted' : ''}" draggable="true" data-seed-bar-key="${escapeHtml(key)}" data-seed-bar-index="${index}" data-seed-bar-resource="${resource}" title="${escapeHtml(entry.name || key)} x${count}"><img src="${escapeHtml(icon)}" alt="" /><b>x${formatExactCount(count)}</b>${priority ? `<span class="seed-order-number">${priority}</span>` : ''}${isActive ? '<span class="seed-active-dot"></span>' : ''}<button class="seed-slot-remove" type="button" data-ui-action="remove-seed-from-bar" data-seed-bar-key="${escapeHtml(key)}" data-seed-bar-resource="${resource}" title="Remove">&times;</button></div>`;
    }).join('');
    const addBtn = `<button class="seed-slot seed-slot-empty" type="button" data-ui-action="${resource === 'crop' ? 'choose-crop-seed' : 'choose-fruit-seed'}" title="Add seed">+</button>`;
    return `<div class="seed-selector-bar" data-seed-bar-resource="${resource}"><div class="seed-selector-slots">${slots}${addBtn}${fertiliserButtons(resource, hasUnfertilised)}</div></div>`;
  };
  const buildResourceToolsBar = () => {
    const definitions = [
      { name: 'Axe', fallback: axeIcon, pattern: /\/tools\/axe\.png(?:[?#]|$)/i },
      ...Object.values(pickaxeTools),
      { name: 'Salt Rake', fallback: saltRakeFallback, pattern: /\/tools\/salt[_-]?rake\.(?:webp|png)(?:[?#]|$)/i }
    ];
    const slots = definitions.map((tool) => {
      const source = resourceToolSource(tool.pattern, tool.fallback);
      const count = toolBagScanned ? resourceToolCount(tool.pattern) : null;
      const state = count === null ? ' is-unscanned' : count <= 0 ? ' is-depleted' : '';
      const countLabel = count === null ? '--' : formatExactCount(count);
      const action = toolBagScanned ? 'open-tool-shop' : 'scan-resource-tools';
      const title = toolBagScanned ? `${tool.name} x${countLabel}` : `Scan ${tool.name}`;
      return `<button class="seed-slot resource-tool-slot${state}" type="button" data-ui-action="${action}" data-tool-icon="${escapeHtml(source)}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}"><img src="${escapeHtml(source)}" alt="" /><b>x${countLabel}</b></button>`;
    }).join('');
    const reloadIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';
    const reload = `<button class="seed-slot resource-tools-reload" type="button" data-ui-action="scan-resource-tools" title="Reload Tools" aria-label="Reload Tools">${reloadIcon}</button>`;
    return `<div class="seed-selector-bar resource-tools-bar"><div class="seed-selector-slots">${slots}${reload}</div></div>`;
  };
  const buildResourceAutoControls = () => `<div class="resources-auto-controls">${[
    ['Tree', 'tree'],
    ['Mine', 'mining'],
    ['Salt', 'salt']
  ].map(([name, scope]) => `<div class="resource-auto-control"><b>${name}</b>${professionAutoControls(name, scope)}</div>`).join('')}</div>`;
  const section = (name, cards, growingCards = [], scanScope = '', headerScopes = [scanScope], headerExtra = '', seedBar = '') => {
    const header = headerScopes.map((scope) => reloadButton(scope === 'fertilisers' ? 'Fertilisers' : (scope === 'tools' || scope === 'resource-tools') ? 'Tools' : name, scope)).join('');
    const autoControls = professionAutoControls(name, scanScope);
    const autoClass = scanScope === 'crop' && professionAutoEnabled.has('crop') ? ' is-auto-running' : '';
    return `<section class="overview-section overview-profession-card${autoClass}" data-profession="${scanScope || name.toLowerCase()}"><header class="overview-profession-header"><h2>${name}</h2><div class="overview-section-controls">${autoControls}${headerExtra}${header}</div></header>${seedBar}<div class="crop-grid">${cards.join('')}</div>${growingCards.length ? `<div class="crop-grid overview-growing-grid">${growingCards.join('')}</div>` : ''}</section>`;
  };
  overviewResults.innerHTML = `<div class="activity-group" data-activity="overview">${section('Map', mapCards, [], 'map', ['map'])}${section('Foraging', mushroomCards, [], 'mushroom')}${sleepingPetCards.length || awakePetCards.length ? section('Pet', sleepingPetCards, awakePetCards, 'pet') : ''}${section('Crop', cropCards, cropGrowingCards, 'crop', ['crop'], '', buildSeedBar('crop', hasUnfertilisedCrop))}${hasFruit ? section('Fruit', fruitCards, fruitGrowingCards, 'fruit', ['fruit'], '', buildSeedBar('fruit', hasUnfertilisedFruit)) : ''}${hasComposters ? section('Composter', composterCards, [], 'composter') : ''}${section('Resources', resourceCards, resourceGrowingCards, '', ['resources'], '', `${buildResourceAutoControls()}${buildResourceToolsBar()}`)}</div>`;
  // All states share one grid. Ready/empty cards are promoted, while cards
  // that transition into a cooldown retain their previous map position.
  overviewResults.querySelectorAll('.overview-section').forEach((section) => {
    if (section.dataset.profession === 'composter') return;
    const grids = Array.from(section.querySelectorAll(':scope > .crop-grid'));
    if (!grids.length) return;
    const cards = grids.flatMap((grid) => Array.from(grid.querySelectorAll(':scope > .crop-card'))).map((card, index) => ({ card, index }));
    const previousPosition = (card) => {
      const positions = String(card.dataset.mapKeys || '').split('||').filter(Boolean).map((mapKey) => previousCardOrderByMapKey.get(mapKey)).filter(Number.isFinite);
      return positions.length ? Math.min(...positions) : Number.MAX_SAFE_INTEGER;
    };
    const keepsFixedPositions = section.dataset.profession === 'salt';
    const isDailyShipment = (card) => card.dataset.resource === 'daily-shipment';
    const isPriority = (card) => card.classList.contains('is-empty') || card.classList.contains('is-ready');
    cards.sort((left, right) => {
      const dailyShipmentDifference = Number(isDailyShipment(left.card)) - Number(isDailyShipment(right.card));
      if (dailyShipmentDifference) return dailyShipmentDifference;
      const priorityDifference = keepsFixedPositions ? 0 : Number(isPriority(right.card)) - Number(isPriority(left.card));
      if (priorityDifference) return priorityDifference;
      const positionDifference = previousPosition(left.card) - previousPosition(right.card);
      return positionDifference || left.index - right.index;
    });
    grids[0].append(...cards.map(({ card }) => card));
    grids.slice(1).forEach((grid) => grid.remove());
  });  const currentCards = new Set();
  overviewResults.querySelectorAll('.crop-card').forEach((card) => {
    const key = cardKey(card);
    currentCards.add(key);
    const previous = previousCards.get(key);
    if (!previous) card.classList.add('card-appear');
    else if (previous.signature !== cardSignature(card)) card.classList.add('card-state-change');
  });
  previousCards.forEach((previous, key) => {
    if (currentCards.has(key) || !previous.width || !previous.height) return;
    const leavingCard = document.createElement('div');
    leavingCard.className = 'card-leave-overlay';
    leavingCard.style.cssText = `left:${previous.left}px;top:${previous.top}px;width:${previous.width}px;height:${previous.height}px;`;
    leavingCard.innerHTML = previous.html;
    overviewResults.append(leavingCard);
    leavingCard.addEventListener('animationend', () => leavingCard.remove(), { once: true });
  });
  // Re-rendering replaces the Overview DOM node. Preserve the currently open
  // activity instead of letting the new Overview node appear by default.
  const activeActivity = mapActivityTabs.find((tab) => tab.classList.contains('is-active'))?.dataset.mapActivityTab || 'overview';
  const overviewGroup = overviewResults.querySelector('.activity-group[data-activity="overview"]');
  if (overviewGroup) overviewGroup.hidden = activeActivity !== 'overview';
  updateMapActivityTabIndicators();
  schedulePetSleepCheck();
}
