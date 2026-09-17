/* Fruit-specific card markup and seed selection card. */

function fruitCard(item, type, heldSeed) {
  const growing = type === 'growing';
  const empty = type === 'empty';
  const dead = type === 'dead';
  const ready = type === 'ready';
  const hasCountdown = growing && Number.isFinite(item.seconds) && item.seconds > 0;
  const state = empty ? 'EMPTY' : dead ? 'READY' : growing ? 'GROWING' : 'READY';
  const detail = empty ? '' : growing ? (hasCountdown ? countdownMarkup(item) : 'Đang cập nhật thời gian…') : dead ? `Axe ×${toolCounts.get(axeIcon) ?? '?'}` : 'Sẵn sàng thu hoạch';
  const fruitName = String(item.label || '').replace(/\s+tree$/i, '').trim();

  if (empty) {
    const seed = heldSeed;
    const seedIcon = seed?.icon || '';
    const seedCount = getSeedCount(seed);
    const canPlant = Boolean(seed && seedCount > 0);
    const plantCount = Math.min(Number(item.count || 0), seedCount);
    const hoverLabel = canPlant
      ? `<span class="overlay-icon">🌳</span><span class="overlay-label">Plant x${plantCount}</span>`
      : `<span class="overlay-icon">🌱</span><span class="overlay-label">Chọn hạt Fruit</span>`;
    const hint = canPlant ? `Nhấn để Plant x${plantCount}` : 'Nhấn để chọn hạt';
    return `<article class="crop-card fruit-card fruit-soil-card empty-crop-card is-empty is-ready${seedIcon ? ' has-selected-seed' : ''}" data-ui-action="${canPlant ? 'plant-fruit' : 'choose-fruit-seed'}" data-resource="fruit" data-crop-name="Đất Fruit trồng" data-fertiliser-type="${item.fertiliserType || 0}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}" data-action-label="Plant x${plantCount}">${item.fertilised ? `<img class="fertiliser-mark" src="${fertiliserIcon}" alt="Đã bón phân" />` : ''}<div class="card-hover-overlay is-plant">${hoverLabel}</div><div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">Đất trống</span><strong class="crop-card-title">Đất Fruit trống</strong><span class="card-action-hint">${hint}</span></div></article>`;
  }

  const actionAttr = ready ? ' data-ui-action="harvest-fruit"' : dead ? ' data-ui-action="chop-fruit"' : '';
  const overlayIcon = ready ? '🍎' : dead ? '🪓' : '';
  const overlayText = ready ? `Harvest x${item.count}` : dead ? 'Chop tree' : '';
  const hoverOverlay = (ready || dead)
    ? `<div class="card-hover-overlay${dead ? ' is-chop' : ''}"><span class="overlay-icon">${overlayIcon}</span><span class="overlay-label">${overlayText}</span></div>`
    : '';
  const hint = ready ? '<span class="card-action-hint">Nhấn để thu hoạch</span>'
    : dead ? '<span class="card-action-hint">Nhấn để Chop tree</span>' : '';

  return `<article class="crop-card fruit-card is-${type} ${ready || empty || dead ? 'is-ready' : ''}"${actionAttr} data-resource="fruit" data-fertilised="${Boolean(item.fertilised)}" data-crop-name="${escapeHtml(fruitName)}" data-fertiliser-type="${item.fertiliserType || 0}" data-time-group="${item.timeGroup ?? ''}" data-map-keys="${escapeHtml((item.mapKeys || []).join('||'))}" data-count="${item.count}">${hoverOverlay}${item.fertilised ? `<img class="fertiliser-mark" src="${fertiliserIcon}" alt="Đã bón phân" />` : ''}${item.fertiliserType === 2 ? '<img class="stopwatch-mark" src="https://sunflower-land.com/game-assets/icons/stopwatch.png" alt="Phân bón tăng tốc" />' : ''}<div class="crop-icon-box"><img class="crop-image" src="${escapeHtml(item.icon)}" alt="" /><b class="crop-quantity">×${item.count}</b></div><div class="crop-card-content"><span class="crop-card-state">${state}</span><strong class="crop-card-title">${escapeHtml(fruitName || 'Fruit')}</strong><span class="crop-card-meta">${detail}</span>${hint}</div></article>`;
}
