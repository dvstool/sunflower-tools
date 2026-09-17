/* Mushroom, Pet, Composter, and Fruit interactions. */

async function harvestMushrooms(card) {
  await window.licenseManager.requireTier('silver');
  const mapKeys = card.dataset.mapKeys ? card.dataset.mapKeys.split('||').filter(Boolean) : [];
  if (!mapKeys.length) throw new Error('Không xác định được nấm trên map. Hãy quét Map lại.');
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (keys) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const mushroomSource = (placement) => Array.from(placement.querySelectorAll('.mushroom [style*="background-image"]')).map((element) => element.style.backgroundImage || '').find((source) => /\/(?:wild|magic)_mushroom_sheet\.png/i.test(source));
      let harvested = 0;
      for (const key of keys) {
        const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === key);
        if (!placement || !mushroomSource(placement)) continue;
        (placement.querySelector('.mushroom.cursor-pointer') || placement.querySelector('.mushroom') || placement).click();
        harvested += 1;
        await sleep(120);
      }
      return { harvested };
    },
    args: [mapKeys]
  });
  return result || { harvested: 0 };
}

async function wakeSleepingPets(card) {
  await window.licenseManager.requireTier('silver');
  const mapKeys = card.dataset.mapKeys ? card.dataset.mapKeys.split('||').filter(Boolean) : [];
  if (!mapKeys.length) throw new Error('Không xác định được Pet đang ngủ. Hãy quét Map lại.');
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (keys) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      let awakened = 0;
      const awakenedKeys = [];
      const awakenedPets = [];
      for (const key of keys) {
        const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === key);
        const sleeping = placement?.querySelector('img[alt="sleeping"][src*="/game-assets/icons/sleeping.webp"]');
        if (!sleeping) continue;
        const pet = Array.from(placement.querySelectorAll('img')).find((image) => image !== sleeping && image.alt?.trim() && image.alt.trim().toLowerCase() !== 'sleeping') || Array.from(placement.querySelectorAll('img')).find((image) => image !== sleeping && image.classList.contains('cursor-pointer'));
        const target = pet || sleeping;
        target.click();
        awakened += 1;
        awakenedKeys.push(key);
        await sleep(120);
        const activePet = Array.from(placement.querySelectorAll('img')).find((image) => image.alt?.trim() && image.alt.trim().toLowerCase() !== 'sleeping');
        awakenedPets.push({ mapKey: key, label: activePet?.alt?.trim() || pet?.alt?.trim() || 'Pet', icon: activePet?.currentSrc || activePet?.src || pet?.currentSrc || pet?.src || '' });
      }
      return { awakened, awakenedKeys, awakenedPets };
    },
    args: [mapKeys]
  });
  return result || { awakened: 0, awakenedKeys: [], awakenedPets: [] };
}

