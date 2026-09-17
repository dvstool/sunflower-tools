/* Read only resource-tool quantities from the verified Workbench DOM. */

let toolInventoryLoading = false;
const legacyWorkbenchPattern = /\/game-assets\/(?:[^/]+\/)*buildings\/(?:[^/]+\/)*workbench\.(?:webp|png)(?:[?#]|$)/i;

async function hasWorkbenchToolList() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: () => ['Land Tools', 'Water Tools'].some((category) => Array.from(document.querySelectorAll('div')).some((element) => element.textContent.trim() === category))
  });
  return Boolean(result);
}

async function openLegacyWorkbench() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: (patternSource) => {
      const pattern = new RegExp(patternSource, 'i');
      const image = Array.from(document.querySelectorAll('img')).find((item) => pattern.test(item.currentSrc || item.src || ''));
      const target = image?.closest('.cursor-pointer') || image?.parentElement;
      if (!target) return false;
      target.click();
      return true;
    },
    args: [legacyWorkbenchPattern.source]
  });
  return Boolean(result);
}

async function closeWorkbenchToolList() {
  await executeOnSunflowerTabs({
    func: () => {
      const heading = Array.from(document.querySelectorAll('div')).find((element) => element.textContent.trim() === 'Land Tools');
      for (let container = heading; container && container !== document.body; container = container.parentElement) {
        const close = container.querySelector?.('img[src*="/game-assets/icons/close.png"]');
        if (close) {
          close.click();
          return true;
        }
      }
      return false;
    }
  });
}

async function readWorkbenchToolSummaries() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const categories = ['Land Tools', 'Water Tools'];
      const headingsFor = (category) => Array.from(document.querySelectorAll('div')).filter((element) => element.textContent.trim() === category);
      const hasCategories = () => categories.some((category) => headingsFor(category).length > 0);
      if (!hasCategories()) {
        const toolsTab = Array.from(document.querySelectorAll('button, div.cursor-pointer, span.cursor-pointer')).find((element) => element.textContent.trim() === 'Tools');
        if (!toolsTab) return { error: 'Không tìm thấy tab Tools trong Workbench.' };
        toolsTab.click();
        for (let attempt = 0; attempt < 90 && !hasCategories(); attempt += 1) await sleep(20);
      }
      if (!hasCategories()) return { error: 'Workbench đã mở nhưng tab Tools chưa hiển thị Land Tools.' };
      const readCount = (slot) => {
        const wrapper = slot?.parentElement || slot;
        const text = (wrapper?.innerText || wrapper?.textContent || '').replace(/,/g, '').toLowerCase();
        const match = text.match(/\d+(?:\.\d+)?\s*k?/);
        const amount = Number.parseFloat(match?.[0] || '0');
        return Number.isFinite(amount) ? Math.round(amount * (String(match?.[0] || '').includes('k') ? 1000 : 1)) : 0;
      };
      const items = [];
      categories.forEach((category) => {
        headingsFor(category).forEach((heading) => {
          const section = heading.nextElementSibling;
          const slots = Array.from(section?.querySelectorAll('.bg-brown-600, .bg-brown-700') || []);
          slots.forEach((slot) => {
            const image = slot.querySelector('img[alt="item"]');
            const icon = image?.currentSrc || image?.src || '';
            if (icon && !items.some((item) => item.icon === icon)) items.push({ icon, count: readCount(slot) });
          });
        });
      });
      return items.length ? { items } : { error: 'Đã thấy Land Tools nhưng không thấy slot .bg-brown chứa img[alt="item"].' };
    }
  });
  if (result?.error) throw new Error(result.error);
  return result?.items || [];
}

async function loadResourceToolInventory() {
  await window.licenseManager.requireTier('silver');
  if (toolInventoryLoading) return;
  toolInventoryLoading = true;
  const finishLog = startActionLog('Reading tool quantities...');
  let openedHere = false;
  let loaded = false;
  try {
    if (!await hasWorkbenchToolList()) {
      openedHere = await openLegacyWorkbench();
      if (!openedHere) throw new Error('Không mở được Workbench.');
    }
    const items = await readWorkbenchToolSummaries();
    if (!items.length) throw new Error('Không đọc được số lượng Tools.');
    toolCounts.clear();
    items.forEach((item) => toolCounts.set(item.icon, Math.max(0, Number(item.count) || 0)));
    toolBagScanned = true;
    loaded = true;
    renderOverview();
  } catch (error) {
    logActionError(error.message || 'Không thể đọc số lượng Tools.');
  } finally {
    if (openedHere && loaded) await closeWorkbenchToolList();
    toolInventoryLoading = false;
    finishLog(loaded ? 'Đã cập nhật số lượng Tools.' : '');
  }
}

let workbenchPurchaseWatchTimer;
let workbenchPurchaseWatchInFlight = false;

