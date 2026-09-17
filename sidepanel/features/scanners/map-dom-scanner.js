/* Map DOM scan implementation and scan-button interaction. */

function renderMapScanWaiting() {
  lastScanData = null;
  overviewResults.innerHTML = `<div class="map-scan-waiting" role="status"><span class="map-scan-waiting-icon">⟳</span><strong>Scanning map...</strong><small>Đang chờ Sunflower Land tải vào đảo.</small></div>`;
  cropResults.innerHTML = '';
  cropGrowingResults.innerHTML = '';
  treeResults.innerHTML = '';
  treeGrowingResults.innerHTML = '';
  miningResults.innerHTML = '';
  miningGrowingResults.innerHTML = '';
  blockedResults.innerHTML = '';
  activateMapActivityTab('overview', { history: false, syncGame: false });
}

function scheduleMapScanRetry() {
  window.clearTimeout(mapScanWaitingTimer);
  mapScanWaitingTimer = window.setTimeout(() => {
    mapScanWaitingTimer = undefined;
    void scanMap();
  }, 1000);
}

function countScannedMapObjects(data) {
  const mapKeys = new Set();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (Array.isArray(value.mapKeys)) value.mapKeys.forEach((key) => mapKeys.add(key));
    Object.entries(value).forEach(([key, child]) => { if (key !== 'mapKeys') visit(child); });
  };
  visit(data);
  return mapKeys.size;
}

function isLikelyIncompleteMapScan(result) {
  const previousCount = countScannedMapObjects(lastScanData);
  const scannedCount = countScannedMapObjects(result);
  const placementCount = Number(result?.placementCount || 0);
  return previousCount >= 12
    && placementCount >= 12
    && scannedCount <= Math.max(2, Math.floor(previousCount * 0.2));
}

function scheduleMapIntegrityRetry() {
  window.clearTimeout(mapIntegrityRetryTimer);
  mapIntegrityRetryTimer = window.setTimeout(() => {
    mapIntegrityRetryTimer = undefined;
    void scanMap('all');
  }, 1000);
}

