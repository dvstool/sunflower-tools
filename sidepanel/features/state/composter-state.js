/* Composter state transitions after Collect and Compost actions. */


function composterIconForState(icon, state) {
  const source = String(icon || '');
  const suffix = /(\.(?:webp|png)(?:[?#].*)?)$/i;
  if (state === 'growing') return source.replace(/_ready(?=\.(?:webp|png)(?:[?#]|$))/i, '_closed');
  if (state === 'ready') return source.replace(/_closed(?=\.(?:webp|png)(?:[?#]|$))/i, '_ready');
  if (state === 'empty') return source.replace(/_(?:ready|closed)(?=\.(?:webp|png)(?:[?#]|$))/i, '');
  return source;
}

function moveCollectedCompostersToEmpty(mapKeys = []) {
  if (!lastScanData?.composters || !mapKeys.length) return;
  const collected = new Set(mapKeys);
  mapKeys.forEach((mapKey) => countdownTargets.delete(mapKey));
  const moved = [];
  lastScanData.composters.ready = (lastScanData.composters.ready || []).flatMap((item) => {
    const movedKeys = (item.mapKeys || []).filter((key) => collected.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !collected.has(key));
    movedKeys.forEach((key) => moved.push({ ...item, icon: composterIconForState(item.icon, 'empty'), count: 1, mapKeys: [key], seconds: null, recipe: [], requirements: [] }));
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  lastScanData.composters.empty = [...(lastScanData.composters.empty || []), ...moved];
}

function moveStartedCompostersToGrowing(mapKeys = [], details = []) {
  if (!lastScanData?.composters || !mapKeys.length) return;
  const started = new Set(mapKeys);
  // A new Compost cycle must never inherit the completed cycle's target.
  mapKeys.forEach((mapKey) => countdownTargets.delete(mapKey));
  const secondsByKey = new Map(details.map((detail) => [detail.mapKey, Number(detail.seconds)]));
  const movedByKey = new Map();
  ['ready', 'empty', 'growing'].forEach((state) => {
    lastScanData.composters[state] = (lastScanData.composters[state] || []).flatMap((item) => {
      const movedKeys = (item.mapKeys || []).filter((key) => started.has(key));
      const remainingKeys = (item.mapKeys || []).filter((key) => !started.has(key));
      movedKeys.forEach((key) => {
        if (movedByKey.has(key)) return;
        const seconds = secondsByKey.get(key);
        movedByKey.set(key, { ...item, icon: composterIconForState(item.icon, 'growing'), count: 1, mapKeys: [key], seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : item.seconds || null, recipe: [], requirements: [] });
        const previous = composterDetails.get(key) || {};
        composterDetails.set(key, { ...previous, seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : previous.seconds || null, state: 'growing', transitionUntil: Date.now() + 5000, updatedAt: Date.now() });
      });
      return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
    });
  });
  lastScanData.composters.growing = [...(lastScanData.composters.growing || []), ...movedByKey.values()];
}

function moveReadyCompostersFromGrowing(mapKeys = []) {
  if (!lastScanData?.composters || !mapKeys.length) return;
  const readyKeys = new Set(mapKeys);
  mapKeys.forEach((mapKey) => countdownTargets.delete(mapKey));
  const moved = [];
  lastScanData.composters.growing = (lastScanData.composters.growing || []).flatMap((item) => {
    const movedKeys = (item.mapKeys || []).filter((key) => readyKeys.has(key));
    const remainingKeys = (item.mapKeys || []).filter((key) => !readyKeys.has(key));
    movedKeys.forEach((key) => {
      composterDetails.delete(key);
      moved.push({ ...item, icon: composterIconForState(item.icon, 'ready'), count: 1, mapKeys: [key], seconds: null, countdownTarget: null, recipe: [], requirements: [] });
    });
    return remainingKeys.length ? [{ ...item, count: remainingKeys.length, mapKeys: remainingKeys }] : [];
  });
  lastScanData.composters.ready = [...(lastScanData.composters.ready || []), ...moved];
}
