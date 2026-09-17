/* Fertilising, profession scans, and overview card actions. */

let resourceToolInventoryLoading = false;

async function openDailyShipment(card) {
  await window.licenseManager.requireTier('silver');
  const mapKey = card?.dataset.mapKeys?.split('||').find(Boolean);
  if (!mapKey) throw new Error('Không xác định được Daily Shipment. Hãy quét Map lại.');
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (key) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const isVisible = (element) => Boolean(element && element.getClientRects().length);
      const waitForRestock = async () => {
        const deadline = Date.now() + 2500;
        while (Date.now() < deadline) {
          const button = Array.from(document.querySelectorAll('button')).find((item) => isVisible(item) && !item.disabled && item.textContent.trim() === 'Replenish stock');
          if (button) return button;
          await sleep(50);
        }
        return null;
      };
      const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === key);
      const image = Array.from(placement?.querySelectorAll('img') || []).find((item) => (item.currentSrc || item.src || '').startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAsCAYAAADctB6FAAAAAXNSR0IArs4c6QAACcBJREFUaIHdmn9QlHUex1+r'));
      if (!image) return { opened: false, restocked: false };
      image.click();
      const restockButton = await waitForRestock();
      if (!restockButton) return { opened: true, restocked: false };
      restockButton.click();
      return { opened: true, restocked: true };
    },
    args: [mapKey]
  });
  return result || { opened: false, restocked: false };
}

