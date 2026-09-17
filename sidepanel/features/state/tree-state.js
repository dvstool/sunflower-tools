/* Tree refresh and DOM state reconciliation after chopping. */

function scheduleTreeRefresh() {
  window.clearTimeout(treeRefreshTimer);
  treeRefreshTimer = window.setTimeout(() => scanMap('tree'), 1500);
}

// A newly-felled tree can render its stump a few frames before its timer.
// Keep that tree in scan state and retry once per second until every growing
// tree has an authoritative remaining-time value.
function scheduleUnknownTreeTimeRefresh(treeData = lastScanData?.trees) {
  window.clearTimeout(treeUnknownTimeRefreshTimer);
  const hasUnknownTimer = (treeData?.growing || []).some((item) => !Number.isFinite(Number(item?.seconds)) || Number(item.seconds) <= 0);
  if (!hasUnknownTimer) return;
  treeUnknownTimeRefreshTimer = window.setTimeout(() => {
    treeUnknownTimeRefreshTimer = undefined;
    void scanMap('tree');
  }, 1000);
}

async function readTreeStates(mapKeys = []) {
  if (!mapKeys.length) return [];
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (keys) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const parseSeconds = (text) => Array.from(String(text || '').matchAll(/(\d+)\s*(days?|d|hrs?|h|mins?|m|secs?|s)\b/gi)).reduce((total, match) => total + Number(match[1]) * (/^d/.test(match[2]) ? 86400 : /^h/.test(match[2]) ? 3600 : /^m/.test(match[2]) ? 60 : 1), 0) || null;
      const readGrowingState = (mapKey) => {
        const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === mapKey);
        const images = Array.from(placement?.querySelectorAll('img') || []);
        const source = (image) => image.currentSrc || image.src || '';
        const stump = images.find((image) => /\/game-assets\/resources\/(?:stump|tree)\.png/i.test(source(image)) || image.classList.contains('opacity-50'));
        const timer = Array.from(placement?.querySelectorAll('div.transition-opacity span.font-secondary, span.text-white.text-center.font-pixel, span.font-pixel') || []).map((node) => node.textContent.trim()).find((text) => /\d+\s*(?:d|day|h|hr|m|min|s|sec)/i.test(text));
        const seconds = parseSeconds(timer || placement?.innerText || '');
        if (!stump && !Number.isFinite(seconds)) return null;
        return { mapKey, state: 'growing', icon: source(stump || images[0] || {}), seconds };
      };
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const states = keys.map(readGrowingState).filter(Boolean);
        if (states.length === keys.length) return states;
        await sleep(120);
      }
      return keys.map(readGrowingState).filter(Boolean);
    },
    args: [mapKeys]
  });
  return Array.isArray(result) ? result : [];
}

function applyTreeStates(states = []) {
  if (!lastScanData?.trees || !states.length) return;
  states = states.filter((state) => state?.mapKey && state.state === 'growing');
  if (!states.length) return;
  const changed = new Set(states.map((state) => state.mapKey));
  const originalByKey = new Map();
  ['ready', 'growing'].forEach((state) => (lastScanData.trees[state] || []).forEach((item) => (item.mapKeys || []).forEach((mapKey) => originalByKey.set(mapKey, item))));
  changed.forEach((mapKey) => {
    const originalKeys = originalByKey.get(mapKey)?.mapKeys || [];
    if (originalKeys.length) countdownTargets.delete(originalKeys.join('||'));
    countdownTargets.delete(mapKey);
  });
  ['ready', 'growing'].forEach((state) => {
    lastScanData.trees[state] = (lastScanData.trees[state] || []).flatMap((item) => {
      const mapKeys = (item.mapKeys || []).filter((mapKey) => !changed.has(mapKey));
      return mapKeys.length ? [{ ...item, count: mapKeys.length, mapKeys }] : [];
    });
  });
  states.forEach((state) => {
    const original = originalByKey.get(state.mapKey) || {};
    const target = lastScanData.trees[state.state] || (lastScanData.trees[state.state] = []);
    const group = target.find((item) => item.icon === (state.icon || original.icon) && Number(item.seconds) === Number(state.seconds));
    if (group) { group.count += 1; group.mapKeys.push(state.mapKey); }
    else target.push({ ...original, icon: state.icon || original.icon, count: 1, mapKeys: [state.mapKey], seconds: state.state === 'growing' ? state.seconds : null, countdownTarget: null });
  });
}
