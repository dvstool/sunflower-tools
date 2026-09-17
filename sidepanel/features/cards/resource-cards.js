function pickaxeSource(resource) {
  const tool = pickaxeTools[resource];
  if (!tool) return '';
  return Array.from(toolCounts.keys()).find((source) => tool.pattern.test(source)) || '';
}

function resourceToolSource(pattern, fallback = '') {
  return Array.from(toolCounts.keys()).find((source) => pattern.test(source)) || fallback;
}

function resourceToolCount(pattern) {
  const source = Array.from(toolCounts.keys()).find((candidate) => pattern.test(candidate));
  return source ? Math.max(0, Number(toolCounts.get(source)) || 0) : 0;
}
/* Markup for map resources other than Crop and Fruit. */

function miningCard(item, type) {
  const growing = type === 'growing';
  const scannedToolIcon = pickaxeSource(item.resource);
  const tool = pickaxeTools[item.resource] || {};
  const toolCount = scannedToolIcon ? (toolCounts.get(scannedToolIcon) ?? 0) : toolBagScanned ? 0 : '—';
  const needsToolScan = !growing && !toolBagScanned;
  const toolUnavailable = !growing && toolBagScanned && !Number(toolCount);
  const detail = growing ? (Number.isFinite(item.seconds) ? countdownMarkup(item) : 'Đang cập nhật thời gian…') : '';
  const rockCount = Number(item.count || 0);
  const maxMines = toolBagScanned && Number.isFinite(Number(toolCount)) ? Math.min(rockCount, Math.max(0, Number(toolCount))) : 0;
  const mineLabel = `Mine x${maxMines}`;

  const actionAttr = growing ? '' : needsToolScan
    ? ' data-ui-action="scan-resource-tools"'
    : maxMines
      ? ` data-ui-action="mine" data-action-label="${mineLabel}"`
      : '';

  const hoverOverlay = growing ? '' : needsToolScan
    ? `<div class="card-hover-overlay is-scan"><span class="overlay-icon">🔍</span><span class="overlay-label">Scan tools</span></div>`
    : maxMines
      ? `<div class="card-hover-overlay is-mine"><span class="overlay-icon">⛏️</span><span class="overlay-label">Mine x${maxMines}</span></div>`
      : toolUnavailable
        ? '<div class="card-hover-overlay is-unavailable"><span class="overlay-label">No Pickaxe</span></div>'
        : '';
  const hint = growing ? '' : needsToolScan
    ? `<span class="card-action-hint">Nhấn để Scan tools</span>`
    : maxMines ? `<span class="card-action-hint">Nhấn để Mine x${maxMines}</span>` : '';

  return `<article class="crop-card tree-card mining-card is-${growing ? 'growing' : 'ready'} ${growing ? '' : 'is-ready'}${needsToolScan ? ' needs-tool-scan' : toolUnavailable ? ' is-tool-insufficient' : ''}"${actionAttr} data-resource="mining" data-mining-resource="${item.resource}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}">${hoverOverlay}<div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.label)}" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">${growing ? 'RECOVERING' : 'READY'}</span><strong class="crop-card-title">${escapeHtml(item.label)}</strong>${detail ? `<span class="crop-card-meta">${detail}</span>` : ''}${hint}</div></article>`;
}

function saltRakeSource() {
  return Array.from(toolCounts.keys()).find((source) => /salt[_-]?rake/i.test(source));
}

function saltCard(item, growing = false) {
  const rakeSource = saltRakeSource();
  const rakeCount = rakeSource ? (toolCounts.get(rakeSource) ?? 0) : toolBagScanned ? 0 : '—';
  if (growing) {
    const hasCountdown = Number.isFinite(item.seconds) && item.seconds > 0;
    const detail = hasCountdown ? countdownMarkup(item) : 'Đang cập nhật thời gian…';
    return `<article class="crop-card tree-card salt-card is-growing" data-resource="salt" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}"><div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="Salt" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">Đang hồi</span><strong class="crop-card-title">Salt</strong><span class="crop-card-meta">${detail}</span></div></article>`;
  }
  const needsToolScan = !toolBagScanned;
  const lacksRake = toolBagScanned && (!rakeSource || !Number(toolCounts.get(rakeSource)));
  const toolUnavailable = lacksRake;
  const hits = Math.max(1, Number(item.hits) || 1);
  const unavailable = lacksRake || needsToolScan;
  
  const actionAttr = needsToolScan
    ? ' data-ui-action="scan-resource-tools"'
    : unavailable ? '' : ' data-ui-action="harvest-salt"';

  const hoverOverlay = needsToolScan
    ? `<div class="card-hover-overlay is-scan"><span class="overlay-icon">🔍</span><span class="overlay-label">Scan tools</span></div>`
    : unavailable
      ? '<div class="card-hover-overlay is-unavailable"><span class="overlay-label">No Salt Rake</span></div>'
      : `<div class="card-hover-overlay is-mine"><span class="overlay-icon">🪣</span><span class="overlay-label">Mine Salt x${hits}</span></div>`;
  const hint = needsToolScan
    ? `<span class="card-action-hint">Nhấn để Scan tools</span>`
    : unavailable ? '' : `<span class="card-action-hint">Nhấn để khai thác</span>`;

  return `<article class="crop-card tree-card salt-card is-ready${needsToolScan ? ' needs-tool-scan' : toolUnavailable ? ' is-tool-insufficient' : ''}"${actionAttr} data-resource="salt" data-salt-hits="${hits}" data-requested-salt-hits="${hits}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}">${hoverOverlay}<div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="Salt" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">READY</span><strong class="crop-card-title">Salt</strong>${hint}</div></article>`;
}

