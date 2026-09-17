/* Crop card markup. This module owns crop-specific visual states and actions. */

function cropCard(item, type) {
  const isGrowing = type === 'growing';
  const isEmpty = type === 'empty';
  const isTornado = type === 'tornado';
  const isFrozen = type === 'frozen';
  const isBlocked = isTornado || isFrozen;
  const isReady = type === 'ready';
  const tier = isGrowing ? cropTiers.get(String(item.label || '').toLowerCase()) : '';
  const stateLabel = isFrozen ? 'FROZEN' : isTornado ? 'BLOCKED' : isEmpty ? 'EMPTY' : isGrowing ? 'GROWING' : 'READY';
  const hasCountdown = Number.isFinite(item.seconds) && item.seconds > 0;
  const detail = isBlocked ? '' : isGrowing ? hasCountdown ? `<span class="crop-card-meta">${countdownMarkup(item)}</span>` : '<span class="crop-card-meta">Đang cập nhật thời gian…</span>' : '';

  if (isEmpty) {
    const seedIcon = cropSeedDisplayIcon(selectedPlantSeed);
    const seedCount = getSeedCount(selectedPlantSeed);
    const canPlant = Boolean(selectedPlantSeed && seedCount > 0);
    const plantCount = Math.min(Number(item.count || 0), seedCount);
    const hoverLabel = canPlant
      ? `<span class="overlay-icon">🌱</span><span class="overlay-label">Plant x${plantCount}</span>`
      : `<span class="overlay-icon">🌾</span><span class="overlay-label">Choose seed</span>`;
    const hint = canPlant ? `Nhấn để Plant x${plantCount}` : 'Nhấn để chọn hạt';
    return `<article class="crop-card is-empty empty-crop-card${seedIcon ? ' has-selected-seed' : ''}" data-ui-action="${canPlant ? 'plant' : 'choose-crop-seed'}" data-resource="crop" data-fertilised="${Boolean(item.fertilised)}" data-crop-name="${escapeHtml(item.label)}" data-fertiliser-type="${item.fertiliserType || 0}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}" data-selected-seed="${escapeHtml(selectedPlantSeed?.name || '')}" data-target-fertiliser-type="${item.fertiliserType || 0}" data-action-label="Plant x${plantCount}"><div class="card-hover-overlay is-plant">${hoverLabel}</div><div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">Đất trống</span><strong class="crop-card-title">${escapeHtml(item.label)}</strong><span class="card-action-hint">${hint}</span></div></article>`;
  }

  const actionAttr = isReady && !isBlocked ? ' data-ui-action="harvest"' : '';
  const hoverOverlay = isReady && !isBlocked
    ? `<div class="card-hover-overlay"><span class="overlay-icon">🌾</span><span class="overlay-label">Harvest x${item.count}</span></div>`
    : '';
  const hint = isReady && !isBlocked ? `<span class="card-action-hint">Nhấn để thu hoạch</span>` : '';
  const blockedIcon = isFrozen ? item.frozenIcon : isTornado ? item.tornadoIcon : '';
  const blockedIconAlt = isFrozen ? 'Great Freeze' : 'Tornado';

  return `<article class="crop-card is-${type}${isReady ? ' is-ready' : ''}${isBlocked ? ' is-blocked' : ''}"${actionAttr} data-resource="crop" data-fertilised="${Boolean(item.fertilised)}" data-crop-name="${escapeHtml(item.label)}" data-fertiliser-type="${item.fertiliserType || 0}" data-time-group="${item.timeGroup ?? ''}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-has-precise-seconds="${Boolean(item.hasPreciseSeconds)}" data-count="${item.count}">${hoverOverlay}${tier ? `<b class="crop-tier">${tier}</b>` : ''}${item.fertilised ? `<img class="fertiliser-mark" src="${fertiliserIcon}" alt="Đã bón phân" />` : ''}${item.bee ? `<img class="bee-mark ${item.fertiliserType === 1 ? 'with-fertiliser' : ''}" src="${beeIcon}" alt="Bee" />` : ''}${item.fertiliserType === 2 ? '<img class="stopwatch-mark" src="https://sunflower-land.com/game-assets/icons/stopwatch.png" alt="Phân bón tăng tốc" />' : ''}${blockedIcon ? `<img class="blocked-crop-mark" src="${escapeHtml(blockedIcon)}" alt="${blockedIconAlt}" />` : ''}<div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">${stateLabel}</span><strong class="crop-card-title">${escapeHtml(item.label)}</strong>${detail}${hint}</div></article>`;
}

function cropSeedDisplayName(seed) {
  return String(seed?.name || 'Chưa chọn hạt').replace(/brocolli/gi, 'Broccoli');
}

function cropSeedDisplayIcon(seed) {
  const name = String(seed?.name || '').toLowerCase();
  // The game displays "Broccoli", while its asset/DOM slug is intentionally "brocolli".
  if (name.includes('broccoli') || name.includes('brocolli')) {
    return 'https://sunflower-land.com/game-assets/crops/brocolli/seed.png';
  }
  return seed?.icon || '';
}