async function interactComposters(card, action) {
  await window.licenseManager.requireTier('silver');
  const mapKeys = card.dataset.mapKeys ? card.dataset.mapKeys.split('||').filter(Boolean) : [];
  if (!mapKeys.length) throw new Error('Không xác định được Composter trên map. Hãy quét Map lại.');
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (keys, requestedAction) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const waitFor = async (predicate, timeout = 4000) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const found = predicate();
          if (found) return found;
          await sleep(30);
        }
        return null;
      };
      const isComposter = (placement) => Array.from(placement.querySelectorAll('img')).some((image) => /composter/i.test(image.alt || '') || /\/game-assets\/composters\/[^/]+\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || ''));
      const parseSeconds = (text) => Array.from(String(text || '').matchAll(/(\d+)\s*(days?|d|hrs?|h|mins?|m|secs?|s)\b/gi)).reduce((total, match) => {
        const unit = match[2].toLowerCase();
        return total + Number(match[1]) * (/^d/.test(unit) ? 86400 : /^h/.test(unit) ? 3600 : /^m/.test(unit) ? 60 : 1);
      }, 0) || null;
      const readRequirements = (panel) => {
        const requirementsLabel = Array.from(panel?.querySelectorAll('div, span') || []).find((element) => element.innerText?.trim() === 'Requirements');
        let requirementsSection = requirementsLabel || null;
        while (requirementsSection && !Array.from(requirementsSection.children).some((child) => child.classList?.contains('mt-2'))) requirementsSection = requirementsSection.parentElement;
        const requirementsContainer = Array.from(requirementsSection?.children || []).find((child) => child.classList?.contains('mt-2'));
        return Array.from(requirementsContainer?.querySelectorAll('img[alt="item"]') || []).map((image) => {
          let row = image.parentElement;
          while (row && row !== requirementsContainer && !row.classList.contains('min-h-[26px]')) row = row.parentElement;
          return { icon: image.currentSrc || image.src || '', text: row?.innerText?.trim() || '' };
        }).filter((entry) => entry.icon && entry.text);
      };
      let processed = 0;
      const processedKeys = [];
      const details = [];
      for (const key of keys) {
        const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === key);
        if (!placement || !isComposter(placement)) continue;
        (placement.querySelector('.cursor-pointer') || placement.firstElementChild || placement).click();
        const actionButton = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => button.offsetParent !== null && button.innerText.trim() === requestedAction));
        if (!actionButton) return { processed, error: `Không mở được nút ${requestedAction} của Composter.` };
        let panel = actionButton.parentElement;
        while (panel && panel !== document.body && !panel.querySelector('img[src*="/game-assets/icons/close.png"]')) panel = panel.parentElement;
        const requirements = requestedAction === 'Compost' ? readRequirements(panel) : [];
        const detail = { mapKey: key, seconds: null, requirements, canCompost: requestedAction === 'Compost' ? !actionButton.disabled : undefined };
        details.push(detail);
        if (actionButton.disabled) {
          panel?.querySelector('img[src*="/game-assets/icons/close.png"]')?.click();
          return { processed, details, error: 'Không đủ nguyên liệu để Compost.' };
        }
        actionButton.click();
        await sleep(350);
        if (requestedAction === 'Compost') {
          // The map only exposes a rounded duration. Read the actual timer
          // from the dialog that the Compost action just opened instead.
          detail.seconds = await waitFor(() => {
            const timer = panel?.querySelector('img[src*="/game-assets/icons/timer.png"]');
            const seconds = parseSeconds(timer?.parentElement?.innerText || '');
            return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
          }, 3500);
        }
        if (requestedAction === 'Collect') {
          // The same dialog switches from Collect to Compost after the reward is granted.
          // Read its requirements before closing it so the overview can render the
          // empty card immediately, without opening every composter again.
          const compostButton = await waitFor(() => Array.from(panel?.querySelectorAll('button') || []).find((button) => /^Compost$/i.test(button.innerText.trim())), 4000);
          if (compostButton) {
            detail.requirements = readRequirements(panel);
            detail.canCompost = !compostButton.disabled;
          }
        }
        const closeButton = await waitFor(() => {
          const close = panel?.querySelector('img[src*="/game-assets/icons/close.png"]');
          return close?.offsetParent !== null ? close : null;
        }, 2200);
        if (!closeButton) return { processed, error: 'Không tìm thấy nút đóng Composter.' };
        closeButton.click();
        processed += 1;
        processedKeys.push(key);
        await sleep(120);
      }
      return { processed, processedKeys, details };
    },
    args: [mapKeys, action]
  });
  result?.details?.forEach((detail) => {
    const previous = composterDetails.get(detail.mapKey) || {};
    composterDetails.set(detail.mapKey, { ...previous, seconds: detail.seconds ?? previous.seconds, requirements: detail.requirements || previous.requirements || [], recipe: detail.requirements || previous.recipe || [], canCompost: detail.canCompost ?? previous.canCompost, updatedAt: Date.now() });
  });
  if (result?.error) throw new Error(result.error);
  return result || { processed: 0, processedKeys: [] };
}