async function fertiliseGrowingCard(card, fertiliserIndex) {
  await window.licenseManager.requireTier('silver');
  const cropName = card.dataset.cropName;
  const resource = card.dataset.resource || 'crop';
  const fertiliserSource = (resource === 'fruit' ? fruitFertiliserIcons : cropFertiliserIcons)[fertiliserIndex];
  const timeGroup = Number(card.dataset.timeGroup);
  const expectedCount = Number(card.dataset.count);
  const mapKeys = card.dataset.mapKeys ? card.dataset.mapKeys.split('||').filter(Boolean) : [];
  if (!fertiliserSource || !cropName || !Number.isFinite(timeGroup)) throw new Error('Không xác định được nhóm cây cần bón phân. Hãy quét Map lại.');
  const knownCount = Math.max(0, Number(fertiliserCounts.get(fertiliserSource)) || 0);
  if (knownCount === 0) throw new Error('Không còn loại phân bón này.');
  const tab = await findSunflowerTab();
  if (!tab?.id) throw new Error('Không tìm thấy tab Sunflower Land đang mở.');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async (requestedFertiliser, requestedCrop, requestedGroup, requestedMapKeys, maximum, requestedResource) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const normalise = (value) => value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const parseSeconds = (text) => {
        const match = String(text || '').replace(/\b(\d+)\s*hsr\b/gi, '$1hrs').match(/\b(?=\d+\s*(?:d(?:ays?)?|h(?:r(?:s)?|ours?)?|m(?:in(?:s)?)?|s(?:ec(?:s)?)?))(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:r(?:s)?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s)?)?)?\s*(?:(\d+)\s*s(?:ec(?:s)?)?)?/i);
        if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) return null;
        return Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
      };
      const getFertiliserType = (placement) => {
        const sources = Array.from(placement.querySelectorAll('img')).map((image) => image.currentSrc || image.src || '');
        return sources.some((source) => source.startsWith('data:image/webp;base64,UklGRpAAAABXRUJQVlA4TIMAAAAvD0AC')) ? 2
          : sources.some((source) => source.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAICAYAAADA+m62')) ? 1
            : sources.some((source) => source.includes('/icons/stopwatch.png')) ? 2
              : sources.some((source) => source.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAN')) ? 1 : 0;
      };
      const quickColumn = Array.from(document.querySelectorAll('div.flex.flex-col.items-center')).find((column) => Array.from(column.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]')).length >= 3);
      const quickSlots = quickColumn ? Array.from(quickColumn.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]')) : [];
      const quickSlotFor = (source) => quickSlots.find((slot) => {
        const image = slot.querySelector('.bg-brown-600 img[alt="item"]');
        return (image?.currentSrc || image?.src || '') === source;
      });
      const quickFertiliser = quickSlotFor(requestedFertiliser);
      let fertiliserSelected = false;
      if (quickFertiliser) {
        quickFertiliser.querySelector('.bg-brown-600')?.click();
        fertiliserSelected = true;
        await sleep(180);
      }
      if (!fertiliserSelected) {
        const search = document.querySelector('input[placeholder="Search here..."]');
        if (!search) {
        const basket = Array.from(document.querySelectorAll('img[src*="/game-assets/icons/basket.png"]')).find((image) => image.closest('div.relative.flex.mb-2.cursor-pointer'));
        const basketButton = basket?.closest('div.relative.flex.mb-2.cursor-pointer');
        if (!basketButton) return { error: 'Không tìm thấy nút mở túi đồ.' };
        basketButton.click();
        await sleep(400);
        }
        const bagSearch = document.querySelector('input[placeholder="Search here..."]');
        const bagRoot = bagSearch?.closest('div.relative.max-h-\\[90vh\\]') || bagSearch?.parentElement?.parentElement?.parentElement;
        const closeBag = () => {
          const closeButton = bagRoot?.querySelector('img[src*="/game-assets/icons/close.png"]') || Array.from(document.querySelectorAll('img[src*="/game-assets/icons/close.png"]')).find((image) => image.closest('div.relative.max-h-\\[90vh\\]'));
          closeButton?.click();
          return Boolean(closeButton);
        };
        const fertiliserHeader = Array.from(document.querySelectorAll('div')).find((element) => element.textContent.trim() === 'Fertilisers');
        const fertiliserSection = fertiliserHeader?.parentElement;
        const fertiliserSlot = fertiliserSection && Array.from(fertiliserSection.querySelectorAll('.bg-brown-600')).find((slot) => {
          const image = slot.querySelector('img[alt="item"]');
          return image && (image.currentSrc || image.src || '') === requestedFertiliser;
        });
        if (!fertiliserSlot) return { error: 'Không tìm thấy loại phân bón này trong túi đồ.', closed: closeBag() };
        fertiliserSlot.click();
        await sleep(180);
        if (!closeBag()) return { error: 'Không tìm thấy nút đóng túi đồ.' };
        await sleep(250);
      }
      const requestedName = normalise(requestedCrop).toLowerCase();
      const candidates = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).map((placement) => {
        const cropImage = Array.from(placement.querySelectorAll('img')).find((image) => /\/game-assets\/crops\/([^/]+)\/(seedling|halfway|almost)\.png/i.test(image.currentSrc || image.src || ''));
        const match = cropImage && (cropImage.currentSrc || cropImage.src || '').match(/\/game-assets\/crops\/([^/]+)\/(seedling|halfway|almost)\.png/i);
        const isFruitPatch = Array.from(placement.querySelectorAll('img')).some((image) => /\/game-assets\/(?:[^/]+\/)?fruit\/fruit_patch\.(?:webp|png)(?:[?#]|$)/i.test(image.currentSrc || image.src || ''));
        const seconds = parseSeconds(placement.innerText);
        const group = seconds === null ? null : (Math.floor(seconds / 60) + 1) * 60;
        const fruitSprite = requestedResource === 'fruit' && Array.from(placement.querySelectorAll('img')).find((image) => {
          const source = image.currentSrc || image.src || '';
          return !/fruit_patch|soil2|empty_bar|stopwatch|selectbox|progress|\/game-assets\/ui\//i.test(source);
        });
        const target = requestedResource === 'fruit'
          ? fruitSprite?.parentElement || placement
          : placement.querySelector('.cursor-pointer');
        const placementKey = `${placement.style.top}|${placement.style.left}`;
        const matchesResource = requestedResource === 'fruit' ? isFruitPatch : Boolean(match) && normalise(match[1]).toLowerCase() === requestedName;
        return matchesResource && target && getFertiliserType(placement) === 0 ? { placement, target, placementKey, group } : null;
      }).filter(Boolean);
      const exactTargets = candidates.filter((item) => requestedMapKeys.includes(item.placementKey));
      const targets = (exactTargets.length ? exactTargets : candidates.filter((item) => item.group !== null && Math.abs(item.group - requestedGroup) <= 5)).slice(0, maximum);
      if (!targets.length) return { error: 'Không còn cây phù hợp trong card này để bón phân. Hãy quét Map lại.' };
      let applied = 0;
      for (const { target } of targets) {
        target.click();
        applied += 1;
        await sleep(100);
      }
      await sleep(300);
      return { applied, fertilisedKeys: targets.slice(0, applied).map((item) => item.placementKey) };
    },
    args: [fertiliserSource, cropName, timeGroup, mapKeys, Math.min(expectedCount, knownCount), resource]
  });
  if (result?.error) throw new Error(result.error);
  fertiliserCounts.set(fertiliserSource, Math.max(0, knownCount - Number(result?.applied || 0)));
  if (result?.applied) applyFertiliserResult(resource, result.fertilisedKeys || [], fertiliserIndex + 1);
  return result;
}

let activeFertiliserSelection = null;
let fertiliserSelectionBackdrop = null;

function clearFertiliserSelection() {
  overviewResults.querySelectorAll('.is-fertiliser-selection-target').forEach((card) => {
    card.classList.remove('is-fertiliser-selection-target');
    card.querySelector('.fertiliser-selection-overlay')?.remove();
  });
  fertiliserSelectionBackdrop?.remove();
  fertiliserSelectionBackdrop = null;
  activeFertiliserSelection = null;
}

function beginFertiliserSelection(button) {
  const resource = button.dataset.resource === 'fruit' ? 'fruit' : 'crop';
  const fertiliserIndex = Number(button.dataset.fertiliserIndex);
  const icon = (resource === 'fruit' ? fruitFertiliserIcons : cropFertiliserIcons)[fertiliserIndex];
  const available = Math.max(0, Number(fertiliserCounts.get(icon)) || 0);
  if (!available) return;

  clearFertiliserSelection();
  const targets = Array.from(overviewResults.querySelectorAll(`.overview-profession-card[data-profession="${resource}"] .crop-card.is-growing[data-resource="${resource}"][data-fertilised="false"]`)).filter((card) => Math.max(0, Number(card.dataset.count) || 0) > 0);
  if (!targets.length) return;

  activeFertiliserSelection = { resource, fertiliserIndex, available };
  fertiliserSelectionBackdrop = document.createElement('button');
  fertiliserSelectionBackdrop.type = 'button';
  fertiliserSelectionBackdrop.className = 'fertiliser-selection-backdrop';
  fertiliserSelectionBackdrop.setAttribute('aria-label', 'Hủy chọn phân bón');
  fertiliserSelectionBackdrop.addEventListener('click', clearFertiliserSelection, { once: true });
  document.body.append(fertiliserSelectionBackdrop);

  targets.forEach((card) => {
    const amount = Math.min(available, Math.max(0, Number(card.dataset.count) || 0));
    card.classList.add('is-fertiliser-selection-target');
    card.insertAdjacentHTML('beforeend', `<span class="fertiliser-selection-overlay">Fertilize x${amount}</span>`);
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeFertiliserSelection) clearFertiliserSelection();
});

mapActivityContent.addEventListener('click', async (event) => {
  const card = event.target.closest('.crop-card.is-fertiliser-selection-target');
  const selection = activeFertiliserSelection;
  if (!card || !selection) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  clearFertiliserSelection();
  setCardLoading(card, 'Fertilizing...');
  const finishLog = startActionLog('Fertilizing...');
  try {
    const result = await fertiliseGrowingCard(card, selection.fertiliserIndex);
    if (!result.applied) logActionError('Không có cây nào được bón phân.');
    renderOverview();
    startCountdowns();
  } catch (error) {
    logActionError(error.message || 'Bón phân thất bại.');
  } finally {
    finishLog();
    clearCardLoading(card);
  }
});

mapActivityContent.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-ui-action]');
  const action = button?.dataset.uiAction;
  if (!action) return;
  if (action === 'fertilise' && button.closest('#crop-growing-results')) return;
  if (action === 'chop' || action === 'mine') return;
  if (action === 'toggle-profession-auto') {
    const profession = button.dataset.profession;
    if (!profession) return;
    if (profession === 'crop' && !professionAutoEnabled.has('crop') && !plantingOrderFor('crop').length) {
      void openSeedPicker('crop', 'planting-order');
      return;
    }
    if (professionAutoEnabled.has(profession)) {
      professionAutoEnabled.delete(profession);
      if (profession === 'crop' && typeof stopAutoCrop === 'function') stopAutoCrop();
    } else {
      professionAutoEnabled.add(profession);
      if (profession === 'crop' && typeof startAutoCrop === 'function') startAutoCrop();
    }
    await chrome.storage.local.set({ [PROFESSION_AUTO_STORAGE_KEY]: [...professionAutoEnabled] });
    renderOverview();
    return;
  }
  if (action === 'scan-fertilisers') {
    setCardLoading(button, 'Processing...');
    try {
      scanFertilisersButton.click();
      const startDeadline = Date.now() + 2000;
      while (!scanFertilisersButton.disabled && Date.now() < startDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const deadline = Date.now() + 20000;
      while (scanFertilisersButton.disabled && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
    } finally {
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'open-daily-shipment') {
    setCardLoading(button, 'Restocking...');
    const finishLog = startActionLog('Restocking for free...');
    try {
      const result = await openDailyShipment(button.closest('.daily-shipment-card'));
      if (!result.opened) logActionError('Không tìm thấy Daily Shipment trên Map. Hãy quét lại.');
      else if (!result.restocked) logActionError('Đã mở Daily Shipment nhưng không thấy nút Replenish stock.');
      else {
        await new Promise((resolve) => setTimeout(resolve, 350));
        await scanMap();
      }
    } catch (error) {
      logActionError(error.message || 'Không thể mở Daily Shipment.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'select-fertiliser') {
    beginFertiliserSelection(button);
    return;
  }
  if (action === 'scan-map-header') {
    setCardLoading(button, 'Processing...');
    const finishLog = startActionLog('Scanning map...');
    try {
      if (!await scanMap()) logActionError('Không thể quét Map.');
    } catch (error) {
      logActionError(error.message || 'Không thể quét Map.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'scan-profession') {
    const scope = button.dataset.scanScope;
    const labels = { crop: 'Crop', fruit: 'Fruit', tree: 'Tree', mining: 'Mining', salt: 'Salt', resources: 'Resources', mushroom: 'Nấm', pet: 'Pet' };
    const label = labels[scope] || 'nghề này';
    setCardLoading(button, 'Processing...');
    const finishLog = startActionLog(`Scanning ${label}...`);
    try {
      const scanned = scope === 'resources'
        ? await (async () => {
          for (const resourceScope of ['tree', 'mining', 'salt']) {
            if (!await scanMap(resourceScope)) return false;
          }
          return true;
        })()
        : await scanMap(scope, scope === 'fruit' ? { forceTimerRefresh: true } : {});
      if (!scanned) logActionError(`Không thể quét ${label}.`);
    } catch (error) {
      logActionError(error.message || `Không thể quét ${label}.`);
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'wake-pet') {
    const card = button.closest('.pet-card');
    const petName = card?.querySelector('.crop-card-title')?.textContent?.trim() || 'Pet';
    setCardLoading(button, 'Waking...');
    const finishLog = startActionLog(`Waking ${petName}...`);
    let completedMessage = '';
    try {
      const result = await wakeSleepingPets(card);
      if (!result.awakened) logActionError(`Không tìm thấy ${petName} đang ngủ.`);
      else {
        completedMessage = `Đánh thức x${result.awakened} ${petName}`;
        markPetsAwake(result.awakenedKeys || [], result.awakenedPets || []);
      }
    } catch (error) {
      logActionError(error.message || `Không thể đánh thức ${petName}.`);
    } finally {
      finishLog(completedMessage);
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'harvest-mushrooms') {
    setCardLoading(button, 'Harvesting...');
    const finishLog = startActionLog('Harvesting mushrooms...');
    try {
      const result = await harvestMushrooms(button.closest('.mushroom-card'));
      if (!result.harvested) logActionError('Không tìm thấy nấm sẵn sàng thu hoạch.');
      refreshAffectedSection(button.closest('.mushroom-card'), ['mushroom']);
    } catch (error) {
      logActionError(error.message || 'Thu hoạch nấm thất bại.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'harvest-salt') {
    if (!toolBagScanned) {
      logActionError('Tính năng đọc Tool đã được gỡ.');
      return;
    }
    setCardLoading(button, 'Mining...');
    const finishLog = startActionLog('Mining salt...');
    try {
      const result = await harvestSalt(button.closest('.salt-card'), Number(button.dataset.requestedSaltHits));
      if (!result.used) logActionError('Không có ô Salt sẵn sàng khai thác.');
      else {
        advanceHarvestedSalt(result.processedKeys || [], result.hitsPerSalt);
        renderOverview();
        startCountdowns();
        // Salt changes from ready to replenishing after its final hit. Read
        // the game again immediately so the new card receives its real timer.
        if (!await scanMap('salt')) logActionError('Không thể quét lại Salt để cập nhật thời gian.');
      }
    } catch (error) {
      logActionError(error.message || 'Khai thác Salt thất bại.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'scan-composter') {
    setCardLoading(button, 'Processing...');
    const finishLog = startActionLog('Scanning composters...');
    try {
      applyComposterStates(await readComposterStates());
      const result = await scanComposterDetails();
      result.details.forEach((detail) => composterDetails.set(detail.mapKey, {
        seconds: detail.seconds,
        requirements: detail.requirements || [],
        recipe: detail.requirements || [],
        canCompost: detail.canCompost,
        updatedAt: Date.now()
      }));
      if (!result.details.length) logActionError(result.found ? `Composter: click ${result.trace?.clicked || 0}, đọc ${result.trace?.read || 0}, đóng ${result.trace?.closed || 0}.` : 'Không tìm thấy Composter trên DOM game.');
      renderOverview();
      startCountdowns();
    } catch (error) {
      logActionError(error.message || 'Quét Composter thất bại.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'collect-composter' || action === 'compost') {
    const label = action === 'collect-composter' ? 'Collect' : 'Compost';
    const composterCard = button.closest('.composter-card');
    setCardLoading(composterCard || button, `${label}ing...`);
    const finishLog = startActionLog(`${label} composting...`);
    try {
      const result = await interactComposters(composterCard, label);
      if (!result.processed) logActionError(`Không có Composter để ${label}.`);
      else if (action === 'collect-composter') {
        // Requirements are read while the just-collected composter is still open.
        // Do not scan every composter here: that would reopen and close their panels.
        moveCollectedCompostersToEmpty(result.processedKeys || []);
        // The map sprite can remain in its old ready frame briefly after Collect.
        // Keep the confirmed local transition instead of letting that stale frame
        // overwrite the new empty card.
        (result.details || []).forEach((detail) => composterDetails.set(detail.mapKey, {
          seconds: detail.seconds,
          requirements: detail.requirements || [],
          recipe: detail.requirements || [],
          canCompost: detail.canCompost,
          updatedAt: Date.now()
        }));
      }
      else if (action === 'compost') moveStartedCompostersToGrowing(result.processedKeys || [], result.details || []);
      if (action === 'compost') {
        // The game updates the Composter sprite after its click animation.
        // Read the map again so the card uses the authoritative new icon/state.
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (!await scanMap()) logActionError('Không thể quét lại Map sau khi Compost.');
      }
      renderOverview();
      startCountdowns();
    } catch (error) {
      logActionError(error.message || `${label} Composter thất bại.`);
      renderOverview();
    } finally {
      finishLog();
      clearCardLoading(composterCard || button);
    }
    return;
  }
  if (action === 'harvest') {
    setCardLoading(button, 'Harvesting...');
    const finishLog = startActionLog('Harvesting...');
    try {
      const result = await harvestCrops(button.closest('.crop-card'));
      if (result.stopped) logActionError(`Thu hoạch dừng vì mini game ${result.stopped}.`);
      else if (!result.harvested) logActionError('Không có Crop sẵn sàng thu hoạch.');
      if (result.harvested) {
        moveHarvestedCropsToEmpty(result.harvestedKeys || []);
        renderOverview();
        startCountdowns();
      }
    } catch (error) {
      logActionError(error.message || 'Thu hoạch Crop thất bại.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
  if (action === 'plant') {
    const cardElement = button.closest('.crop-card') || button;
    const cardSeedName = cardElement?.dataset?.selectedSeed || '';
    let seedToPlant = null;
    if (selectedPlantSeed && selectedPlantSeed.name && (!cardSeedName || selectedPlantSeed.name === cardSeedName)) {
      seedToPlant = selectedPlantSeed;
    } else if (cardSeedName && typeof seedBarCache !== 'undefined') {
      const entryKey = typeof seedPickerKey === 'function' ? seedPickerKey(cardSeedName) : '';
      const entry = seedBarCache.get(entryKey);
      if (entry) seedToPlant = entry;
    }
    if (!seedToPlant) {
      const activePlantSeed = typeof getActiveSeed === 'function' ? getActiveSeed('crop') : null;
      if (activePlantSeed) seedToPlant = activePlantSeed;
    }
    if (!seedToPlant) {
      logActionError('Hãy chọn hạt tại card Chọn hạt trước khi trồng.');
      return;
    }
    selectedPlantSeed = { ...seedToPlant };
    const requestedSeedName = selectedPlantSeed.name || '';
    const requestedMapKeys = cardElement?.dataset?.mapKeys?.split('||').filter(Boolean) || [];
    setCardLoading(button, 'Planting...');
    const finishLog = startActionLog('Planting...');
    try {
      const tab = await findSunflowerTab();
      if (!tab?.id) throw new Error('Không tìm thấy tab Sunflower Land đang mở.');
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (requestedFertiliserType, requestedSeedName, requestedMapKeys, bettySlotIndex) => {
          const soilSelector = 'img[src*="/game-assets/crops/soil2.png"]';
          const titleCase = (value) => value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()).replace(/^Brocolli$/i, 'Broccoli');
          // Quick-slot labels abbreviate large stacks as 1k, 1.5k, … .
          // Reading only the first digits caused Auto Crop to plant one tile.
          const readItemCount = (value) => {
            const match = String(value || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k)?\b/i);
            const amount = Number.parseFloat(match?.[1] || '0');
            return Number.isFinite(amount) ? Math.floor(amount * (match?.[2] ? 1000 : 1)) : 0;
          };
          const quickSlots = () => {
            const quickSelectColumn = Array.from(document.querySelectorAll('div.flex.flex-col.items-center')).find((column) => Array.from(column.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]')).length >= 3);
            return quickSelectColumn ? Array.from(quickSelectColumn.children).filter((child) => child.classList.contains('relative') && child.querySelector('.bg-brown-600 img[alt="item"]')) : [];
          };
          const cropSlugKey = (value) => {
            let decodedValue = String(value || '');
            try { decodedValue = decodeURIComponent(decodedValue); } catch {}
            return decodedValue
              .replace(/\s+seed$/i, '')
              .trim()
              .replace(/[_-]+/g, ' ')
              .replace(/\s+/g, ' ')
              .toLowerCase()
              .replace(/broccoli/g, 'brocolli');
          };
          const requestedCrop = cropSlugKey(requestedSeedName);
          const cropIconDetails = (source) => {
            const match = String(source || '').match(/\/game-assets\/crops\/([^/]+)\/(seed|crop)\.png(?:[?#]|$)/i);
            return match ? { crop: cropSlugKey(match[1]), type: match[2].toLowerCase() } : null;
          };
          const isRequestedSeed = (source) => {
            const details = cropIconDetails(source);
            return Boolean(details && details.type === 'seed' && (!requestedCrop || details.crop === requestedCrop));
          };
          const isRequestedBettySeed = (source) => {
            const details = cropIconDetails(source);
            return Boolean(details && (!requestedCrop || details.crop === requestedCrop));
          };
          const quickSlotForRequestedSeed = () => quickSlots().find((slot) => {
            const source = slot.querySelector('.bg-brown-600 img[alt="item"]')?.currentSrc || slot.querySelector('.bg-brown-600 img[alt="item"]')?.src || '';
            return isRequestedSeed(source);
          });
          let seedSlot = quickSlots().find((slot) => {
            const source = slot.querySelector('.bg-brown-600 img[alt="item"]')?.currentSrc || slot.querySelector('.bg-brown-600 img[alt="item"]')?.src || '';
            return isRequestedSeed(source);
          });
          if (!seedSlot) {
            // Open Betty market and select seed by remembered slot index
            const marketPattern = /\/game-assets\/(?:[^/]+\/)*buildings\/(?:[^/]+\/)*(?:bettys_)?market\.(?:webp|png)(?:[?#]|$)/i;
            let seasonSeeds = document.querySelector('#SeasonSeeds');
            if (!seasonSeeds) {
              const marketImage = Array.from(document.querySelectorAll('img')).find((image) => marketPattern.test(image.currentSrc || image.src || ''));
              const target = marketImage?.closest('.cursor-pointer') || marketImage?.parentElement;
              if (!target) return { clicked: 0, emptyCounts: [], growing: [], error: 'Cannot find Betty on the map.' };
              target.click();
              let buyClicked = false;
              for (let attempt = 0; !seasonSeeds && attempt < 150; attempt += 1) {
                const buy = Array.from(document.querySelectorAll('button, div.cursor-pointer')).find((el) => el.textContent.trim() === 'Buy');
                if (buy && !buyClicked) { buy.click(); buyClicked = true; }
                await new Promise((resolve) => setTimeout(resolve, 20));
                seasonSeeds = document.querySelector('#SeasonSeeds');
              }
            }
            if (!seasonSeeds) return { clicked: 0, emptyCounts: [], growing: [], error: 'Could not open Betty seed list.' };
            const bettySlots = Array.from(seasonSeeds.querySelectorAll('img[alt="item"]'))
              .map((image) => image.closest('.bg-brown-600, .bg-brown-700') || image.closest('.cursor-pointer') || image.parentElement)
              .filter((slot, index, slots) => slot && seasonSeeds.contains(slot) && slots.indexOf(slot) === index);
            let bettyTarget = bettySlotIndex >= 0 ? bettySlots[bettySlotIndex] : null;
            if (bettyTarget) {
              const src = bettyTarget.querySelector('img[alt="item"]')?.currentSrc || bettyTarget.querySelector('img[alt="item"]')?.src || '';
              if (!isRequestedBettySeed(src)) bettyTarget = null;
            }
            if (!bettyTarget) {
              bettyTarget = bettySlots.find((slot) => {
                const src = slot.querySelector('img[alt="item"]')?.currentSrc || slot.querySelector('img[alt="item"]')?.src || '';
                return isRequestedBettySeed(src);
              });
            }
            if (bettyTarget) {
              (bettyTarget.closest('.cursor-pointer') || bettyTarget).click();
              const deadline = Date.now() + 2500;
              while (!quickSlotForRequestedSeed() && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 50));
              }
            }
            seedSlot = quickSlotForRequestedSeed();
            if (seedSlot) {
              const bettyDialog = seasonSeeds.closest('div.relative.max-h-\\[90vh\\]')
                || Array.from(document.querySelectorAll('div.relative.max-h-\\[90vh\\]')).find((item) => item.querySelector('#SeasonSeeds'));
              bettyDialog?.querySelector('img[src*="/game-assets/icons/close.png"]')?.click();
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }
          if (!seedSlot) return { clicked: 0, emptyCounts: [], growing: [], error: `Seed unavailable in Betty: ${requestedSeedName}` };
          seedSlot.querySelector('.bg-brown-600')?.click();
          // Quick Bar can still display the previously held item immediately
          // after a switch. Wait until it contains the requested seed so a
          // batch cannot plant the old item or skip the next seed in order.
          let heldItem = null;
          let seedCount = 0;
          const seedReadDeadline = Date.now() + 800;
          while (Date.now() < seedReadDeadline) {
            heldItem = seedSlot.querySelector('.bg-brown-600 img[alt="item"]');
            const heldSource = heldItem?.currentSrc || heldItem?.src || '';
            if (heldItem && isRequestedSeed(heldSource)) {
              seedCount = readItemCount(seedSlot.textContent);
              if (seedCount) break;
            }
            await new Promise((resolve) => setTimeout(resolve, 40));
          }
          if (!seedCount || !heldItem) return { clicked: 0, emptyCounts: [], growing: [], error: 'Không còn hạt giống để trồng.' };
          const seedSource = heldItem.currentSrc || heldItem.src;
          const seedMatch = seedSource.match(/\/crops\/([^/]+)\/seed\.png/i);
          const getFertiliserType = (placement) => {
            const sources = Array.from(placement.querySelectorAll('img')).map((image) => image.currentSrc || image.src || '');
            return sources.some((source) => source.includes('/icons/stopwatch.png')) ? 2 : sources.some((source) => source.startsWith('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAN')) ? 1 : 0;
          };
          const requestedKeys = new Set(requestedMapKeys || []);
          const cropSoilTarget = (placement) => Array.from(placement.querySelectorAll('div')).find((element) => element.classList.contains('cursor-pointer') && element.classList.contains('hover:img-highlight') && element.querySelector(soilSelector));
          const targets = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).map((placement) => {
            const key = `${placement.style.top}|${placement.style.left}`;
            const target = cropSoilTarget(placement);
            return target ? { key, target, fertiliserType: getFertiliserType(placement) } : null;
          }).filter((item) => item && (requestedKeys.size ? requestedKeys.has(item.key) : item.fertiliserType === requestedFertiliserType)).slice(0, seedCount);
          globalThis.__sunflowerToolsPlanting = true;
          globalThis.__sunflowerToolsIgnoreMapMutationsUntil = Date.now() + Math.max(4000, targets.length * 95 + 2000);
          try {
            for (const targetInfo of targets) {
              const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((item) => `${item.style.top}|${item.style.left}` === targetInfo.key);
              const currentTarget = placement && cropSoilTarget(placement);
              if (!currentTarget) continue;
              currentTarget.click();
              await new Promise((resolve) => setTimeout(resolve, 60));
            }
          } finally {
            globalThis.__sunflowerToolsPlanting = false;
          }
          const hasRenderedCrop = (placement) => Array.from(placement?.querySelectorAll('img') || []).some((image) => /\/game-assets\/crops\/[^/]+\/(seedling|halfway|almost)\.png/i.test(image.currentSrc || image.src || '')) && /\b\d+\s*(?:h|hr|hrs|hour|hours|m|min|mins|s|sec|secs)\b/i.test(placement?.innerText || '');
          // Chỉ đọc lại đúng các ô vừa trồng; chờ game render timer thực tế trước khi nhóm card.
          const maxPlantRenderAttempts = Math.max(10, Math.min(20, Math.ceil(targets.length / 2)));
          for (let attempt = 0; attempt < maxPlantRenderAttempts; attempt += 1) {
            const refreshedPlacements = Array.from(document.querySelectorAll('div[data-map-placement="true"]'));
            const renderedCount = targets.filter((targetInfo) => hasRenderedCrop(refreshedPlacements.find((item) => `${item.style.top}|${item.style.left}` === targetInfo.key))).length;
            if (renderedCount === targets.length) break;
            await new Promise((resolve) => setTimeout(resolve, 180));
          }
          await new Promise((resolve) => setTimeout(resolve, 80));
          const placements = Array.from(document.querySelectorAll('div[data-map-placement="true"]'));
          const parseSeconds = (text) => {
            const match = text.replace(/\b(\d+)\s*hsr\b/gi, '$1hrs').match(/\b(?=\d+\s*(?:d(?:ays?)?|h(?:r(?:s)?|ours?)?|m(?:in(?:s)?)?|s(?:ec(?:s)?)?))(?:(\d+)\s*d(?:ays?)?)?\s*(?:(\d+)\s*h(?:r(?:s)?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s)?)?)?\s*(?:(\d+)\s*s(?:ec(?:s)?)?)?/i);
            if (!match || (!match[1] && !match[2] && !match[3] && !match[4])) return { seconds: null, hasSeconds: false };
            return {
              seconds: Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0),
              hasSeconds: Boolean(match[4])
            };
          };
          const groupingWindow = (seconds) => seconds < 60 ? 20 : seconds < 3600 ? 30 : 60;
          const plantedEntries = [];
          const plantedTargets = [];
          targets.forEach((targetInfo) => {
            const placement = placements.find((item) => `${item.style.top}|${item.style.left}` === targetInfo.key);
            const image = placement && Array.from(placement.querySelectorAll('img')).find((item) => /\/game-assets\/crops\/([^/]+)\/(seedling|halfway|almost)\.png/i.test(item.currentSrc || item.src || ''));
            const match = image && (image.currentSrc || image.src).match(/\/game-assets\/crops\/([^/]+)\/(seedling|halfway|almost)\.png/i);
            if (!match) return;
            plantedTargets.push(targetInfo);
            const tooltipTime = Array.from(placement.querySelectorAll('div.transition-opacity span.font-secondary')).map((element) => element.textContent.trim()).find((text) => /^\d+\s*(?:day|d|hr|h|min|m|sec|s)/i.test(text)) || '';
            const timerText = Array.from(placement.querySelectorAll('span.text-white.text-center.font-pixel')).map((element) => element.textContent.trim()).find((text) => /\d+\s*(?:d|h|m|s)/i.test(text)) || '';
            const time = parseSeconds(tooltipTime || timerText);
            plantedEntries.push({
              label: titleCase(match[1]),
              icon: image.currentSrc || image.src,
              count: 1,
              // Fertiliser state belongs to the empty soil card selected for
              // planting. A newly planted crop must start unfertilised; only
              // an explicit fertilise action can move it to that card.
              fertilised: false,
              fertiliserType: 0,
              bee: false,
              stage: match[2],
              seconds: time.seconds,
              timeGroup: time.seconds ?? 'unknown',
              hasPreciseSeconds: time.hasSeconds,
              mapKeys: [targetInfo.key]
            });
          });
          const plantedGroups = [];
          plantedEntries.sort((left, right) => (right.seconds || 0) - (left.seconds || 0)).forEach((entry) => {
            const group = plantedGroups.find((candidate) => candidate.label === entry.label && candidate.fertiliserType === entry.fertiliserType && ((Number.isFinite(candidate.seconds) && Number.isFinite(entry.seconds) && Math.abs(candidate.seconds - entry.seconds) <= groupingWindow(Math.max(candidate.seconds, entry.seconds))) || (!Number.isFinite(candidate.seconds) && !Number.isFinite(entry.seconds))));
            if (group) {
              group.count += entry.count;
              group.mapKeys.push(...entry.mapKeys);
            } else plantedGroups.push({ ...entry, mapKeys: [...entry.mapKeys] });
          });
          const emptyByType = new Map();
          plantedTargets.forEach(({ fertiliserType }) => emptyByType.set(fertiliserType, (emptyByType.get(fertiliserType) || 0) + 1));
          return { clicked: plantedTargets.length, emptyCounts: Array.from(emptyByType, ([fertiliserType, count]) => ({ fertiliserType, count })), growing: plantedGroups, seedName: seedMatch ? titleCase(seedMatch[1]) : 'Hạt giống', remainingSeeds: Math.max(0, seedCount - plantedTargets.length) };
        },
        args: [Number(cardElement?.dataset?.targetFertiliserType || button.dataset.targetFertiliserType || 0), requestedSeedName, requestedMapKeys, typeof seedBarCache !== 'undefined' ? (seedBarCache.get(typeof seedPickerKey === 'function' ? seedPickerKey(requestedSeedName) : requestedSeedName.replace(/\s+seed$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase())?.slotIndex ?? -1) : -1]
      });
      if (result.error) throw new Error(result.error);
      if (!result.clicked) logActionError('Không tìm thấy ô Crop trống thuộc nhóm đã chọn.');
      applyPlantResult(result);
      if (result.clicked) {
        renderOverview();
        startCountdowns();
      }
    } catch (error) {
      logActionError(error.message || 'Trồng Crop thất bại.');
    } finally {
      finishLog();
      clearCardLoading(button);
    }
    return;
  }
});