async function readOpenWorkbenchToolCounts() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: () => {
      const categories = ['Land Tools', 'Water Tools'];
      const headings = categories.flatMap((category) => Array.from(document.querySelectorAll('div')).filter((element) => element.textContent.trim() === category));
      if (!headings.length) return { open: false, items: [] };
      const readCount = (slot) => {
        const text = String(slot?.parentElement?.innerText || slot?.textContent || '').replace(/,/g, '').toLowerCase();
        const token = text.match(/\d+(?:\.\d+)?\s*k?/i)?.[0] || '0';
        const amount = Number.parseFloat(token);
        return Number.isFinite(amount) ? Math.round(amount * (/k/i.test(token) ? 1000 : 1)) : 0;
      };
      const items = headings.flatMap((heading) => Array.from(heading.nextElementSibling?.querySelectorAll('.bg-brown-600, .bg-brown-700') || []).map((slot) => {
        const image = slot.querySelector('img[alt="item"]');
        const icon = image?.currentSrc || image?.src || '';
        return icon ? { icon, count: readCount(slot) } : null;
      }).filter(Boolean));
      return { open: true, items };
    }
  });
  return result || { open: false, items: [] };
}

function stopWorkbenchPurchaseWatch() {
  window.clearInterval(workbenchPurchaseWatchTimer);
  workbenchPurchaseWatchTimer = undefined;
}

function isSunflowerTabUnavailable(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('không tìm thấy tab')
    || message.includes('no sunflower land tab')
    || message.includes('no tab with id')
    || message.includes('tab not found')
    || message.includes('receiving end does not exist');
}

function startWorkbenchPurchaseWatch() {
  stopWorkbenchPurchaseWatch();
  const poll = async () => {
    if (workbenchPurchaseWatchInFlight) return;
    workbenchPurchaseWatchInFlight = true;
    try {
      const snapshot = await readOpenWorkbenchToolCounts();
      if (!snapshot.open) { stopWorkbenchPurchaseWatch(); return; }
      let changed = false;
      (snapshot.items || []).forEach((item) => {
        const count = Math.max(0, Number(item.count) || 0);
        if (toolCounts.get(item.icon) !== count) { toolCounts.set(item.icon, count); changed = true; }
      });
      if (changed) { toolBagScanned = true; renderOverview(); }
    } catch (error) {
      // A reload can briefly fail while the game reconnects, but a closed tab
      // cannot recover during this panel session. Stop the 500 ms poll in that case.
      if (isSunflowerTabUnavailable(error)) stopWorkbenchPurchaseWatch();
    }
    finally { workbenchPurchaseWatchInFlight = false; }
  };
  void poll();
  workbenchPurchaseWatchTimer = window.setInterval(() => void poll(), 500);
}

window.addEventListener('pagehide', stopWorkbenchPurchaseWatch);

async function openToolShop(toolIcon) {
  await window.licenseManager.requireTier('silver');
  if (!toolIcon) return;
  const finishLog = startActionLog('Opening Workbench...');
  try {
    const [{ result }] = await executeOnSunflowerTabs({
      func: async (patternSource, requestedIcon) => {
        const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
        const categories = ['Land Tools', 'Water Tools'];
        const hasCategories = () => categories.some((category) => Array.from(document.querySelectorAll('div')).some((element) => element.textContent.trim() === category));
        let openedWorkbench = false;
        for (let attempt = 0; attempt < 100 && !hasCategories(); attempt += 1) {
          const toolsTab = Array.from(document.querySelectorAll('button, div.cursor-pointer, span.cursor-pointer')).find((element) => element.textContent.trim() === 'Tools');
          if (toolsTab) toolsTab.click();
          else if (!openedWorkbench) {
            const pattern = new RegExp(patternSource, 'i');
            const image = Array.from(document.querySelectorAll('img')).find((item) => pattern.test(item.currentSrc || item.src || ''));
            const target = image?.closest('.cursor-pointer') || image?.parentElement;
            if (target) { target.click(); openedWorkbench = true; }
          }
          await sleep(20);
        }
        if (!hasCategories()) return false;
        const filename = String(requestedIcon).split('?')[0].split('/').pop();
        const workbenchSlots = categories.flatMap((category) => Array.from(document.querySelectorAll('div'))
          .filter((element) => element.textContent.trim() === category)
          .flatMap((heading) => Array.from(heading.nextElementSibling?.querySelectorAll('.bg-brown-600, .bg-brown-700') || [])));
        const slot = workbenchSlots.find((element) => {
          const image = element.querySelector('img[alt="item"]');
          const source = image?.currentSrc || image?.src || '';
          return source === requestedIcon || (filename && source.split('?')[0].endsWith(`/${filename}`));
        });
        if (!slot) return false;
        (slot.closest('.cursor-pointer') || slot).click();
        return true;
      },
      args: [legacyWorkbenchPattern.source, toolIcon]
    });
    if (!result) throw new Error('Không tìm thấy Tool tương ứng trong Workbench.');
    startWorkbenchPurchaseWatch();
  } catch (error) {
    logActionError(error.message || 'Không thể mở Workbench.');
  } finally {
    finishLog();
  }
}
mapActivityContent.addEventListener('click', async (event) => {
  const button = event.target.closest('.crop-card, [data-ui-action="scan-resource-tools"]');
    if (!button || button.dataset.uiAction !== 'scan-resource-tools') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (toolInventoryLoading) return;
  setCardLoading(button, 'Scanning tools...');
  try {
    await loadResourceToolInventory();
  } finally {
    clearCardLoading(button);
  }
});
mapActivityContent.addEventListener('click', async (event) => {
  const button = event.target.closest('.crop-card, [data-ui-action="open-tool-shop"]');
    if (!button || button.dataset.uiAction !== 'open-tool-shop') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  setCardLoading(button, 'Opening shop...');
  try {
    await openToolShop(button.dataset.toolIcon || '');
  } finally {
    clearCardLoading(button);
  }
});
