/* Pet sleep-state scheduling and local state transitions. */

function markPetsAwake(mapKeys = [], pets = []) {
  if (!lastScanData?.pets || !mapKeys.length) return;
  const awakened = new Set(mapKeys);
  const detailsByKey = new Map(pets.map((pet) => [pet.mapKey, pet]));
  const active = [];
  lastScanData.pets.sleeping = (lastScanData.pets.sleeping || []).flatMap((item) => {
    const awakenedKeys = (item.mapKeys || []).filter((key) => awakened.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !awakened.has(key));
    if (awakenedKeys.length) {
      const details = detailsByKey.get(awakenedKeys[0]) || {};
      active.push({ ...item, label: details.label || item.label, icon: details.icon || item.icon, count: awakenedKeys.length, mapKeys: awakenedKeys, petCheckCount: 0, nextPetCheckAt: Date.now() + 30 * 60 * 1000 });
    }
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  lastScanData.pets.awake = [...(lastScanData.pets.awake || []), ...active];
  renderOverview();
  startCountdowns();
}

async function checkAwakePets() {
  if (petSleepCheckInProgress || !(lastScanData?.pets?.awake || []).length) return;
  petSleepCheckInProgress = true;
  try {
    if (!await scanMap('pet')) scheduleNextPetCheck();
  } catch (error) {
    logActionError(error.message || 'Không thể quét trạng thái Pet.');
    scheduleNextPetCheck();
  } finally { petSleepCheckInProgress = false; }
}

function scheduleNextPetCheck() {
  if (!lastScanData?.pets?.awake?.length) return;
  const target = Date.now() + 15 * 60 * 1000;
  lastScanData.pets.awake.forEach((item) => { item.nextPetCheckAt = target; });
  renderOverview();
  startCountdowns();
}

function schedulePetSleepCheck() {
  window.clearTimeout(petSleepTimer);
  const awakePets = lastScanData?.pets?.awake || [];
  awakePets.forEach((item) => {
    if (!Number.isFinite(Number(item.nextPetCheckAt))) item.nextPetCheckAt = Date.now() + 30 * 60 * 1000;
  });
  const checks = awakePets.map((item) => Number(item.nextPetCheckAt)).filter((value) => Number.isFinite(value));
  if (!checks.length) return;
  petSleepTimer = window.setTimeout(() => void checkAwakePets(), Math.max(250, Math.min(Math.min(...checks) - Date.now(), 2147483647)));
}
