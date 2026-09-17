/* Crop harvesting and Tree action interaction handlers. */

async function harvestCrops(card) {
  await window.licenseManager.requireTier('silver');
  const mapKeys = card.dataset.mapKeys ? card.dataset.mapKeys.split('||').filter(Boolean) : [];
  if (!mapKeys.length) throw new Error('Không xác định được Crop của card này. Hãy quét Map lại.');
  const [{ result }] = await executeOnSunflowerTabs({
    world: 'MAIN',
    func: async (keys) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const openPanels = () => Array.from(document.querySelectorAll('[data-headlessui-state="open"], [data-open]')).filter((panel) => panel.offsetParent !== null);
      const miniGame = () => {
        const markers = [
          ['Tap the chest to open it', 'Chest'],
          ['Stop the Goblins!', 'Goblins'],
          ['Stop the Moon Seekers!', 'Moon Seekers']
        ];
        for (const panel of openPanels()) {
          const text = Array.from(panel.querySelectorAll('span')).map((span) => span.textContent.trim()).find((value) => markers.some(([marker]) => value === marker));
          const match = markers.find(([marker]) => marker === text);
          if (match) return { panel, name: match[1] };
        }
        return null;
      };
      const closeReward = () => {
        const panel = openPanels().find((candidate) => candidate.innerText.includes('Reward Discovered'));
        const button = panel && Array.from(panel.querySelectorAll('button')).find((candidate) => candidate.offsetParent !== null && candidate.innerText.trim() === 'Close');
        if (!button) return false;
        button.click();
        return true;
      };
      const clickChest = () => {
        const dialog = Array.from(document.querySelectorAll('[data-headlessui-state="open"]')).find((panel) => panel.offsetParent !== null && panel.innerText.includes('Tap the chest to open it'));
        // DOM đã xác nhận ảnh chest luôn là img.absolute.w-16 trong popup mở.
        const chest = dialog?.querySelector('img.absolute.w-16') || document.querySelector('img.absolute.w-16');
        if (!chest) return false;
        const rect = chest.getBoundingClientRect();
        const eventOptions = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
        // Gửi trực tiếp lên ảnh Chest được nhận diện, để event.target chính là img.
        ['pointerdown', 'pointerup'].forEach((type) => chest.dispatchEvent(typeof PointerEvent === 'function' ? new PointerEvent(type, { ...eventOptions, pointerId: 1, pointerType: 'mouse', isPrimary: true }) : new MouseEvent(type, eventOptions)));
        ['mousedown', 'mouseup', 'click'].forEach((type) => chest.dispatchEvent(new MouseEvent(type, eventOptions)));
        chest.click();
        return true;
      };
      const clickNpcTargets = async (game) => {
        const assetName = game.name === 'Goblins' ? 'goblin' : game.name === 'Moon Seekers' ? 'skeleton' : '';
        if (!assetName) return { clicked: 0, targets: 0 };
        const grid = Array.from(game.panel.querySelectorAll('div.flex.flex-wrap.justify-center.items-center')).find((element) => Array.from(element.children).filter((child) => child.classList.contains('cursor-pointer')).length >= 12);
        if (!grid) return { clicked: 0, targets: 0 };
        const targets = Array.from(grid.children).filter((slot) => {
          const image = slot.querySelector('img');
          const propsKey = image && Object.getOwnPropertyNames(image).find((key) => key.startsWith('__reactProps$'));
          const reactSource = propsKey ? image[propsKey]?.src : '';
          const source = reactSource || image?.currentSrc || image?.src || '';
          return new RegExp(`/game-assets/npcs/[^/]*${assetName}`, 'i').test(source);
        });
        for (const target of targets) {
          const image = target.querySelector('img') || target;
          const rect = image.getBoundingClientRect();
          const options = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
          ['pointerdown', 'pointerup'].forEach((type) => target.dispatchEvent(typeof PointerEvent === 'function' ? new PointerEvent(type, { ...options, pointerId: 1, pointerType: 'mouse', isPrimary: true }) : new MouseEvent(type, options)));
          target.click();
          await sleep(110);
        }
        return { clicked: targets.length, targets: targets.length };
      };
      const waitForNewMiniGame = async () => {
        const deadline = Date.now() + 170;
        while (Date.now() < deadline) {
          const game = miniGame();
          if (game) return game;
          await sleep(25);
        }
        return null;
      };
      const resolveMiniGame = async (game) => {
        const chestGame = game.name === 'Chest';
        if (chestGame) {
          clickChest();
        } else {
          const solved = await clickNpcTargets(game);
          if (solved.clicked !== 3) {
            return false;
          }
        }
        const deadline = Date.now() + (chestGame ? 300000 : 10000);
        let withoutPanelSince = 0;
        while (Date.now() < deadline) {
          if (closeReward()) {
            await sleep(350);
            return true;
          }
          if (!miniGame()) {
            if (!chestGame) return true;
            withoutPanelSince ||= Date.now();
            if (Date.now() - withoutPanelSince >= 1500) return true;
          } else {
            withoutPanelSince = 0;
          }
          await sleep(250);
        }
        return false;
      };
      let harvested = 0;
      const harvestedKeys = [];
      for (const key of keys) {
        const pending = miniGame();
        if (pending && !(await resolveMiniGame(pending))) return { harvested, harvestedKeys, stopped: pending.name };
        const placement = Array.from(document.querySelectorAll('div[data-map-placement="true"]')).find((element) => (element.dataset.sunflowerToolsMapKey || `${element.style.top}|${element.style.left}`) === key);
        const ready = placement && Array.from(placement.querySelectorAll('img')).some((image) => /\/game-assets\/crops\/[^/]+\/plant\.png/i.test(image.currentSrc || image.src || ''));
        if (!ready) continue;
        (placement.querySelector('.cursor-pointer') || placement.firstElementChild || placement).click();
        harvested += 1;
        harvestedKeys.push(key);
        const triggered = await waitForNewMiniGame();
        if (triggered && !(await resolveMiniGame(triggered))) return { harvested, harvestedKeys, stopped: triggered.name };
      }
      return { harvested, harvestedKeys, stopped: '' };
    },
    args: [mapKeys]
  });
  return result;
}


mapActivityContent.addEventListener('click', async (event) => {
  const card = event.target.closest('.crop-card');
  if (!card || card.dataset.uiAction !== 'chop') return;
  setCardLoading(card, 'Chopping...');
  const finishLog = startActionLog('Chopping tree...');
  try {
    const result = await chopTrees(card);
    if (!result.processed) logActionError('Không tìm thấy Tree sẵn sàng chặt.');
    else {
      const felledKeys = result.felledKeys || [];
      const states = felledKeys.length ? await readTreeStates(felledKeys) : [];
      if (states.length) applyTreeStates(states);
      // Game animation can outlive the interaction result: felled may still
      // be zero even though the chop succeeded. Always perform one authoritative
      // Tree scan after a processed action, rather than leaving the ready card stale.
      scheduleTreeRefresh();
      renderOverview();
      startCountdowns();
    }
  } catch (error) {
    logActionError(error.message || 'Chặt Tree thất bại.');
  } finally {
    finishLog();
    clearCardLoading(card);
  }
});

