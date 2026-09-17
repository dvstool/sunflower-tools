/* Ready-countdown notification lifecycle. Loaded after the app coordinator. */

const readyNotificationIconUrl = chrome.runtime.getURL('icons/notification-icon.png');
const readyNotificationText = (value) => window.panelI18n?.translate?.(value, window.panelI18n.language) || value;

async function initialiseReadyNotifications() {
  const { readyNotificationsEnabled: enabled = true } = await chrome.storage.local.get('readyNotificationsEnabled');
  if (enabled) await chrome.storage.local.set({ readyNotificationsEnabled: true });
  readyNotificationsEnabled = enabled;
  if (readyNotificationsToggle) readyNotificationsToggle.checked = enabled;
  if (notificationStatus) notificationStatus.textContent = enabled ? 'Đang bật.' : 'Đang tắt.';
}

function readyNotificationEntry(card, when) {
  const title = card?.querySelector('.crop-card-title')?.textContent?.trim() || 'Tiến trình';
  const count = Number(card?.dataset.count || 1);
  const mapKeys = card?.dataset.mapKeys || card?.dataset.resource || title;
  const icon = readyNotificationIconUrl;
  return { title, count, mapKeys, when, icon, language: document.body?.dataset.language === 'vi' ? 'vi' : 'en' };
}

function syncReadyNotifications() {
  const rawEntries = Array.from(document.querySelectorAll('[data-countdown-target]'))
    .map((element) => readyNotificationEntry(element.closest('.crop-card'), Number(element.dataset.countdownTarget)))
    .filter((entry) => Number.isFinite(entry.when));
    
  const groups = [];
  rawEntries.forEach((entry) => {
    const group = groups.find((g) => g.title === entry.title && Math.abs(g.when - entry.when) < 60000);
    if (group) {
      group.count += entry.count;
      group.mapKeys = `${group.mapKeys}||${entry.mapKeys}`;
      group.when = Math.max(group.when, entry.when);
    } else {
      groups.push({ ...entry });
    }
  });

  const entries = groups.map((group) => {
    const prefix = group.count > 1 ? `${group.count} ${group.title}` : group.title;
    return {
      id: `${prefix}|${group.mapKeys}`,
      when: group.when,
      icon: group.icon,
      language: group.language
    };
  });

  chrome.runtime.sendMessage({ type: 'SCHEDULE_READY_NOTIFICATIONS', entries });
}

async function notifyReadyNow(card, when) {
  if (!readyNotificationsEnabled) return;
  const entry = readyNotificationEntry(card, when);
  if (sentReadyNotifications.has(entry.id)) return;
  sentReadyNotifications.add(entry.id);
  // chrome.alarms owns delivery. Sending again from the panel duplicates the
  // same Ready alert when the countdown and alarm fire in the same moment.
}

readyNotificationsToggle?.addEventListener('change', async () => {
  const enabled = readyNotificationsToggle.checked;
  readyNotificationsEnabled = enabled;
  if (notificationStatus) notificationStatus.textContent = enabled ? 'Đang gửi thông báo thử…' : 'Đang tắt.';
  try {
    if (enabled) await chrome.notifications.create('sfl-test-notification', { type: 'basic', iconUrl: readyNotificationIconUrl, title: 'Sunflower Tools', message: document.body?.dataset.language === 'vi' ? 'Th\u00f4ng b\u00e1o s\u1eb5n s\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c b\u1eadt.' : 'Ready notifications enabled.', priority: 2 });
    chrome.runtime.sendMessage({ type: 'SET_READY_NOTIFICATIONS', enabled });
    if (notificationStatus && enabled) notificationStatus.textContent = 'Chrome đã tạo thông báo thử.';
  } catch (error) { if (notificationStatus) notificationStatus.textContent = `Lỗi thông báo: ${error.message || error}`; }
  if (readyNotificationsToggle.checked) syncReadyNotifications();
  else chrome.runtime.sendMessage({ type: 'SCHEDULE_READY_NOTIFICATIONS', entries: [] });
});

window.addEventListener('sunflower-language-changed', () => { if (readyNotificationsEnabled) syncReadyNotifications(); });

initialiseReadyNotifications();
