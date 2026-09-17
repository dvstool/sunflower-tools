/* Merge a scoped map scan into the cached overview state. */

function timedScanEntries(value, path = []) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => Array.isArray(item?.mapKeys) ? [{ state: path.join('.'), item }] : []);
  }
  return Object.entries(value).flatMap(([key, child]) => timedScanEntries(child, [...path, key]));
}

// The map often reports coarse values such as "1h 2m" while the panel is
// accurately counting down "1h 2m 37s". Keep that existing countdown unless
// the scan represents a genuine change, rather than rounding it back to :00.
function preserveScanCountdowns(nextData, previousData = lastScanData) {
  if (!nextData || !previousData) return;
  const now = Date.now();
  const previousByStateAndKey = new Map();
  const previousByMapKey = new Map();
  timedScanEntries(previousData).forEach(({ state, item }) => {
    (item.mapKeys || []).forEach((mapKey) => {
      previousByStateAndKey.set(`${state}|${mapKey}`, item);
      previousByMapKey.set(mapKey, { state, item });
    });
  });
  timedScanEntries(nextData).forEach(({ state, item }) => {
    const scannedSeconds = Number(item.seconds);
    const itemKey = (item.mapKeys || []).join('||');
    const previousInAnotherState = (item.mapKeys || []).map((mapKey) => previousByMapKey.get(mapKey)).find((entry) => entry && entry.state !== state);
    const previous = (item.mapKeys || []).map((mapKey) => previousByStateAndKey.get(`${state}|${mapKey}`)).find(Boolean);
    if (!Number.isFinite(scannedSeconds) || scannedSeconds <= 0) {
      // Fruit (and other map resources) can be painted before its tooltip timer.
      // A partial re-scan must not replace a live countdown with an unknown value.
      const previousKey = (previous?.mapKeys || []).join('||');
      const target = Number(previous?.countdownTarget) || Number(countdownTargets.get(previousKey));
      if (!previousInAnotherState && Number.isFinite(target) && target > now) {
        item.seconds = Math.max(1, (target - now) / 1000);
        item.countdownTarget = target;
      }
      return;
    }
    if (previousInAnotherState) {
      const previousKey = (previousInAnotherState.item.mapKeys || []).join('||');
      if (previousKey) countdownTargets.delete(previousKey);
      if (itemKey) countdownTargets.delete(itemKey);
      item.countdownTarget = now + scannedSeconds * 1000;
      return;
    }
    if (!previous) return;
    const stateChanged = ['label', 'resource', 'stage', 'fertiliserType'].some((field) => previous[field] != null || item[field] != null
      ? String(previous[field] ?? '') !== String(item[field] ?? '')
      : false);
    if (stateChanged) return;
    const previousKey = (previous.mapKeys || []).join('||');
    const target = Number(previous.countdownTarget) || Number(countdownTargets.get(previousKey));
    if (!Number.isFinite(target)) return;
    if (target <= now) {
      // The old card reached zero. Its next scan is authoritative and must not
      // render the old duration again while the game updates the resource.
      if (previousKey) countdownTargets.delete(previousKey);
      if (itemKey) countdownTargets.delete(itemKey);
      item.countdownTarget = now + scannedSeconds * 1000;
      return;
    }
    const remainingSeconds = (target - now) / 1000;
    // Preserve only the seconds the game did not show. For a coarse timer such
    // as "11h 20m", the existing target is valid only while it still belongs
    // to that same displayed minute (plus a short scan/render delay). If the
    // game now says "11h 5m", an old target in "11h 6m" is replaced at once.
    if (item.hasPreciseSeconds) {
      if (Math.abs(scannedSeconds - remainingSeconds) < 2) {
        item.countdownTarget = target;
      } else if (itemKey) {
        // A precise DOM timer disagrees with the old card: it is a new truth.
        countdownTargets.delete(itemKey);
      }
      return;
    }
    // A whole-minute DOM timer represents a range. Keep a card already within
    // that minute (8h34m 16s for DOM 8h34m); otherwise clamp it to the end of
    // the minute (8h35m 00s), never retaining a stale value such as 8h35m 29s.
    const isWithinDisplayedMinute = remainingSeconds >= scannedSeconds - 60
      && remainingSeconds < scannedSeconds;
    if (isWithinDisplayedMinute) {
      item.countdownTarget = target;
      return;
    }
    if (itemKey) countdownTargets.delete(itemKey);
    item.countdownTarget = now + scannedSeconds * 1000;
  });
}

function mergeProfessionScan(scope, result, options = {}) {
  const professionData = {
    crop: { empty: result.empty, tornado: result.tornado, frozen: result.frozen, growing: result.growing, ready: result.ready },
    fruit: { fruit: result.fruit },
    tree: { trees: result.trees },
    mining: { mining: result.mining },
    salt: { salt: result.salt },
    mushroom: { mushrooms: result.mushrooms },
    pet: { pets: result.pets }
  }[scope];
  if (!professionData) return false;
  if (scope === 'pet') {
    const scannedAwake = result.pets?.awake || [];
    const previousByKey = new Map((lastScanData?.pets?.awake || []).flatMap((item) => (item.mapKeys || []).map((mapKey) => [mapKey, item])));
    professionData.pets.awake = scannedAwake.map((item) => {
      const previous = previousByKey.get((item.mapKeys || [])[0]);
      const checks = petSleepCheckInProgress ? Number(previous?.petCheckCount || 0) + 1 : Number(previous?.petCheckCount || 0);
      const delay = checks >= 3 ? 15 : 30;
      return { ...item, petCheckCount: checks, nextPetCheckAt: petSleepCheckInProgress ? Date.now() + delay * 60 * 1000 : previous?.nextPetCheckAt || Date.now() + 30 * 60 * 1000 };
    });
  }
  if (!options.skipCountdownPreservation) preserveScanCountdowns(professionData);
  lastScanData = { ...(lastScanData || {}), ...professionData };
  renderOverview();
  startCountdowns();
  return true;
}
