/* Explicit connection and panel reload actions. */

function waitForTabComplete(tabId, timeout = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish();
    };
    const timer = setTimeout(finish, timeout);
    chrome.tabs.onUpdated.addListener(listener);
  });
}

connectButton.addEventListener('click', async () => {
  try {
    let tab = await findSunflowerTab();
    if (!tab?.id) {
      tab = await chrome.tabs.create({ url: 'https://sunflower-land.com/play/', active: false });
      if (!tab.id) throw new Error('Không thể mở tab Sunflower Land.');
      await chrome.storage.session.set({ sunflowerTabId: tab.id });
      log('Đã mở tab Sunflower Land, đang chờ game tải…');
      await waitForTabComplete(tab.id);
    }
    await refreshConnection();
    if (connectButton.disabled) {
      log('Đã kết nối với tab Sunflower Land.');
      await scanMap();
    } else log('Sunflower Land chưa tải xong. Hãy bấm Kết nối lại sau vài giây.');
  } catch (error) {
    log(error.message || 'Không thể kết nối Sunflower Land.');
  }
});

function showExtensionReloading() {
  if (document.querySelector('#extension-reloading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'extension-reloading-overlay';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'assertive');
  overlay.textContent = 'Reloading extension...';
  document.body.append(overlay);
}

reloadExtensionButton.addEventListener('click', () => {
  if (reloadExtensionButton.disabled) return;
  setCardLoading(reloadExtensionButton, 'Reloading extension...');
  showExtensionReloading();
  requestAnimationFrame(() => window.setTimeout(() => window.location.reload(), 50));
});