async function scanMapNow(scope = 'all', options = {}) {
  scanMapButton.disabled = true;
  scanMapButton.classList.add('is-scanning');
  let scanned = false;
  try {
    const [{ result }] = await executeOnSunflowerTabs({
      func: () => {
        const mapPlacements = Array.from(document.querySelectorAll('div[data-map-placement]')).filter(el => el.getAttribute('data-map-placement') !== 'false');
        if (!mapPlacements.length) return { mapReady: false };
        const isHomeIsland = Array.from(document.querySelectorAll('img')).some((img) => { const s = (img.currentSrc || img.src || '').toLowerCase(); const a = (img.alt || '').toLowerCase(); return s.includes('hammer') || s.includes('build') || a.includes('hammer') || a.includes('build') || s.includes('/game-assets/tools/'); });
        if (!isHomeIsland) return { mapReady: false, offIsland: true };
        const cropPattern = /\/game-assets\/crops\/([^/]+)\/(seedling|halfway|almost|plant)\.png/i;
        const soilIcon = 'https://sunflower-land.com/game-assets/crops/soil2.png';
        const parseSeconds = (text) => {
          const normalised = String(text || '').replace(/\b(\d+)\s*hsr\b/gi, '$1hrs');
          const match = normalised.match(/\b(?=\d+\s*(?:d(?:ays?)?|h(?:r(?:s)?|ours?)?|m(?:in(?:s)?)?|s(?:ec(?:s)?)?))(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:r(?:s)?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s)?)?)?\s*(?:(\d+)\s*s(?:ec(?:s)?)?)?/i);
          if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) return { seconds: null, hasSeconds: false };
          return {
            seconds: (Number(match[1] || 0) * 86400) + (Number(match[2] || 0) * 3600) + (Number(match[3] || 0) * 60) + Number(match[4] || 0),
            hasSeconds: Boolean(match[4])
          };
        };
        const readPlacementTime = (placement) => {
          const tooltipTime = Array.from(placement.querySelectorAll('div.transition-opacity span.font-secondary')).map((element) => element.textContent.trim()).find((text) => /^\d+\s*(?:day|d|hr|h|min|m|sec|s)/i.test(text));
          const timerText = Array.from(placement.querySelectorAll('span.text-white.text-center.font-pixel, span.font-pixel')).map((element) => element.textContent.trim()).find((text) => /^\d+\s*(?:d|h|m|s)/i.test(text));
          return parseSeconds(tooltipTime || timerText || placement.innerText || placement.textContent || '');
        };
        // A shared card has one countdown target. Only group timers that are
        // indistinguishable in the DOM: within one second when precise, or
        // exactly the same displayed minute when the game omits seconds.
        const canGroupTimerEntries = (candidate, entry) => {
          if (!Number.isFinite(candidate.seconds) || !Number.isFinite(entry.seconds)) return false;
          if (Boolean(candidate.hasPreciseSeconds) !== Boolean(entry.hasPreciseSeconds)) return false;
          return candidate.hasPreciseSeconds
            ? Math.abs(candidate.seconds - entry.seconds) <= 1
            : candidate.seconds === entry.seconds;
        };
        const titleCase = (value) => value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
        const growingEntries = [];
        const treeGrowingEntries = [];
        const fruitGrowingEntries = [];
        const miningGrowingEntries = [];
        const ready = new Map();
        const treeReady = new Map();
        const miningReady = new Map();
        const empty = new Map();
        const fruitEmpty = new Map();
        const fruitReady = new Map();
        const fruitDead = new Map();
        const composterReady = new Map();
        const composterEmpty = new Map();
        const composterGrowing = new Map();
        const saltReady = [];
        const saltGrowing = [];
        let dailyShipment = null;
        const mushrooms = {
          wild: { count: 0, mapKeys: [] },
          magic: { count: 0, mapKeys: [] }
        };
        const sleepingPets = new Map();
        const awakePets = new Map();
        const knownActivePetNames = new Set(['butters', 'flicker']);
        let bettyLand = '';
        let tornadoCount = 0;
        let tornadoIcon = '';
        const tornadoMapKeys = [];
        let frozenCount = 0;
        let frozenIcon = '';
        const frozenMapKeys = [];
        mapPlacements.forEach((placement) => {
          // Preserve the scan-time key. Desert can reformat inline coordinates
          // after React updates, while panel cards retain the original key.
          placement.dataset.sunflowerToolsMapKey = `${placement.style.top}|${placement.style.left}`;
          const images = Array.from(placement.querySelectorAll('img'));
          const sources = images.map((image) => image.currentSrc || image.src || '');
          const bettySource = sources.find((source) => /\/game-assets\/(?:[^/]+\/)*buildings\/(?:[^/]+\/)*(?:bettys_)?market\.(?:webp|png)(?:[?#]|$)/i.test(source));
          if (bettySource) bettyLand ||= bettySource.match(/\/game-assets\/([^/]+)\/buildings\//i)?.[1] || '';
          const treeImage = images.find((image) => /\/game-assets\/resources\/tree\/[^/]+\/[^/]+_([^/]+)_tree\.webp/i.test(image.currentSrc || image.src || ''));
          const treeMatch = treeImage && (treeImage.currentSrc || treeImage.src || '').match(/\/game-assets\/resources\/tree\/([^/]+)\/([^/_]+)_([^/_]+)_tree\.webp/i);
          const miningImage = images.find((image) => /\/game-assets\/resources\/(stone|iron|gold)_small\.png/i.test(image.currentSrc || image.src || ''));
          const miningMatch = miningImage && (miningImage.currentSrc || miningImage.src || '').match(/\/game-assets\/resources\/(stone|iron|gold)_small\.png/i);
          const cropImage = images.find((image) => cropPattern.test(image.currentSrc || image.src || ''));
          const cropMatch = cropImage && (cropImage.currentSrc || cropImage.src).match(cropPattern);
          const sleepingIcon = images.find((image) => image.alt?.trim().toLowerCase() === 'sleeping' && /\/game-assets\/icons\/sleeping\.webp/i.test(image.currentSrc || image.src || ''));
          if (sleepingIcon) {
            const petImage = images.find((image) => image !== sleepingIcon && image.alt?.trim() && image.alt.trim().toLowerCase() !== 'sleeping') || images.find((image) => image !== sleepingIcon && image.classList.contains('cursor-pointer'));
            const label = petImage?.alt?.trim() || 'Pet';
            const icon = petImage?.currentSrc || petImage?.src || sleepingIcon.currentSrc || sleepingIcon.src;
            const key = `${label}|${icon}`;
            const current = sleepingPets.get(key) || { label, icon, count: 0, mapKeys: [] };
            current.count += 1;
            current.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
            sleepingPets.set(key, current);
            return;
          }
          // Active pets use an inlined sprite, an alt name, and the clickable
          // highlight classes shown on the map. Their asset has no stable URL.
          const activePet = images.find((image) => {
            const source = image.currentSrc || image.src || '';
            return source.startsWith('data:image/') && knownActivePetNames.has(image.alt?.trim().toLowerCase()) && image.classList.contains('cursor-pointer') && image.classList.contains('hover:img-highlight');
          });
          if (activePet) {
            const label = activePet.alt.trim();
            const icon = activePet.currentSrc || activePet.src;
            const key = `${label}|${icon}`;
            const current = awakePets.get(key) || { label, icon, count: 0, mapKeys: [] };
            current.count += 1;
            current.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
            awakePets.set(key, current);
            return;
          }
          // Daily Shipment uses the same embedded icon across the three land types.
          const dailyShipmentPrefix = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAsCAYAAADctB6FAAAAAXNSR0IArs4c6QAACcBJREFUaIHdmn9QlHUex1+r';
          const dailyShipmentImage = images.find((image) => (image.currentSrc || image.src || '').startsWith(dailyShipmentPrefix));
          if (dailyShipmentImage) {
            const source = dailyShipmentImage.currentSrc || dailyShipmentImage.src;
            dailyShipment ||= { icon: source, count: 0, mapKeys: [] };
            dailyShipment.count += 1;
            dailyShipment.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
            return;
          }
          const saltStates = [
            ['data:image/webp;base64,UklGRpQAAABXRUJQVlA4TIgAAAAvEQAEED9AJADhlqNuqZruhBtE', 1],
            ['data:image/webp;base64,UklGRqgAAABXRUJQVlA4TJsAAAAvEQAEEEdgJgAZtaQVyevzK7Bz', 2],
            ['data:image/webp;base64,UklGRrwAAABXRUJQVlA4TK8AAAAvEQAEEE9gtAES3uJlnqHS6HZn', 3]
          ];
          const saltGrowingPrefix = 'data:image/webp;base64,UklGRnwAAABXRUJQVlA4THAAAAAvEQAEEDdAJmCxWkqpKoJfCTXIBCzWRP8MfjHE8CLUwLj+HdRSwSTwNP8B+N8yRdrZIi4wim2rDVVAX0MsUAxgIFVA9+/h/7+KgYj+TwA7cDbXAoee7w92PW8HbHohwm9qgSOcHx7PA4/W4HmiEyEA';
          const saltUpgradePrefix = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9';
          // Salt farms showing the in-game upgrade marker are managed in the game, not the panel.
          if (images.some((image) => (image.currentSrc || image.src || '').startsWith(saltUpgradePrefix))) return;
          const saltImage = images.find((image) => saltStates.some(([prefix]) => (image.currentSrc || image.src || '').startsWith(prefix)));
          if (saltImage) {
            const source = saltImage.currentSrc || saltImage.src;
            const hits = saltStates.find(([prefix]) => source.startsWith(prefix))?.[1] || 1;
            saltReady.push({ hits, icon: source, count: 1, mapKeys: [`${placement.style.top}|${placement.style.left}`] });
            return;
          }
          const saltGrowingImage = images.find((image) => (image.currentSrc || image.src || '').startsWith(saltGrowingPrefix));
          if (saltGrowingImage) {
            const time = readPlacementTime(placement);
            saltGrowing.push({ icon: saltGrowingImage.currentSrc || saltGrowingImage.src, count: 1, seconds: time.seconds, hasPreciseSeconds: time.hasSeconds, mapKeys: [`${placement.style.top}|${placement.style.left}`] });
            return;
          }
          const composterImages = images.filter((image) => /composter/i.test(image.alt || '') || /\/game-assets\/composters\/[^/]+\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || ''));
          const initialComposterImage = composterImages[0];
          const state = composterImages.some((image) => /_ready\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || '')) || Boolean(placement.querySelector('img.ready')) ? 'ready' : composterImages.some((image) => /_closed\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || '')) ? 'growing' : 'empty';
          const composterImage = state === 'ready'
            ? composterImages.find((image) => /_ready\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || '') || image.classList.contains('ready')) || initialComposterImage
            : state === 'growing'
              ? composterImages.find((image) => /_closed\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || '')) || initialComposterImage
              : initialComposterImage;
          const composterSource = composterImage && (composterImage.currentSrc || composterImage.src || '');
          if (composterImage) {
            const mapKey = `${placement.style.top}|${placement.style.left}`;
            const composterName = (composterSource.match(/\/composters\/([^/.]+)\.webp/i)?.[1] || 'Composter').replace(/_(?:ready|closed)$/i, '');
            const label = composterImage.alt?.trim() || titleCase(composterName);
            const group = state === 'ready' ? composterReady : state === 'empty' ? composterEmpty : composterGrowing;
            // Each farm has at most one of each Composter. Keep every machine
            // separate so their independent timer and state cannot be merged.
            // The map label is coarse (for example "2h"). Countdown time must
            // come only from the Composter dialog after an explicit detail scan.
            group.set(mapKey, { label, icon: composterSource, count: 1, seconds: null, hasPreciseSeconds: false, mapKeys: [mapKey] });
            return;
          }
          const mushroomSource = Array.from(placement.querySelectorAll('.mushroom [style*="background-image"]')).map((element) => element.style.backgroundImage || '').find((source) => /\/(wild|magic)_mushroom_sheet\.png/i.test(source));
          const mushroomMatch = mushroomSource && mushroomSource.match(/\/(wild|magic)_mushroom_sheet\.png/i);
          if (mushroomMatch) {
            const mushroom = mushrooms[mushroomMatch[1].toLowerCase()];
            mushroom.count += 1;
            mushroom.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
            return;
          }
          const fruitPatch = sources.some((source) => /\/game-assets\/(?:[^/]+\/)?fruit\/fruit_patch\.(?:webp|png)(?:[?#]|$)/i.test(source));
          const firstLayer = placement.firstElementChild;
          const secondLayer = firstLayer?.firstElementChild;
          const thirdLayer = secondLayer?.firstElementChild;
          const isCropSoilLayout = Boolean(
            firstLayer?.classList.contains('w-full') && firstLayer.classList.contains('h-full') && firstLayer.classList.contains('relative') &&
            secondLayer?.classList.contains('w-full') && secondLayer.classList.contains('h-full') && secondLayer.classList.contains('relative') &&
            thirdLayer?.classList.contains('w-full') && thirdLayer.classList.contains('h-full') && thirdLayer.classList.contains('relative') &&
            thirdLayer.classList.contains('cursor-pointer') && thirdLayer.classList.contains('hover:img-highlight') &&
            thirdLayer.querySelector('img[src*="/game-assets/crops/soil2.png"]')
          );
          if (fruitPatch) {
            const mapKey = `${placement.style.top}|${placement.style.left}`;
            const fertiliserType = sources.some((source) => source.startsWith('data:image/webp;base64,UklGRpAAAABXRUJQVlA4TIMAAAAvD0AC')) ? 2
              : sources.some((source) => source.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAICAYAAADA+m62')) ? 1
                : sources.some((source) => source.includes('/icons/stopwatch.png')) ? 2
                  : images.some((image) => (image.currentSrc || image.src || '').startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAN')) ? 1 : 0;
            const fertilised = fertiliserType > 0;
            const fruitTooltipNode = Array.from(placement.querySelectorAll('div.transition-opacity')).find((element) => element.querySelector('span.whitespace-nowrap') && element.querySelector('span.font-secondary'));
            const fruitTitle = fruitTooltipNode?.querySelector('span.whitespace-nowrap')?.textContent.trim() || Array.from(placement.querySelectorAll('span')).map((element) => element.textContent.trim()).find((text) => /\b.+\s+(?:Tree\s+)?(?:Growing|Ready|Replenishing)\b/i.test(text)) || '';
            const fruitName = fruitTitle.match(/^(.+?)\s+(?:Tree\s+)?(?:Growing|Ready|Replenishing)$/i)?.[1] || '';
            // Ready fruit sprites can be inlined by the game, without a tooltip or an asset URL.
            // The banana sprite is 31×35px and starts with this stable PNG header.
            const bananaSprite = images.find((image) => (image.currentSrc || image.src || '').startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAB8AAAAjCAYAAABsFtHv'));
            const readyFruitSprite = bananaSprite || images.find((image) => {
              const source = image.currentSrc || image.src || '';
              return source.startsWith('data:image/') && Boolean(image.style.bottom) && !source.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAN');
            });
            const shrubImage = images.find((image) => /\/game-assets\/fruit\/bush_shrub\.png(?:[?#]|$)/i.test(image.currentSrc || image.src || ''));
            const harvestedBushImage = images.find((image) => /\/game-assets\/fruit\/harvested_bush\.png(?:[?#]|$)/i.test(image.currentSrc || image.src || ''));
            const fruitLabel = fruitName || (bananaSprite ? 'Banana' : shrubImage ? 'Bush Shrub' : 'Fruit');
            const deadImage = images.find((image) => /\/game-assets\/fruit\/(?:dead_tree|dead_bush|withered_bush|bush_shrub)\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || ''));
            const soilImage = images.find((image) => /\/game-assets\/crops\/soil2\.png/i.test(image.currentSrc || image.src || ''));
            // Resolve the Fruit state before reading a timer. A ready tooltip can
            // linger in the DOM with its previous countdown, which must never
            // turn an otherwise ready Fruit back into a growing card.
            const fruitState = /\bReady\b/i.test(fruitTitle) ? 'ready'
              : /\b(?:Growing|Replenishing)\b/i.test(fruitTitle) ? 'growing'
                : 'unknown';
            // Read the entire Fruit tooltip. Its minutes and seconds are
            // separate DOM nodes, so reading only .font-secondary loses secs.
            const fruitTimerText = fruitTooltipNode?.innerText || fruitTooltipNode?.textContent || '';
            const time = fruitState === 'ready'
              ? { seconds: null, hasSeconds: false }
              : fruitTooltipNode ? parseSeconds(fruitTimerText) : readPlacementTime(placement);
            const fruitIsReady = fruitState === 'ready';
            if (deadImage) {
              const key = String(fertiliserType);
              const current = fruitDead.get(key) || { label: 'Gốc Fruit chết', icon: deadImage.currentSrc || deadImage.src, count: 0, fertilised, fertiliserType, mapKeys: [] };
              current.count += 1;
              current.mapKeys.push(mapKey);
              fruitDead.set(key, current);
            } else if (soilImage && !cropImage) {
              const key = String(fertiliserType);
              const current = fruitEmpty.get(key) || { label: 'Đất Fruit trống', icon: soilIcon, count: 0, fertilised, fertiliserType, mapKeys: [] };
              current.count += 1;
              current.mapKeys.push(mapKey);
              fruitEmpty.set(key, current);
            } else if (!fruitIsReady && (harvestedBushImage || cropImage || /\b(?:Growing|Replenishing)\b/i.test(fruitTitle) || Number.isFinite(time.seconds))) {
              const isFruitVisual = (image) => {
                const source = image.currentSrc || image.src || '';
                return Boolean(source) && !/fruit_patch|soil2|empty_bar|stopwatch|dead_(?:tree|bush)|withered_bush|selectbox|progress/i.test(source) && !/\/game-assets\/ui\//i.test(source);
              };
              const fruitTooltip = Array.from(placement.querySelectorAll('div')).find((element) => element.innerText.includes(fruitTitle) && Array.from(element.querySelectorAll('img')).some(isFruitVisual));
              const fruitImage = harvestedBushImage || Array.from(fruitTooltip?.querySelectorAll('img') || []).find(isFruitVisual) || images.find((image) => image.style.bottom && isFruitVisual(image)) || images.find(isFruitVisual);
              // A tooltip without seconds represents the whole displayed
              // minute. Start from its upper bound (e.g. 1h51m -> 1h52m).
              // Entries are sorted descending before grouping, so the card
              // retains the longest actual/estimated timer in that group.
              const countdownSeconds = Number.isFinite(time.seconds)
                ? time.seconds + (time.hasSeconds ? 0 : 60)
                : null;
              fruitGrowingEntries.push({ label: fruitLabel, icon: fruitImage?.currentSrc || fruitImage?.src || cropImage?.currentSrc || cropImage?.src || soilIcon, count: 1, fertilised, fertiliserType, seconds: countdownSeconds, timeGroup: countdownSeconds ?? 'unknown', hasPreciseSeconds: time.hasSeconds, mapKeys: [mapKey] });
            } else {
              const icon = readyFruitSprite || images.find((image) => !/fruit_patch|soil2|stopwatch|dead_(?:tree|bush)|withered_bush/i.test(image.currentSrc || image.src || '') && !(image.currentSrc || image.src || '').startsWith('data:'));
              const key = `${fruitLabel}|${fertiliserType}`;
              const current = fruitReady.get(key) || { label: fruitLabel, icon: icon?.currentSrc || icon?.src || 'https://sunflower-land.com/game-assets/fruit/fruit_tree.webp', count: 0, fertilised, fertiliserType, mapKeys: [] };
              current.count += 1;
              current.mapKeys.push(mapKey);
              fruitReady.set(key, current);
            }
            return;
          }
          if (treeMatch) {
            const time = readPlacementTime(placement);
            const isGrowingTree = (Number.isFinite(time.seconds) && time.seconds > 0)
              || treeImage.classList.contains('opacity-50')
              || Boolean(treeImage.closest('.opacity-50'));
            if (isGrowingTree) {
              treeGrowingEntries.push({
                icon: treeImage.currentSrc || treeImage.src,
                count: 1,
                seconds: time.seconds,
                hasPreciseSeconds: time.hasSeconds,
                mapKeys: [`${placement.style.top}|${placement.style.left}`]
              });
              return;
            }
            const key = `${treeMatch[1]}|${treeMatch[2]}|${treeMatch[3]}`;
            const current = treeReady.get(key) || { icon: treeImage.currentSrc || treeImage.src, count: 0, mapKeys: [] };
            current.count += 1;
            current.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
            treeReady.set(key, current);
            return;
          }
          if (miningMatch) {
            const resource = miningMatch[1].toLowerCase();
            const mapKey = `${placement.style.top}|${placement.style.left}`;
            // A completed mine can retain a hidden timer node briefly. Its
            // sprite opacity is authoritative for the resource state.
            const isGrowingMining = Boolean(/(?:^|\s)opacity-50(?:\s|$)/.test(placement.innerHTML) || miningImage.closest('.opacity-50') || placement.querySelector('.opacity-50 img[src*="_small.png"]'));
            if (!isGrowingMining) {
              const current = miningReady.get(resource) || { resource, label: `${titleCase(resource)} Rock`, icon: miningImage.currentSrc || miningImage.src, count: 0, mapKeys: [] };
              current.count += 1;
              current.mapKeys.push(mapKey);
              miningReady.set(resource, current);
              return;
            }
            const time = readPlacementTime(placement);
            miningGrowingEntries.push({ resource, label: `${titleCase(resource)} Rock`, icon: miningImage.currentSrc || miningImage.src, count: 1, seconds: time.seconds, hasPreciseSeconds: time.hasSeconds, mapKeys: [mapKey] });
            return;
          }
          if (!cropMatch) {
            const isGrowingTree = sources.some((source) => source.includes('/game-assets/resources/stump.png')) || sources.some((source) => source.includes('/game-assets/resources/tree.png'));
            if (isGrowingTree) {
              // React can retain the old stump layer after a Tree has become
              // ready. A visible, non-faded Tree is authoritative; otherwise
              // the stale stump would create a Recovering card forever.
              const readyTreeImage = images.find((image) => {
                const source = image.currentSrc || image.src || '';
                return source.includes('/game-assets/resources/tree.png') && !image.closest('.transition-opacity') && !image.classList.contains('opacity-50') && !image.closest('.opacity-50');
              });
              if (readyTreeImage) {
                const source = readyTreeImage.currentSrc || readyTreeImage.src;
                const key = `generic|${source}`;
                const current = treeReady.get(key) || { icon: source, count: 0, mapKeys: [] };
                current.count += 1;
                current.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
                treeReady.set(key, current);
                return;
              }
              const stumpImage = images.find((image) => image.classList.contains('opacity-50')) || images.find((image) => (image.currentSrc || image.src || '').includes('/game-assets/resources/stump.png'));
              if (stumpImage) {
                const time = readPlacementTime(placement);
                // The stump is already the authoritative growing state, even
                // when React has not rendered its timer yet. Preserve it as an
                // unknown timer so the panel can retry this scan every second.
                treeGrowingEntries.push({ icon: stumpImage.currentSrc || stumpImage.src || 'https://sunflower-land.com/game-assets/resources/stump.png', count: 1, seconds: time.seconds, hasPreciseSeconds: time.hasSeconds, mapKeys: [`${placement.style.top}|${placement.style.left}`] });
                return;
              }
              return;
            }
            const dryCropSoil = sources.some((source) => source.includes('/game-assets/crops/soil_dry.png'));
            const frozenImage = images.find((image) => /great\s*freeze/i.test(image.alt || ''));
            if (frozenImage && dryCropSoil) {
              frozenCount += 1;
              frozenIcon ||= frozenImage.currentSrc || frozenImage.src;
              frozenMapKeys.push(`${placement.style.top}|${placement.style.left}`);
              return;
            }
            const tornadoImage = images.find((image) => /^tornado$/i.test((image.alt || '').trim()));
            if (tornadoImage && dryCropSoil) {
              tornadoCount += 1;
              tornadoIcon ||= tornadoImage.currentSrc || tornadoImage.src;
              tornadoMapKeys.push(`${placement.style.top}|${placement.style.left}`);
              return;
            }
            if (isCropSoilLayout) {
              const fertiliserType = sources.some((source) => source.includes('/icons/stopwatch.png')) ? 2 : images.some((image) => (image.currentSrc || image.src || '').startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAN')) ? 1 : 0;
              const fertilised = fertiliserType > 0;
              const key = String(fertiliserType);
              const current = empty.get(key) || { count: 0, icon: soilIcon, fertilised, fertiliserType, mapKeys: [] };
              current.count += 1;
              current.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
              empty.set(key, current);
            }
            return;
          }
          const [, name, stage] = cropMatch;
          const fertiliserType = sources.some((source) => source.includes('/icons/stopwatch.png')) ? 2 : images.some((image) => (image.currentSrc || image.src || '').startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAN')) ? 1 : 0;
          const fertilised = fertiliserType > 0;
          const bee = sources.some((source) => source.startsWith('data:image/webp;base64,UklGRl4AAABXRUJQVlA4TFIAAAAvCcABEC9AEECSRGhz'));
          const record = { label: titleCase(name), icon: cropImage.currentSrc || cropImage.src, count: 1, fertilised, fertiliserType, bee };
          if (stage === 'plant') {
            const key = `${name}|${fertiliserType}|${bee}`;
            const current = ready.get(key) || { ...record, mapKeys: [] };
            current.count += ready.has(key) ? 1 : 0;
            current.mapKeys.push(`${placement.style.top}|${placement.style.left}`);
            ready.set(key, current);
            return;
          }
          const time = readPlacementTime(placement);
          growingEntries.push({ ...record, stage, seconds: time.seconds, timeGroup: time.seconds ?? 'unknown', hasPreciseSeconds: time.hasSeconds, mapKeys: [`${placement.style.top}|${placement.style.left}`] });
        });
        const groupedGrowing = [];
        const growingByCrop = new Map();
        growingEntries.forEach((entry) => {
          const key = `${entry.label}|${entry.stage}|${entry.fertiliserType}|${entry.bee}`;
          const list = growingByCrop.get(key) || [];
          list.push(entry);
          growingByCrop.set(key, list);
        });
        growingByCrop.forEach((entries) => {
          const timedEntries = entries.filter((entry) => Number.isFinite(entry.seconds)).sort((left, right) => right.seconds - left.seconds);
          const groups = [];
          timedEntries.forEach((entry) => {
            const group = groups.find((candidate) => canGroupTimerEntries(candidate, entry));
            if (group) {
              group.count += entry.count;
              group.mapKeys.push(...entry.mapKeys);
            } else {
              groups.push({ ...entry, count: entry.count, mapKeys: [...entry.mapKeys] });
            }
          });
        groupedGrowing.push(...groups);
          entries.filter((entry) => !Number.isFinite(entry.seconds)).forEach((entry) => groupedGrowing.push(entry));
        });
        const groupedTrees = [];
        treeGrowingEntries.sort((left, right) => (Number.isFinite(right.seconds) ? right.seconds : -1) - (Number.isFinite(left.seconds) ? left.seconds : -1)).forEach((entry) => {
          // Do not combine a stump with no timer into a timed Tree card.
          // Its next one-second scan must be able to resolve that exact tree.
          const group = Number.isFinite(entry.seconds)
            ? groupedTrees.find((candidate) => candidate.icon === entry.icon && canGroupTimerEntries(candidate, entry))
            : null;
          if (group) {
            group.count += entry.count;
            group.mapKeys.push(...(entry.mapKeys || []));
          }
          else groupedTrees.push({ ...entry });
        });
        const groupedMining = [];
        miningGrowingEntries.sort((left, right) => (right.seconds || 0) - (left.seconds || 0)).forEach((entry) => {
          const group = groupedMining.find((candidate) => candidate.resource === entry.resource && canGroupTimerEntries(candidate, entry));
          if (group) {
            group.count += 1;
            group.mapKeys.push(...entry.mapKeys);
          } else groupedMining.push({ ...entry, mapKeys: [...entry.mapKeys] });
        });
        const groupedFruitGrowing = [];
        fruitGrowingEntries.sort((left, right) => (right.seconds || 0) - (left.seconds || 0)).forEach((entry) => {
          const group = groupedFruitGrowing.find((candidate) => candidate.label === entry.label && candidate.fertiliserType === entry.fertiliserType && ((Number.isFinite(candidate.seconds) && Number.isFinite(entry.seconds) && canGroupTimerEntries(candidate, entry)) || (!Number.isFinite(candidate.seconds) && !Number.isFinite(entry.seconds))));
          if (group) {
            group.count += entry.count;
            group.mapKeys.push(...entry.mapKeys);
          } else groupedFruitGrowing.push({ ...entry, mapKeys: [...entry.mapKeys] });
        });
        const fruitNames = ['apple', 'banana', 'blueberry', 'lemon', 'orange', 'grape'];
        const reactFruitName = (element) => {
          const visited = new Set();
          const read = (value, depth = 0) => {
            if (depth > 3 || value == null || visited.has(value)) return '';
            if (typeof value === 'string') return fruitNames.find((name) => new RegExp(`\\b${name}(?:\\s+seed)?\\b`, 'i').test(value)) || '';
            if (typeof value !== 'object') return '';
            visited.add(value);
            for (const [key, nested] of Object.entries(value)) {
              if (!/name|item|seed|fruit|children|props/i.test(key)) continue;
              const found = read(nested, depth + 1);
              if (found) return found;
            }
            return '';
          };
          for (let node = element; node; node = node.parentElement) {
            const props = Object.getOwnPropertyNames(node).filter((key) => key.startsWith('__reactProps$') || key.startsWith('__reactFiber$'));
            for (const key of props) {
              const found = read(node[key]);
              if (found) return found;
            }
          }
          return '';
        };
        const quickSelectColumn = Array.from(document.querySelectorAll('div.flex.flex-col.items-center')).find((column) => {
          const slots = Array.from(column.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]'));
          return slots.length >= 3;
        });
        const firstQuickSlot = quickSelectColumn && Array.from(quickSelectColumn.children).find((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]'));
        const selectedQuickSlot = quickSelectColumn && Array.from(quickSelectColumn.children).find((child) => child.classList.contains('relative') && child.querySelector('img[src*="/game-assets/ui/select/selectbox_"]'));
        const activeQuickSlot = selectedQuickSlot || firstQuickSlot;
        const seedImage = activeQuickSlot?.querySelector('.bg-brown-600 img[alt="item"]') || null;
        const seedSource = seedImage?.currentSrc || seedImage?.src || '';
        const cropSeedMatch = seedSource.match(/\/game-assets\/crops\/([^/]+)\/seed\.png/i);
        const fruitSeedMatch = seedSource.match(/\/game-assets\/fruit\/([^/]+?)(?:_seed|\/seed)\.png/i);
        const knownFruitIcon = seedSource.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA0AAAAOCAYAAAD0f5bS') ? 'banana' : '';
        const selectedFruitName = fruitSeedMatch?.[1] || reactFruitName(activeQuickSlot || seedImage) || knownFruitIcon;
        const itemNameMatch = seedSource.match(/\/([^/.]+)\.(?:png|webp)$/i);
        return {
          mapReady: true,
          placementCount: mapPlacements.length,
          empty: Array.from(empty.values()),
          tornado: { count: tornadoCount, icon: 'https://sunflower-land.com/game-assets/crops/soil_dry.png', tornadoIcon, mapKeys: tornadoMapKeys },
          frozen: { count: frozenCount, icon: 'https://sunflower-land.com/game-assets/crops/soil_dry.png', frozenIcon, mapKeys: frozenMapKeys },
          growing: groupedGrowing,
          ready: Array.from(ready.values()),
          trees: { ready: Array.from(treeReady.values()), growing: groupedTrees },
          mining: { ready: Array.from(miningReady.values()), growing: groupedMining },
          salt: { ready: saltReady, growing: saltGrowing },
          dailyShipment,
          composters: { ready: Array.from(composterReady.values()), empty: Array.from(composterEmpty.values()), growing: Array.from(composterGrowing.values()) },
          mushrooms,
          pets: { sleeping: Array.from(sleepingPets.values()), awake: Array.from(awakePets.values()) },
          fruit: { empty: Array.from(fruitEmpty.values()), ready: Array.from(fruitReady.values()), growing: groupedFruitGrowing, dead: Array.from(fruitDead.values()) },
          bettyLand,
          heldQuickItem: seedImage ? { name: cropSeedMatch ? titleCase(cropSeedMatch[1]) : itemNameMatch ? titleCase(itemNameMatch[1]) : 'Vật phẩm đã chọn', icon: seedSource, count: Number((activeQuickSlot.textContent.match(/\d[\d,.]*/)?.[0] || '0').replace(/[^\d]/g, '')) } : null,
          heldSeed: seedImage ? { name: cropSeedMatch ? titleCase(cropSeedMatch[1]) : itemNameMatch ? titleCase(itemNameMatch[1]) : 'Vật phẩm đã chọn', icon: seedSource, isSeed: /\/seed\.png(?:$|[?#])/i.test(seedSource), count: Number((activeQuickSlot.textContent.match(/\d[\d,.]*/)?.[0] || '0').replace(/[^\d]/g, '')) } : null,
          heldFruitSeed: selectedFruitName ? { name: titleCase(selectedFruitName), icon: seedSource, count: Number((activeQuickSlot.textContent.match(/\d[\d,.]*/)?.[0] || '0').replace(/[^\d]/g, '')) } : null
        };
      }
    });
    if (!result?.mapReady) {
      if (result?.offIsland) {
        lastScanData = null;
        overviewResults.innerHTML = `<div class="map-scan-waiting" role="status" style="color: #ffcc00;"><span class="map-scan-waiting-icon" style="animation: none;">✈️</span><strong>Bạn đang ở ngoài đảo!</strong><small>Hãy trở về đảo chính để quét bản đồ.</small></div>`;
        cropResults.innerHTML = '';
        cropGrowingResults.innerHTML = '';
        treeResults.innerHTML = '';
        treeGrowingResults.innerHTML = '';
        miningResults.innerHTML = '';
        miningGrowingResults.innerHTML = '';
        blockedResults.innerHTML = '';
        activateMapActivityTab('overview', { history: false, syncGame: false });
        return false;
      }
      renderMapScanWaiting();
      scheduleMapScanRetry();
      return false;
    }
    window.clearTimeout(mapScanWaitingTimer);
    const fullScan = scope === 'all' || !lastScanData;
    const forceFruitTimerRefresh = scope === 'fruit' && options?.forceTimerRefresh;
    if (fullScan && lastScanData && isLikelyIncompleteMapScan(result)) {
      suspiciousMapScanStreak += 1;
      const previousCount = countScannedMapObjects(lastScanData);
      const scannedCount = countScannedMapObjects(result);
      if (suspiciousMapScanStreak === 1) {
        log(`⚠ Quét Map bất thường: chỉ đọc ${scannedCount}/${previousCount} đối tượng dù Map có ${result.placementCount} placement. Giữ dữ liệu cũ và quét xác nhận lại…`);
        scheduleMapIntegrityRetry();
        scanned = true;
        return true;
      }
      log(`⚠ Lượt quét Map xác nhận chỉ có ${scannedCount}/${previousCount} đối tượng; cập nhật theo dữ liệu mới.`);
    } else if (fullScan) {
      suspiciousMapScanStreak = 0;
    }
    if (forceFruitTimerRefresh) {
      // The explicit Load Fruit button must use the latest DOM timer exactly,
      // not a cached target from a previous card lifecycle or scan.
      (result.fruit?.growing || []).forEach((item) => {
        const seconds = Number(item.seconds);
        const key = (item.mapKeys || []).join('||');
        if (key) countdownTargets.delete(key);
        if (Number.isFinite(seconds) && seconds > 0) item.countdownTarget = Date.now() + seconds * 1000;
      });
    } else if (lastScanData) preserveScanCountdowns(result);
    if (fullScan) {
      const previousByKey = new Map((lastScanData?.pets?.awake || []).flatMap((item) => (item.mapKeys || []).map((mapKey) => [mapKey, item])));
      result.pets.awake = (result.pets?.awake || []).map((item) => {
        const previous = previousByKey.get((item.mapKeys || [])[0]);
        return { ...item, seconds: previous?.seconds || 2 * 60 * 60, countdownTarget: previous?.countdownTarget || Date.now() + 2 * 60 * 60 * 1000 };
      });
    }
    if (fullScan) {
      renderCropScan(result);
      renderTreeScan(result.trees);
      renderMiningScan(result.mining);
      renderFruitScan(result.fruit);
      await refreshConnection();
    } else if (!mergeProfessionScan(scope, result, { skipCountdownPreservation: forceFruitTimerRefresh })) {
      throw new Error('Không xác định được nghề cần quét.');
    }
    scanned = true;
    if (scope === 'all' || scope === 'tree') scheduleUnknownTreeTimeRefresh(lastScanData?.trees);
    if (scope === 'all' || scope === 'fruit') scheduleUnknownFruitTimeRefresh();
  } catch (error) {
    logActionError(`Quét ${scope === 'all' ? 'Map' : scope}: ${error.message || 'lỗi không xác định'}`);
    if (scope === 'all' || !lastScanData) {
      cropResults.innerHTML = `<div class="empty-state">${escapeHtml(error.message || 'Không thể quét map.')}</div>`;
      blockedResults.innerHTML = '';
      treeResults.innerHTML = '';
      miningResults.innerHTML = '';
      cropGrowingResults.innerHTML = '';
      treeGrowingResults.innerHTML = '';
      miningGrowingResults.innerHTML = '';
    }
  } finally {
    scanMapButton.disabled = false;
    scanMapButton.classList.remove('is-scanning');
  }
  return scanned;
}

scanMapButton.addEventListener('click', async () => {
  const finishLog = startActionLog('Scanning map...');
  try {
    if (!await scanMap()) logActionError('Không thể quét Map.');
  } catch (error) {
    logActionError(error.message || 'Không thể quét Map.');
  } finally {
    finishLog();
  }
});