function mushroomCard(mushrooms) {
  const wild = mushrooms.wild || { count: 0, mapKeys: [] };
  const magic = mushrooms.magic || { count: 0, mapKeys: [] };
  const mapKeys = [...(wild.mapKeys || []), ...(magic.mapKeys || [])];
  const count = Number(wild.count || 0) + Number(magic.count || 0);
  const item = (type, label, amount) => `<span class="mushroom-count${amount ? '' : ' is-empty'}" title="${label}"><i class="mushroom-icon mushroom-icon-${type}" aria-hidden="true"></i><b>×${amount}</b></span>`;
  
  const actionAttr = count ? ' data-ui-action="harvest-mushrooms"' : ' data-ui-action="scan-map-header"';
  const state = count ? 'READY' : 'NOT FOUND';
  
  const hoverOverlay = count
    ? `<div class="card-hover-overlay"><span class="overlay-icon">🍄</span><span class="overlay-label">Harvest x${count}</span></div>`
    : `<div class="card-hover-overlay is-scan"><span class="overlay-icon">🔍</span><span class="overlay-label">Scan map</span></div>`;
  const hint = count ? `<span class="card-action-hint">Nhấn để thu hoạch</span>` : `<span class="card-action-hint">Nhấn để scan</span>`;

  return `<article class="crop-card mushroom-card is-ready${count ? '' : ' is-not-found is-insufficient'}"${actionAttr} data-resource="mushroom" data-map-keys="${escapeHtml(mapKeys.join('||'))}" data-count="${count}">${hoverOverlay}<div class="mushroom-summary"><div><span class="crop-card-state">${state}</span><strong class="crop-card-title">Mushroom</strong></div><div class="mushroom-counts">${item('wild', 'Wild Mushroom', wild.count || 0)}${item('magic', 'Magic Mushroom', magic.count || 0)}</div></div>${hint}</article>`;
}

function petCard(item, state = 'sleeping') {
  const sleeping = state === 'sleeping';
  const actionAttr = sleeping ? ' data-ui-action="wake-pet"' : '';
  const hoverOverlay = sleeping ? `<div class="card-hover-overlay"><span class="overlay-icon">✨</span><span class="overlay-label">Wake</span></div>` : '';
  const hint = sleeping ? `<span class="card-action-hint">Nhấn để Wake</span>` : '';
  return `<article class="crop-card tree-card pet-card is-growing"${actionAttr} data-resource="pet" data-pet-state="${sleeping ? 'sleeping' : 'awake'}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}">${hoverOverlay}<div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="${escapeHtml(item.label)}" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">${sleeping ? 'Đang ngủ' : 'Activity'}</span><strong class="crop-card-title">${escapeHtml(item.label)}</strong>${hint}</div></article>`;
}

function composterCard(item, type) {
  const growing = type === 'growing';
  const empty = type === 'empty';
  const ready = type === 'ready';
  const hasCountdown = growing && Number.isFinite(item.seconds) && item.seconds > 0;
  const needsComposterLoad = (growing && !hasCountdown) || (empty && typeof item.canCompost !== 'boolean');
  const insufficient = empty && item.canCompost === false;
  const state = ready ? 'READY' : needsComposterLoad ? 'UNKNOWN' : insufficient ? 'NO INPUT' : empty ? 'EMPTY' : 'COMPOSTING';
  const detail = growing
    ? (hasCountdown ? countdownMarkup(item) : 'Tap to check')
    : ready
      ? 'Tap to collect'
      : needsComposterLoad
        ? 'Tap to check'
        : insufficient
          ? ''
          : 'Tap to compost';
  const recipe = (item.requirements || item.recipe || []).map((entry) => {
    const amounts = String(entry.text || '').match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    const available = Number(amounts?.[1]?.replace(/,/g, ''));
    const needed = Number(amounts?.[2]?.replace(/,/g, ''));
    const missing = Number.isFinite(available) && Number.isFinite(needed) && available < needed;
    return `<span class="compost-tooltip-item${missing ? ' is-missing' : ''}">${entry.icon ? `<img src="${escapeHtml(entry.icon)}" alt="" />` : ''}<b>${escapeHtml(entry.text)}</b></span>`;
  }).join('');
  const canCompost = empty && item.canCompost === true;
  const actionAttr = ready ? ' data-ui-action="collect-composter"' : canCompost ? ' data-ui-action="compost"' : needsComposterLoad ? ' data-ui-action="scan-composter"' : '';
  const actionOverlay = ready
    ? `<div class="composter-collect-overlay"><span class="overlay-label">Collect x${Math.max(1, Number(item.count) || 1)}</span></div>`
    : canCompost
      ? '<div class="composter-action-overlay"><span class="overlay-label">Compost</span></div>'
      : needsComposterLoad
        ? '<div class="composter-load-overlay"><span class="overlay-label">Scan composter</span></div>'
        : '';
  const recipeOverlay = insufficient
    ? `<div class="composter-recipe-overlay"><b>Required materials</b><span>${recipe || '<i>No material data</i>'}</span></div>`
    : '';

  return `<article class="crop-card composter-card is-${type} ${ready ? 'is-ready' : ''}${needsComposterLoad ? ' needs-composter-load' : ''}${canCompost ? ' can-compost' : ''}${insufficient ? ' is-insufficient' : ''}"${actionAttr} data-resource="composter" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}">${actionOverlay}${recipeOverlay}<div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">${state}</span><strong class="crop-card-title">${escapeHtml(item.label)}</strong>${detail ? `<span class="crop-card-meta">${detail}</span>` : ''}</div></article>`;
}
