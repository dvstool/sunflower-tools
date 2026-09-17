/* Bag opening and fertiliser inventory scanner. */

async function openBagInTab(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => {
      if (document.querySelector('input[placeholder="Search here..."]')) return true;
      const basket = Array.from(document.querySelectorAll('img[src*="/game-assets/icons/basket.png"]')).find((image) => image.closest('div.relative.flex.mb-2.cursor-pointer'));
      const button = basket?.closest('div.relative.flex.mb-2.cursor-pointer');
      if (!button) return false;
      button.click();
      const deadline = Date.now() + 600;
      while (!document.querySelector('input[placeholder="Search here..."]') && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      return Boolean(document.querySelector('input[placeholder="Search here..."]'));
    }
  });
  return result;
}

scanFertilisersButton.addEventListener('click', async () => {
  const finishLog = startActionLog('Scanning inventory...');
  try {
    const tab = await findSunflowerTab();
    if (!tab?.id) throw new Error('Không tìm thấy tab Sunflower Land đang mở.');
    scanFertilisersButton.disabled = true;
    scanFertilisersButton.classList.add('is-scanning');
    if (!await openBagInTab(tab.id)) throw new Error('Không mở được túi đồ.');
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async () => {
        const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
        const parseCount = (value) => {
          const text = value.trim().toLowerCase().replace(/,/g, '');
          const number = Number.parseFloat(text);
          return Number.isFinite(number) ? Math.round(number * (text.includes('k') ? 1000 : 1)) : 0;
        };
        const revealExactCounts = (element) => ['mouseover', 'mousemove', 'mouseenter'].forEach((type) => element?.dispatchEvent(new MouseEvent(type, { bubbles: true, view: window })));
        const collectSection = async (name) => {
          const header = Array.from(document.querySelectorAll('div')).find((element) => element.textContent.trim() === name);
          const section = header?.parentElement;
          revealExactCounts(header);
          revealExactCounts(section);
          await sleep(35);
          const slots = Array.from(section?.querySelectorAll('.bg-brown-600') || []).filter((slot) => slot.querySelector('img[alt="item"]'));
          return slots.map((slot) => {
            const image = slot.querySelector('img[alt="item"]');
            const icon = image?.currentSrc || image?.src || '';
            const count = parseCount(slot.parentElement?.innerText || slot.parentElement?.textContent || slot.textContent);
            return icon ? { icon, count } : null;
          }).filter(Boolean).filter((item, index, items) => items.findIndex((candidate) => candidate.icon === item.icon) === index);
        };
        const fertilisers = await collectSection('Fertilisers');
        const search = document.querySelector('input[placeholder="Search here..."]');
        const bagRoot = search?.closest('div.relative.max-h-\\[90vh\\]') || search?.parentElement?.parentElement?.parentElement;
        const closeButton = bagRoot?.querySelector('img[src*="/game-assets/icons/close.png"]') || Array.from(document.querySelectorAll('img[src*="/game-assets/icons/close.png"]')).find((image) => image.closest('div.relative.max-h-\\[90vh\\]'));
        closeButton?.click();
        return { fertilisers, closed: Boolean(closeButton) };
      }
    });
    [...cropFertiliserIcons, ...fruitFertiliserIcons].forEach((icon) => fertiliserCounts.set(icon, 0));
    result.fertilisers.forEach((item) => fertiliserCounts.set(item.icon, Math.max(0, Number(item.count) || 0)));
    fertilisersScanned = true;
    if (lastScanData) {
      renderCropScan(lastScanData);
      renderTreeScan(lastScanData.trees);
      renderMiningScan(lastScanData.mining);
      renderFruitScan(lastScanData.fruit);
    }
  } catch (error) {
    logActionError(error.message || 'Không thể quét phân bón.');
  } finally {
    finishLog();
    scanFertilisersButton.disabled = false;
    scanFertilisersButton.classList.remove('is-scanning');
  }
});