async function scanComposterDetails() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const waitFor = async (predicate, timeout = 2500) => {
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
          const value = predicate();
          if (value) return value;
          await sleep(30);
        }
        return null;
      };
      const parseSeconds = (text) => {
        const match = String(text || '').replace(/\b(\d+)\s*hsr\b/gi, '$1hrs').match(/\b(?=\d+\s*(?:d(?:ays?)?|h(?:r(?:s)?|ours?)?|m(?:in(?:s)?)?|s(?:ec(?:s)?)?))(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:r(?:s)?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s)?)?)?\s*(?:(\d+)\s*s(?:ec(?:s)?)?)?/i);
        return match && (match[1] || match[2] || match[3] || match[4]) ? Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0) : null;
      };
      const dialogs = () => Array.from(document.querySelectorAll('div[data-headlessui-state="open"]')).filter((dialog) => dialog.offsetParent !== null && /Composter/.test(dialog.innerText || ''));
      const closeDialog = async (dialog) => {
        const close = dialog?.querySelector('img.flex-none.cursor-pointer.float-right[src*="/game-assets/icons/close.png"], img[src*="/game-assets/icons/close.png"]');
        if (close?.offsetParent !== null) {
          const rect = close.getBoundingClientRect();
          const options = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
          ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click'].forEach((type) => close.dispatchEvent(typeof PointerEvent === 'function' && type.startsWith('pointer') ? new PointerEvent(type, { ...options, pointerId: 1, pointerType: 'mouse', isPrimary: true }) : new MouseEvent(type, options)));
          close.click();
          await waitFor(() => !dialog.isConnected || dialog.offsetParent === null, 1500);
          return true;
        }
        return false;
      };
      const placements = [...new Set(Array.from(document.querySelectorAll('div[data-map-placement="true"] img[alt="Compost Bin"], div[data-map-placement="true"] img[alt*="Composter"]')).map((image) => image.closest('div[data-map-placement="true"]')).filter(Boolean))];
      const details = [];
      const trace = { clicked: 0, read: 0, closed: 0 };
      for (const placement of placements) {
        const sources = Array.from(placement.querySelectorAll('img')).map((image) => image.currentSrc || image.src || '')
          .filter((value) => /\/game-assets\/composters\//i.test(value));
        // The game can retain the previous closed sprite briefly. A ready
        // sprite is authoritative, matching the map scanner and state reader.
        const ready = sources.some((source) => /_ready\.(?:webp|png)(?:[?#]|$)/i.test(source)) || Boolean(placement.querySelector('img.ready'));
        const growing = !ready && sources.some((source) => /_closed\.(?:webp|png)(?:[?#]|$)/i.test(source));
        const target = placement.querySelector('.cursor-pointer') || placement.firstElementChild || placement;
        const dialogsBefore = new Set(dialogs());
        const rect = target.getBoundingClientRect();
        const options = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
        ['pointerdown', 'pointerup'].forEach((type) => target.dispatchEvent(typeof PointerEvent === 'function' ? new PointerEvent(type, { ...options, pointerId: 1, pointerType: 'mouse', isPrimary: true }) : new MouseEvent(type, options)));
        target.click();
        trace.clicked += 1;
        const dialog = await waitFor(() => dialogs().find((item) => !dialogsBefore.has(item)), 3000);
        if (!dialog) {
          continue;
        }
        try {
          if (growing) {
            const seconds = await waitFor(() => {
              const timer = dialog.querySelector('img[src*="/game-assets/icons/timer.png"]');
              const value = parseSeconds(timer?.parentElement?.innerText || '');
              return Number.isFinite(value) && value > 0 ? value : null;
            }, 2500);
            details.push({ mapKey: `${placement.style.top}|${placement.style.left}`, seconds: seconds || null, requirements: [], canCompost: undefined });
          } else if (!ready) {
            const compostButton = Array.from(dialog.querySelectorAll('button')).find((button) => /^Compost$/i.test(button.innerText.trim()));
            const requirementsLabel = Array.from(dialog.querySelectorAll('div, span')).find((element) => element.innerText?.trim() === 'Requirements');
            let requirementsSection = requirementsLabel || null;
            while (requirementsSection && !Array.from(requirementsSection.children).some((child) => child.classList?.contains('mt-2'))) requirementsSection = requirementsSection.parentElement;
            const requirementsContainer = Array.from(requirementsSection?.children || []).find((child) => child.classList?.contains('mt-2'));
            const requirements = Array.from(requirementsContainer?.querySelectorAll('img[alt="item"]') || []).map((image) => {
              let row = image.parentElement;
              while (row && row !== requirementsContainer && !row.classList.contains('min-h-[26px]')) row = row.parentElement;
              return { icon: image.currentSrc || image.src || '', text: row?.innerText?.trim() || '' };
            }).filter((entry) => entry.icon && entry.text);
            details.push({ mapKey: `${placement.style.top}|${placement.style.left}`, seconds: null, requirements, canCompost: Boolean(compostButton && !compostButton.disabled) });
          } else {
            details.push({ mapKey: `${placement.style.top}|${placement.style.left}`, seconds: null, requirements: [], canCompost: undefined });
          }
          trace.read += 1;
        } finally {
          if (await closeDialog(dialog)) trace.closed += 1;
        }
      }
      return { details, found: placements.length, trace };
    }
  });
  return result || { details: [], found: 0, trace: { clicked: 0, read: 0, closed: 0 } };
}

async function readComposterStates() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: () => [...new Set(Array.from(document.querySelectorAll('div[data-map-placement="true"] img[alt="Compost Bin"], div[data-map-placement="true"] img[alt*="Composter"]')).map((image) => image.closest('div[data-map-placement="true"]')).filter(Boolean))].map((placement) => {
      const images = Array.from(placement.querySelectorAll('img')).filter((item) => /composter/i.test(item.alt || '') || /\/game-assets\/composters\/[^/]+\.(?:webp|png)(?:[?#]|$)/i.test(item.currentSrc || item.src || ''));
      const initialImage = images[0];
      const state = images.some((item) => /_ready\.(?:webp|png)(?:[?#]|$)/i.test(item.currentSrc || item.src || '')) || Boolean(placement.querySelector('img.ready')) ? 'ready' : images.some((item) => /_closed\.(?:webp|png)(?:[?#]|$)/i.test(item.currentSrc || item.src || '')) ? 'growing' : 'empty';
      const image = state === 'ready'
        ? images.find((item) => /_ready\.(?:webp|png)(?:[?#]|$)/i.test(item.currentSrc || item.src || '') || item.classList.contains('ready')) || initialImage
        : state === 'growing'
          ? images.find((item) => /_closed\.(?:webp|png)(?:[?#]|$)/i.test(item.currentSrc || item.src || '')) || initialImage
          : initialImage;
      const icon = image?.currentSrc || image?.src || '';
      const sourceName = icon.match(/\/composters\/([^/.]+)\.(?:webp|png)/i)?.[1] || 'Composter';
      const label = image?.alt?.trim() || sourceName.replace(/_(?:ready|closed)$/i, '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      return { mapKey: `${placement.style.top}|${placement.style.left}`, label, icon, state };
    })
  });
  return Array.isArray(result) ? result : [];
}

async function interactFruit(card, action) {
  await window.licenseManager.requireTier('silver');
  const mapKeys = card.dataset.mapKeys ? card.dataset.mapKeys.split('||').filter(Boolean) : [];
  if (!mapKeys.length) throw new Error('Không xác định được Fruit trên map. Hãy quét Map lại.');
  const requestedFruitSeed = action === 'plant' && typeof getActiveSeed === 'function' ? getActiveSeed('fruit') : null;
  if (action === 'plant' && !requestedFruitSeed) throw new Error('Hãy thêm hạt Fruit vào Seed Bar trước khi trồng.');
  if (requestedFruitSeed) selectedFruitSeed = { ...requestedFruitSeed };
  const requestedSeedName = requestedFruitSeed?.name || '';
  const requestedSeedSource = requestedFruitSeed?.icon || '';
  const requestedCatalog = typeof findSeedCatalogEntryByName === 'function' ? findSeedCatalogEntryByName(requestedSeedName) : null;
  const requestedBettySource = requestedCatalog?.treeIconUrl || '';
  const requestedSeedKey = typeof seedPickerKey === 'function' ? seedPickerKey(requestedSeedName) : '';
  const bettySlotIndex = Number(seedBarCache.get(requestedSeedKey)?.slotIndex ?? requestedFruitSeed?.slotIndex ?? -1);
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (keys, requestedAction, requestedAxe, requestedSeedName, requestedSeedSource, requestedBettySource, bettySlotIndex) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const placements = () => Array.from(document.querySelectorAll('div[data-map-placement="true"]'));
      const sourceList = (placement) => Array.from(placement.querySelectorAll('img')).map((image) => image.currentSrc || image.src || '');
      const isFruit = (placement) => sourceList(placement).some((source) => /\/game-assets\/(?:[^/]+\/)?fruit\/fruit_patch\.(?:webp|png)(?:[?#]|$)/i.test(source));
      const hasDeadTree = (placement) => sourceList(placement).some((source) => /\/game-assets\/fruit\/(?:dead_tree|dead_bush|withered_bush|bush_shrub)\.(?:webp|png)(?:[?#]|$)/i.test(source));
      const hasSoil = (placement) => sourceList(placement).some((source) => /\/game-assets\/crops\/soil2\.png/i.test(source));
      const hasGrowing = (placement) => Array.from(placement.querySelectorAll('img')).some((image) => /\/game-assets\/crops\/[^/]+\/(seedling|halfway|almost)\.png|\/game-assets\/fruit\/harvested_bush\.png/i.test(image.currentSrc || image.src || ''));
      const readItemCount = (value) => {
        const match = String(value || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k)?\b/i);
        const amount = Number.parseFloat(match?.[1] || '0');
        return Number.isFinite(amount) ? Math.floor(amount * (match?.[2] ? 1000 : 1)) : 0;
      };
      const quickSlots = () => {
        const column = Array.from(document.querySelectorAll('div.flex.flex-col.items-center')).find((candidate) => Array.from(candidate.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]')).length >= 3);
        return column ? Array.from(column.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]')) : [];
      };
      const normaliseName = (value) => String(value || '').replace(/\s+seed$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      const requestedKey = normaliseName(requestedSeedName);
      const normaliseSource = (value) => String(value || '').trim().replace(/[?#].*$/, '');
      const sameSource = (left, right) => Boolean(left && right && normaliseSource(left) === normaliseSource(right));
      const fruitKeyFromSource = (source) => {
        let decoded = String(source || '');
        try { decoded = decodeURIComponent(decoded); } catch {}
        const nested = decoded.match(/\/(?:fruit|fruits)\/([^/?#]+)\/seed\.(?:png|webp)(?:[?#]|$)/i);
        const flat = decoded.match(/\/(?:fruit|fruits)\/([^/?#]+?)_seed\.(?:png|webp)(?:[?#]|$)/i);
        return normaliseName(nested?.[1] || flat?.[1] || '');
      };
      const isRequestedSeed = (source) => sameSource(source, requestedSeedSource) || Boolean(requestedKey && fruitKeyFromSource(source) === requestedKey);
      const isRequestedBettySeed = (source) => sameSource(source, requestedBettySource) || isRequestedSeed(source);
      const quickSlotForRequestedSeed = () => quickSlots().find((slot) => {
        const image = slot.querySelector('.bg-brown-600 img[alt="item"]');
        return isRequestedSeed(image?.currentSrc || image?.src || '');
      });
      const processedKeys = [];
      if (requestedAction === 'plant') {
        let seedSlot = quickSlotForRequestedSeed();
        if (!seedSlot) {
          const marketPattern = /\/game-assets\/(?:[^/]+\/)*buildings\/(?:[^/]+\/)*(?:bettys_)?market\.(?:webp|png)(?:[?#]|$)/i;
          let seasonSeeds = document.querySelector('#SeasonSeeds');
          if (!seasonSeeds) {
            const marketImage = Array.from(document.querySelectorAll('img')).find((image) => marketPattern.test(image.currentSrc || image.src || ''));
            const target = marketImage?.closest('.cursor-pointer') || marketImage?.parentElement;
            if (!target) return { error: 'Cannot find Betty on the map.' };
            target.click();
            let buyClicked = false;
            for (let attempt = 0; !seasonSeeds && attempt < 150; attempt += 1) {
              const buy = Array.from(document.querySelectorAll('button, div.cursor-pointer')).find((element) => element.textContent.trim() === 'Buy');
              if (buy && !buyClicked) { buy.click(); buyClicked = true; }
              await sleep(20);
              seasonSeeds = document.querySelector('#SeasonSeeds');
            }
          }
          if (!seasonSeeds) return { error: 'Could not open Betty seed list.' };
          const bettySlots = Array.from(seasonSeeds.querySelectorAll('img[alt="item"]'))
            .map((image) => image.closest('.bg-brown-600, .bg-brown-700') || image.closest('.cursor-pointer') || image.parentElement)
            .filter((slot, index, slots) => slot && seasonSeeds.contains(slot) && slots.indexOf(slot) === index);
          let bettyTarget = Number.isInteger(bettySlotIndex) && bettySlotIndex >= 0 ? bettySlots[bettySlotIndex] : null;
          if (bettyTarget) {
            const image = bettyTarget.querySelector('img[alt="item"]');
            if (!isRequestedBettySeed(image?.currentSrc || image?.src || '')) bettyTarget = null;
          }
          if (!bettyTarget) {
            bettyTarget = bettySlots.find((slot) => {
              const image = slot.querySelector('img[alt="item"]');
              return isRequestedBettySeed(image?.currentSrc || image?.src || '');
            });
          }
          if (!bettyTarget) return { error: `Seed unavailable in Betty: ${requestedSeedName}` };
          (bettyTarget.closest('.cursor-pointer') || bettyTarget).click();
          const deadline = Date.now() + 2500;
          while (!quickSlotForRequestedSeed() && Date.now() < deadline) await sleep(50);
          seedSlot = quickSlotForRequestedSeed();
          const bettyDialog = seasonSeeds.closest('div.relative.max-h-\\[90vh\\]')
            || Array.from(document.querySelectorAll('div.relative.max-h-\\[90vh\\]')).find((item) => item.querySelector('#SeasonSeeds'));
          bettyDialog?.querySelector('img[src*="/game-assets/icons/close.png"]')?.click();
          if (seedSlot) await sleep(100);
        }
        if (!seedSlot) return { error: `Seed did not appear on Quick Bar: ${requestedSeedName}` };
        seedSlot.querySelector('.bg-brown-600')?.click();
        let available = 0;
        const seedReadDeadline = Date.now() + 1200;
        while (Date.now() < seedReadDeadline) {
          const image = seedSlot.querySelector('.bg-brown-600 img[alt="item"]');
          if (image && isRequestedSeed(image.currentSrc || image.src || '')) {
            available = readItemCount(seedSlot.textContent);
            if (available) break;
          }
          await sleep(40);
        }
        if (!available) return { error: 'Không còn hạt Fruit để trồng.' };
        let processed = 0;
        for (const key of keys.slice(0, available)) {
          const placement = placements().find((item) => `${item.style.top}|${item.style.left}` === key);
          if (!placement || !isFruit(placement) || !hasSoil(placement)) continue;
          (placement.querySelector('.cursor-pointer') || placement).click();
          processed += 1;
          processedKeys.push(key);
          await sleep(115);
        }
        return { processed, processedKeys, seedName: requestedSeedName, remainingSeeds: Math.max(0, available - processed) };
      }
      if (requestedAction === 'chop') {
        const axeSlot = quickSlots().find((slot) => (slot.querySelector('.bg-brown-600 img[alt="item"]')?.currentSrc || slot.querySelector('.bg-brown-600 img[alt="item"]')?.src || '') === requestedAxe);
        if (axeSlot && Number((axeSlot.textContent.match(/\d[\d,.]*/)?.[0] || '0').replace(/[^\d]/g, '')) > 0) {
          axeSlot.querySelector('.bg-brown-600')?.click();
          await sleep(80);
        }
      }
      let processed = 0;
      for (const key of keys) {
        const placement = placements().find((item) => `${item.style.top}|${item.style.left}` === key);
        if (!placement) continue;
        const eligible = requestedAction === 'chop' ? hasDeadTree(placement) : isFruit(placement) && !hasDeadTree(placement) && !hasSoil(placement) && !hasGrowing(placement);
        if (!eligible) continue;
        (placement.querySelector('.cursor-pointer') || placement).click();
        processed += 1;
        processedKeys.push(key);
        await sleep(130);
      }
      return { processed, processedKeys };
    },
    args: [mapKeys, action, axeIcon, requestedSeedName, requestedSeedSource, requestedBettySource, bettySlotIndex]
  });
  if (result?.error) throw new Error(result.error);
  return result;
}

async function readFruitStates(mapKeys = []) {
  if (!mapKeys.length) return [];
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (keys) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const parseSeconds = (text) => {
        const match = String(text || '').match(/(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:r(?:s)?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s)?)?)?\s*(?:(\d+)\s*s(?:ec(?:s)?)?)?/i);
        if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) return null;
        return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
      };
      await sleep(300);
      return keys.map((mapKey) => {
        const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === mapKey);
        const images = Array.from(placement?.querySelectorAll('img') || []);
        const source = (image) => image.currentSrc || image.src || '';
        const titleCase = (value) => String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
        const crop = images.find((image) => /\/game-assets\/crops\/[^/]+\/(?:seedling|halfway|almost|plant)\.png/i.test(source(image)));
        const tooltipNode = Array.from(placement?.querySelectorAll('div.transition-opacity') || []).find((element) => element.querySelector('span.whitespace-nowrap') && element.querySelector('span.font-secondary'));
        const title = tooltipNode?.querySelector('span.whitespace-nowrap')?.textContent.trim() || '';
        const fruitName = title.match(/^(.+?)\s+(?:Tree\s+)?(?:Growing|Ready|Replenishing)$/i)?.[1] || '';
        const dead = images.find((image) => /\/game-assets\/fruit\/(?:dead_tree|dead_bush|withered_bush|bush_shrub)\.(?:webp|png)/i.test(source(image)));
        const soil = images.find((image) => /\/game-assets\/crops\/soil2\.png/i.test(source(image)));
        const harvestedBush = images.find((image) => /\/game-assets\/fruit\/harvested_bush\.png/i.test(source(image)));
        // The game can leave the old time node mounted for a few frames after
        // a Fruit becomes Ready. The Ready lifecycle label is authoritative;
        // never convert it back to growing just because that stale timer exists.
        const fruitLifecycle = /\bReady\b/i.test(title) ? 'ready'
          : /\b(?:Growing|Replenishing)\b/i.test(title) ? 'growing'
            : 'unknown';
        const tooltipTime = tooltipNode?.innerText || tooltipNode?.textContent || Array.from(placement?.querySelectorAll('div.transition-opacity span.font-secondary') || []).map((node) => node.textContent.trim()).join(' ');
        const mapTimer = Array.from(placement?.querySelectorAll('span.text-white.text-center.font-pixel, span.font-pixel') || []).map((node) => node.textContent.trim()).find((text) => /\d+\s*(?:d|h|hr|m|min|s|sec)/i.test(text));
        const timerText = tooltipTime || mapTimer || placement?.innerText || '';
        const rawSeconds = fruitLifecycle === 'ready' ? null : parseSeconds(timerText);
        const hasPreciseSeconds = /\d+\s*(?:secs?|seconds?)\b/i.test(timerText);
        // Match the Map scanner: a displayed whole minute is rounded up, while
        // a DOM value with seconds stays exact.
        const seconds = Number.isFinite(rawSeconds) ? rawSeconds + (hasPreciseSeconds ? 0 : 60) : null;
        const state = dead ? 'dead' : soil && !crop ? 'empty' : fruitLifecycle === 'ready' ? 'ready'
          : (harvestedBush || crop || fruitLifecycle === 'growing' || Number.isFinite(seconds)) ? 'growing' : 'ready';
        const icon = source(dead || soil || harvestedBush || crop || images.find((image) => !/fruit_patch|stopwatch|empty_bar|progress|\/game-assets\/ui\//i.test(source(image))) || {});
        return { mapKey, state, icon, seconds, label: fruitName ? titleCase(fruitName) : '' };
      });
    },
    args: [mapKeys]
  });
  return Array.isArray(result) ? result : [];
}

function scheduleUnknownFruitTimeRefresh() {
  window.clearTimeout(fruitUnknownTimeRefreshTimer);
  const unknownKeys = Array.from(new Set((lastScanData?.fruit?.growing || [])
    .filter((item) => !Number.isFinite(Number(item.seconds)) || Number(item.seconds) <= 0)
    .flatMap((item) => item.mapKeys || [])));
  if (!unknownKeys.length) return;
  fruitUnknownTimeRefreshTimer = window.setTimeout(async () => {
    try {
      // Use the same complete scanner as the Load Fruit button. The compact
      // state reader can run before the game's tooltip has mounted, whereas
      // this scanner reliably reads the timer on the next rendered frame.
      await scanMap('fruit', { forceTimerRefresh: true });
    } catch { /* The next retry will handle a transient game-DOM update. */ }
    scheduleUnknownFruitTimeRefresh();
  }, 1000);
}
mapActivityContent.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-ui-action]');
  const action = button?.dataset.uiAction;
  if (!['plant-fruit', 'harvest-fruit', 'chop-fruit'].includes(action)) return;
  const card = button.closest('.fruit-card');
  if (!card) return;
  if (action === 'plant-fruit') {
    const allEmptyKeys = Array.from(mapActivityContent.querySelectorAll('.fruit-soil-card[data-map-keys]')).flatMap((soil) => soil.dataset.mapKeys.split('||').filter(Boolean));
    if (allEmptyKeys.length) card.dataset.mapKeys = Array.from(new Set(allEmptyKeys)).join('||');
  }
  const labels = { 'plant-fruit': 'Planting...', 'harvest-fruit': 'Harvesting...', 'chop-fruit': 'Chopping...' };
  setCardLoading(card, labels[action]);
  const finishLog = startActionLog(labels[action]);
  try {
    const result = await interactFruit(card, action === 'plant-fruit' ? 'plant' : action === 'harvest-fruit' ? 'harvest' : 'chop');
    if (!result.processed) logActionError('Không có Fruit phù hợp để thao tác.');
    else {
      if (action === 'plant-fruit') {
        const fruitSeed = selectedFruitSeed;
        if (fruitSeed) {
          const remaining = Number.isFinite(Number(result.remainingSeeds))
            ? Math.max(0, Number(result.remainingSeeds))
            : Math.max(0, Number(fruitSeed.count || 0) - Number(result.processed || 0));
          if (typeof syncSeedPickerCount === 'function') syncSeedPickerCount(fruitSeed.name, remaining);
          const nextSeed = typeof getActiveSeed === 'function' ? getActiveSeed('fruit') : null;
          selectedFruitSeed = nextSeed ? { ...nextSeed } : undefined;
        }
      }
      applyFruitStates(await readFruitStates(result.processedKeys || []), { newlyPlanted: action === 'plant-fruit' });
      scheduleUnknownFruitTimeRefresh();
      renderOverview();
      startCountdowns();
    }
  } catch (error) {
    logActionError(error.message || 'Thao tác Fruit thất bại.');
  } finally {
    finishLog();
    clearCardLoading(card);
  }
});

