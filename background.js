async function rememberSunflowerTab(tab) {
  if (tab?.id && tab.url?.startsWith('https://sunflower-land.com/')) {
    await chrome.storage.session.set({ sunflowerTabId: tab.id });
  }
}

// Set side panel behavior at top level so it registers on every service worker boot
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => console.error('Side panel behavior error:', err));
}

// Fallback action click listener in case openPanelOnActionClick is not handled by the active tab
if (chrome.action?.onClicked) {
  chrome.action.onClicked.addListener(async (tab) => {
    try {
      if (tab?.windowId) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
  const { readyNotificationsEnabled = true, panelLanguage = 'en' } = await chrome.storage.local.get(['readyNotificationsEnabled', 'panelLanguage']);
  if (readyNotificationsEnabled) {
    await chrome.storage.local.set({ readyNotificationsEnabled: true });
    showReadyNotification(panelLanguage === 'vi' ? '\u0110\u00e3 b\u1eadt th\u00f4ng b\u00e1o s\u1eb5n s\u00e0ng.' : 'Ready notifications enabled.', `sfl-extension-reloaded-${Date.now()}`);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try { await rememberSunflowerTab(await chrome.tabs.get(tabId)); } catch { /* Tab was closed. */ }
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.url || tab.url?.startsWith('https://sunflower-land.com/')) rememberSunflowerTab(tab);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { sunflowerTabId } = await chrome.storage.session.get('sunflowerTabId');
  if (sunflowerTabId === tabId) await chrome.storage.session.remove('sunflowerTabId');
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SUNFLOWER_TAB_CONNECTED') {
    rememberSunflowerTab({ id: message.tabId, url: message.url });
  }
  if (message.type === 'SHOW_READY_NOTIFICATION') {
    showReadyNotification(message.message || 'Tiến trình đã sẵn sàng.', message.id || `sfl-ready-${Date.now()}`).then(sendResponse);
    return true;
  }
  if (message.type === 'SET_READY_NOTIFICATIONS') {
    (async () => {
      await chrome.storage.local.set({ readyNotificationsEnabled: Boolean(message.enabled) });
      sendResponse({ ok: true });
    })();
    return true;
  }
  if (message.type === 'SCHEDULE_READY_NOTIFICATIONS') {
    scheduleReadyNotifications(message.entries || []);
  }
  if (message.type === 'CANCEL_READY_NOTIFICATION') {
    (async () => {
      const stored = await chrome.storage.local.get(readyAlarmDetailsKey);
      const details = stored[readyAlarmDetailsKey] || {};
      const matches = Object.entries(details).filter(([, detail]) => detail?.id === message.id);
      await Promise.all(matches.map(([name]) => chrome.alarms.clear(name)));
      matches.forEach(([name]) => delete details[name]);
      await chrome.storage.local.set({ [readyAlarmDetailsKey]: details });
    })();
  }
});

const readyAlarmPrefix = 'sfl-ready:';
const readyAlarmDetailsKey = 'readyAlarmDetails';
const notificationIcon = chrome.runtime.getURL('icons/notification-icon.png');

function readyAlarmName(id) {
  let hash = 2166136261;
  for (const character of String(id || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${readyAlarmPrefix}${(hash >>> 0).toString(36)}`;
}

async function scheduleReadyNotifications(entries) {
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter((alarm) => alarm.name.startsWith(readyAlarmPrefix)).map((alarm) => chrome.alarms.clear(alarm.name)));
  const now = Date.now();
  const details = {};
  entries.filter((entry) => Number(entry.when) > now + 500).forEach((entry) => {
    // Alarm names are limited to 1024 bytes. Map keys can be much longer, so
    // persist the descriptive entry separately and use a compact alarm name.
    const name = readyAlarmName(entry.id);
    details[name] = { id: String(entry.id || ''), title: String(entry.id || '').split('|')[0] || 'Sunflower Tools', language: entry.language === 'vi' ? 'vi' : 'en' };
    chrome.alarms.create(name, { when: Number(entry.when) });
  });
  await chrome.storage.local.set({ [readyAlarmDetailsKey]: details });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith(readyAlarmPrefix)) return;
  const stored = await chrome.storage.local.get(['readyNotificationsEnabled', readyAlarmDetailsKey]);
  const details = stored[readyAlarmDetailsKey] || {};
  const detail = details[alarm.name];
  delete details[alarm.name];
  await chrome.storage.local.set({ [readyAlarmDetailsKey]: details });
  if (!stored.readyNotificationsEnabled) return;
  const title = detail?.title || 'Sunflower Tools';
  showReadyNotification(detail?.language === 'vi' ? `${title} \u0111\u00e3 s\u1eb5n s\u00e0ng.` : `${title} is ready.`, alarm.name);
});

async function showReadyNotification(message, id, iconUrl = notificationIcon) {
  try {
    await chrome.notifications.create(id, {
    type: 'basic',
    iconUrl,
    title: 'Sunflower Tools',
    message,
    priority: 2
    });
    return { ok: true };
  } catch (error) {
    console.error('Không thể tạo thông báo Sunflower Tools:', error);
    return { ok: false, error: error?.message || String(error) };
  }
}
