/* Countdown presentation and state promotion when a resource becomes ready. */

function countdownMarkup(item) {
  const seconds = Number(item?.seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const key = (item?.mapKeys || []).join('||');
  const previousTarget = Number(item.countdownTarget);
  const cachedTarget = key ? Number(countdownTargets.get(key)) : NaN;
  // Never restart an expired countdown from the stale `seconds` value. Render
  // the expired target so startCountdowns can request a fresh state scan.
  const target = Number.isFinite(previousTarget)
    ? previousTarget
    : Number.isFinite(cachedTarget)
      ? cachedTarget
      : Date.now() + seconds * 1000;
  item.countdownTarget = target;
  if (key) countdownTargets.set(key, target);
  return `<b data-countdown-target="${target}">${formatCountdown(Math.max(0, (target - Date.now()) / 1000))}</b>`;
}

function promoteGrowingTree(card) {
  const mapKeys = (card.dataset.mapKeys || '').split('||').filter(Boolean);
  if (mapKeys.length) countdownTargets.delete(mapKeys.join('||'));
  mapKeys.forEach((mapKey) => countdownTargets.delete(mapKey));
  card.dataset.treeRefreshPending = 'true';
  card.querySelector('.crop-card-meta').textContent = 'Đang cập nhật Tree…';
  card.querySelector('[data-countdown-target]')?.remove();
}

function promoteGrowingComposter(card) {
  const mapKeys = (card.dataset.mapKeys || '').split('||').filter(Boolean);
  mapKeys.forEach((mapKey) => countdownTargets.delete(mapKey));
  moveReadyCompostersFromGrowing(mapKeys);
  card.querySelector('[data-countdown-target]')?.remove();
  card.classList.remove('is-growing');
  card.classList.add('is-ready');
  card.querySelector('.crop-card-state').textContent = 'READY';
  const meta = card.querySelector('.crop-card-meta');
  if (meta) meta.textContent = 'Tap to collect';
  const collect = document.createElement('button');
  collect.type = 'button';
  collect.className = 'composter-collect-overlay';
  collect.dataset.uiAction = 'collect-composter';
  collect.textContent = 'Collect';
  card.append(collect);
}

function promoteGrowingCrop(card) {
  const mapKeys = (card.dataset.mapKeys || '').split('||').filter(Boolean);
  if (!mapKeys.length || !lastScanData?.growing) return false;
  const movedKeys = new Set(mapKeys);
  let promoted = null;
  lastScanData.growing = lastScanData.growing.flatMap((item) => {
    const itemKeys = item.mapKeys || [];
    const keysToMove = itemKeys.filter((key) => movedKeys.has(key));
    if (!keysToMove.length) return [item];
    promoted ||= { ...item, count: 0, mapKeys: [] };
    promoted.count += keysToMove.length;
    promoted.mapKeys.push(...keysToMove);
    const remainingKeys = itemKeys.filter((key) => !movedKeys.has(key));
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  if (!promoted?.count) return false;
  const readyIcon = String(promoted.icon || '').replace(/\/(seedling|halfway|almost)\.png(?:[?#].*)?$/i, '/plant.png');
  const readyItems = lastScanData.ready || (lastScanData.ready = []);
  const existing = readyItems.find((item) => item.label === promoted.label && Number(item.fertiliserType || 0) === Number(promoted.fertiliserType || 0) && Boolean(item.bee) === Boolean(promoted.bee));
  if (existing) {
    existing.count = Number(existing.count || 0) + promoted.count;
    existing.mapKeys = Array.from(new Set([...(existing.mapKeys || []), ...promoted.mapKeys]));
    existing.icon = readyIcon || existing.icon;
  } else readyItems.push({ ...promoted, icon: readyIcon || promoted.icon, seconds: null, countdownTarget: null });
  countdownTargets.delete(mapKeys.join('||'));
  renderOverview();
  startCountdowns();
  if (typeof autoCropEnabled === 'function' && autoCropEnabled() && typeof scheduleAutoCrop === 'function') scheduleAutoCrop();
  return true;
}

function startCountdowns() {
  window.clearInterval(countdownTimer);
  if (window.licenseManager?.isInteractionLocked?.()) return;
  syncReadyNotifications();
  const update = () => {
    document.querySelectorAll('[data-countdown-target]').forEach((element) => {
      const seconds = (Number(element.dataset.countdownTarget) - Date.now()) / 1000;
      if (seconds > 0) { element.textContent = formatCountdown(seconds); return; }
      const card = element.closest('.crop-card');
      if (!card || card.classList.contains('is-ready')) return;
      notifyReadyNow(card, Number(element.dataset.countdownTarget));
      if (card.dataset.resource === 'composter') promoteGrowingComposter(card);
      else if (card.dataset.resource === 'tree') { promoteGrowingTree(card); if (!window.autoTreeAutomationRunning) scheduleTreeRefresh(); log('Tree đã sẵn sàng chặt, đang cập nhật…'); }
      else if (card.dataset.resource === 'mining') {
        card.querySelector('.crop-card-meta').textContent = 'Đang cập nhật mỏ…';
        element.remove();
        window.clearTimeout(miningRefreshTimer);
        miningRefreshTimer = window.setTimeout(() => void scanMap('mining'), 1500);
        log(`${card.querySelector('.crop-card-title').textContent} đã sẵn sàng khai thác, đang cập nhật…`);
      }
      else if (card.dataset.resource === 'fruit') {
        card.querySelector('.crop-card-meta').textContent = 'Đang cập nhật Fruit…';
        element.remove();
        window.clearTimeout(fruitRefreshTimer);
        fruitRefreshTimer = window.setTimeout(() => void scanMap('fruit', { forceTimerRefresh: true }), 1500);
        log(`${card.querySelector('.crop-card-title').textContent} đã sẵn sàng thu hoạch, đang cập nhật…`);
      }
      else if (card.dataset.resource === 'pet') { element.remove(); void checkAwakePets(); }
      else if (card.dataset.resource === 'salt') {
        card.querySelector('.crop-card-meta').textContent = 'Đang cập nhật Salt…';
        element.remove();
        window.setTimeout(() => void scanMap('salt'), 1500);
      }
      else if (!promoteGrowingCrop(card)) { card.querySelector('.crop-card-meta').textContent = '?ang c?p nh?t Crop?'; element.remove(); if (typeof autoCropEnabled === 'function' && autoCropEnabled() && typeof scheduleAutoCrop === 'function') scheduleAutoCrop(); }
    });
  };
  update();
  countdownTimer = window.setInterval(update, 1000);
}
