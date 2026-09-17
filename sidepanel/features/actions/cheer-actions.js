/* Follow-list reader used by the Cheer tab. */

const cheerActionIcon = 'data:image/webp;base64,UklGRroAAABXRUJQVlA4TK4AAAAvEAAEEEegGAAaKIQE8ui///wVToZpqAkANOEjDYGo6hJrqqiRFOY0YAybmOvty/wHAP7/ohOLMeAkJSsj0Qg4biTbiUZ6ETxMAKy5P+n/D1zRfxsBNgI2AHv2+/N+BBHR/wmAFefISFTdyFkHI8zdaPJOnyNBHBfVZyHEnIvdt4UMJR9NHJmXMRH6kGtKLSDnqCkRcJn0k1psuMVtjPXozbrOJzKPR+8BwDknZAA=';
const cheerActionIndicatorSignature = 'UklGRroAAABXRUJQVlA4TK4AAAAvEAAEEEegGAAaKIQE8ui';
const helpActionIcon = 'https://sunflower-land.com/game-assets/icons/search.png';
const helpedIndicatorSignature = 'UklGRp4AAABXRUJQVlA4TJIAAAAvDYADEEegkI0';
let activeCheerPlayerName = '';
const cheerAvailability = new Map();
const helpAvailability = new Map();

const cheerPlayerKey = (name) => String(name || '').trim().toLocaleLowerCase();
const hasCheeredIndicator = (source) => String(source || '').includes(cheerActionIndicatorSignature);
const hasHelpedIndicator = (source) => String(source || '').includes(helpedIndicatorSignature);
function setHelpAvailability(playerName, available) {
  helpAvailability.set(cheerPlayerKey(playerName), available);
  if (lastCheerScan) renderCheerPlayers(lastCheerScan);
}

function renderCheerPlayers(scan) {
  lastCheerScan = scan;
  const players = scan?.players || [];
  if (!players.length) {
    cheerResults.innerHTML = `<div class="empty-state">${escapeHtml(scan?.message || 'Không tìm thấy người chơi trong Following.')}</div>`;
    return;
  }
  const summary = Number.isFinite(scan.followingCount) ? `Following (${scan.followingCount}) · Đã đọc ${players.length} người chơi` : `Đã đọc ${players.length} người chơi`;
  cheerResults.innerHTML = `<p class="cheer-summary">${escapeHtml(summary)}</p>${players.map((player) => {
    const avatar = player.avatar ? `<img class="cheer-avatar" src="${escapeHtml(player.avatar)}" alt="" />` : '<span class="cheer-avatar-placeholder">♥</span>';
    const icons = (player.icons || []).map((source) => `<img class="cheer-player-icon" src="${escapeHtml(source)}" alt="" />`).join('');
    const streak = player.streak ? `<b class="cheer-streak">🔥 ${escapeHtml(player.streak)}</b>` : '';
    const canCheer = cheerAvailability.get(cheerPlayerKey(player.name));
    const canHelp = helpAvailability.get(cheerPlayerKey(player.name));
    const cheerDisabled = canCheer === false ? ' disabled title="Cheer hiện không khả dụng"' : '';
    const helpDisabled = canHelp === false ? ' disabled title="Đã Help người này"' : '';
    const actions = `<span class="cheer-card-actions"><button class="cheer-action-button cheer-action-button--cheer" type="button" data-cheer-action="cheer" data-cheer-player="${escapeHtml(player.name)}"${cheerDisabled}><img src="${cheerActionIcon}" alt="" />Cheer</button><button class="cheer-action-button" type="button" data-cheer-action="help" data-cheer-player="${escapeHtml(player.name)}"${helpDisabled}><img src="${helpActionIcon}" alt="" />Help</button></span>`;
    return `<article class="cheer-card${player.streak ? '' : ' no-streak'}" data-cheer-player="${escapeHtml(player.name)}">${avatar}<div class="cheer-player-info"><strong class="cheer-name" title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>${icons ? `<span class="cheer-player-icons">${icons}</span>` : ''}</div>${streak}${actions}</article>`;
  }).join('')}`;
}

async function openFollowingPlayer(playerName) {
  const [{ result }] = await executeOnSunflowerTabs({
    func: (requestedName) => {
      const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      const wanted = normalise(requestedName);
      const available = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const card = Array.from(document.querySelectorAll('div.cursor-pointer')).find((element) => available(element)
        && Boolean(element.querySelector('img#idle'))
        && Array.from(element.querySelectorAll('.text-xs')).some((name) => normalise(name.textContent) === wanted));
      if (!card) return { error: `Không tìm thấy ${requestedName} trong Following.` };
      card.click();
      return { opened: true };
    },
    args: [playerName]
  });
  if (result?.error) throw new Error(result.error);
  return result || { opened: false };
}

async function ensureFollowingTab() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const available = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const searchInput = () => Array.from(document.querySelectorAll('input[placeholder="Search following..."]')).find(available) || null;
      if (searchInput()) return { selected: true };
      const following = Array.from(document.querySelectorAll('span')).find((element) => available(element) && /^Following\s*\(\d+\)$/i.test(element.textContent.trim()));
      if (!following) return { error: 'Không tìm thấy tab Following.' };
      following.click();
      const deadline = Date.now() + 4000;
      while (!searchInput() && Date.now() < deadline) await sleep(30);
      return searchInput() ? { selected: true } : { error: 'Không thể chuyển sang tab Following.' };
    }
  });
  if (result?.error) throw new Error(result.error);
  return Boolean(result?.selected);
}

async function readProfileCheerAvailability() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (rocketIcon) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const visible = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      };
      const deadline = Date.now() + 2200;
      let rocketButton = null;
      while (!rocketButton && Date.now() < deadline) {
        rocketButton = Array.from(document.querySelectorAll('button')).find((button) => {
          const icon = button.querySelector('img');
          return visible(button) && (icon?.currentSrc || icon?.src || '') === rocketIcon;
        }) || null;
        if (!rocketButton) await sleep(30);
      }
      // The rocket disappears from a profile after that player has already
      // received today's Cheer, so treat its absence as unavailable.
      return rocketButton ? !rocketButton.disabled : false;
    },
    args: [cheerActionIcon]
  });
  return typeof result === 'boolean' ? result : null;
}

function setCheerAvailability(playerName, canCheer) {
  if (typeof canCheer !== 'boolean') return;
  const key = String(playerName || '').trim().toLocaleLowerCase();
  cheerAvailability.set(key, canCheer);
  const card = Array.from(cheerResults?.querySelectorAll('.cheer-card[data-cheer-player]') || []).find((item) => String(item.dataset.cheerPlayer || '').trim().toLocaleLowerCase() === key);
  const button = card?.querySelector('[data-cheer-action="cheer"]');
  if (!button) return;
  button.disabled = !canCheer;
  button.title = canCheer ? '' : 'Cheer hiện không khả dụng';
}

async function closeFollowingPlayerInfo() {
  const [{ result }] = await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const visible = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      };
      const close = Array.from(document.querySelectorAll('img.flex-none.cursor-pointer.float-right[src*="/game-assets/icons/close.png"]')).find(visible);
      if (!close) return { closed: false, settled: true };
      const modal = close.closest('div.fixed.inset-0.overflow-y-auto');
      close.click();
      // Wait for the profile modal's leave transition. Clicking another
      // Following card while this layer remains mounted freezes the game UI.
      await sleep(180);
      const deadline = Date.now() + 2800;
      while (modal?.isConnected && visible(modal) && Date.now() < deadline) await sleep(30);
      return { closed: true, settled: !modal?.isConnected || !visible(modal) };
    }
  });
  return result || { closed: false, settled: true };
}

async function ensureFollowingPlayerProfile(playerName) {
  const normalise = (value) => String(value || '').trim().toLocaleLowerCase();
  if (normalise(activeCheerPlayerName) === normalise(playerName)) return;
  if (activeCheerPlayerName) {
    const closeResult = await closeFollowingPlayerInfo();
    if (closeResult.closed && !closeResult.settled) throw new Error('Hồ sơ trước chưa đóng xong. Hãy thử lại sau một lát.');
    cheerResults?.querySelector('.cheer-card.is-selected')?.classList.remove('is-selected');
    activeCheerPlayerName = '';
  }
  if (!await ensureFollowingTab()) throw new Error('Không thể mở tab Following.');
  const profile = await openFollowingPlayer(playerName);
  if (!profile.opened) throw new Error(`Không mở được hồ sơ ${playerName}.`);
  activeCheerPlayerName = playerName;
  cheerResults?.querySelector(`.cheer-card[data-cheer-player="${CSS.escape(playerName)}"]`)?.classList.add('is-selected');
  // Availability is secondary: a slow profile render must never turn a
  // successful player-card click into a false "cannot open" error.
  void readProfileCheerAvailability().then((canCheer) => setCheerAvailability(playerName, canCheer)).catch(() => {});
}

async function sendCheerFromProfile() {
  await window.licenseManager.requireTier('silver');
  const [{ result }] = await executeOnSunflowerTabs({
    func: async (rocketIcon) => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const visible = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden'
          && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      };
      const waitFor = async (find, timeout = 5000) => {
        const deadline = Date.now() + timeout;
        let found;
        while (!(found = find()) && Date.now() < deadline) await sleep(30);
        return found || null;
      };
      const rocketButton = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => {
        const icon = button.querySelector('img');
        const source = icon?.currentSrc || icon?.src || '';
        return visible(button) && source === rocketIcon;
      }));
      if (!rocketButton) return { alreadyCheered: true };
      if (rocketButton.disabled) return { alreadyCheered: true };
      rocketButton.click();
      const cheerButton = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => visible(button) && /^Cheer$/i.test(button.innerText.trim())));
      if (!cheerButton) return { alreadyCheered: true };
      cheerButton.click();
      const success = await waitFor(() => Array.from(document.querySelectorAll('div, p, span')).find((element) => visible(element) && /Success!/i.test(element.textContent || '') && /Cheer sent/i.test(element.parentElement?.textContent || element.textContent || '')), 7000);
      if (!success) return { error: 'Game chưa xác nhận Cheer thành công.' };
      const continueButton = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => visible(button) && /^Continue$/i.test(button.innerText.trim())));
      if (!continueButton) return { error: 'Không tìm thấy nút Continue sau khi Cheer.' };
      continueButton.click();
      return { sent: true };
    },
    args: [cheerActionIcon]
  });
  if (result?.error) throw new Error(result.error);
  return result || { sent: false };
}

async function helpFromProfile() {
  await window.licenseManager.requireTier('silver');
  const [{ result }] = await executeOnSunflowerTabs({
    func: async () => {
      const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
      const visible = (element) => {
        if (!element || !element.getClientRects().length) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && !element.disabled
          && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      };
      const waitFor = async (find, timeout = 6000) => {
        const deadline = Date.now() + timeout;
        let found;
        while (!(found = find()) && Date.now() < deadline) await sleep(40);
        return found || null;
      };
      const profileHelp = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => {
        const icon = button.querySelector('img');
        return visible(button) && /\/game-assets\/icons\/search\.png(?:[?#]|$)/i.test(icon?.currentSrc || icon?.src || '');
      }));
      if (!profileHelp) return { error: 'Không tìm thấy nút Help trong hồ sơ.' };
      profileHelp.click();
      const endVisit = await waitFor(() => Array.from(document.querySelectorAll('img[alt="End visit"]')).find(visible), 9000);
      if (!endVisit) return { error: 'Không thể đến đảo của người chơi.' };

      let helped = 0;
      for (let pass = 0; pass < 8; pass += 1) {
        const targets = [
          ...Array.from(document.querySelectorAll('.monument-help-action')).map((element) => element.closest('.cursor-pointer') || element),
          ...Array.from(document.querySelectorAll('img[alt="clutter-Dung"], img[alt="clutter-Weed"]')).map((image) => image.closest('.cursor-pointer') || image),
          ...Array.from(document.querySelectorAll('img[src*="/game-assets/icons/drag.png"]')).map((image) => image.closest('.cursor-pointer') || image.parentElement || image),
        ].filter(visible);
        const uniqueTargets = [...new Set(targets)];
        if (!uniqueTargets.length) break;
        for (const target of uniqueTargets) {
          target.click();
          helped += 1;
          await sleep(100);
        }
      }

      const helpedDialog = await waitFor(() => Array.from(document.querySelectorAll('div, p, span')).find((element) => visible(element)
        && /^Helped$/i.test(element.textContent.trim())
        && /Thanks for helping my farm!/i.test(element.parentElement?.parentElement?.textContent || element.parentElement?.textContent || '')), 8000);
      if (!helpedDialog) return { error: helped ? 'Game chưa xác nhận hoàn tất Help.' : 'Không tìm thấy mục nào có thể Help trên đảo này.' };
      const okButton = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => visible(button) && /^OK$/i.test(button.innerText.trim())));
      if (!okButton) return { error: 'Không tìm thấy nút OK sau khi Help.' };
      okButton.click();
      const success = await waitFor(() => Array.from(document.querySelectorAll('div, p, span')).find((element) => visible(element)
        && /Success!/i.test(element.textContent || '')
        && /Thanks for your help!/i.test(element.parentElement?.textContent || element.textContent || '')), 8000);
      if (!success) return { error: 'Game chưa xác nhận Help thành công.' };
      const continueButton = await waitFor(() => Array.from(document.querySelectorAll('button')).find((button) => visible(button) && /^Continue$/i.test(button.innerText.trim())));
      if (!continueButton) return { error: 'Không tìm thấy nút Continue sau khi Help.' };
      continueButton.click();
      const returnButton = await waitFor(() => Array.from(document.querySelectorAll('img[alt="End visit"]')).find(visible), 5000);
      if (!returnButton) return { error: 'Không tìm thấy nút trở về đảo.' };
      (returnButton.closest('.cursor-pointer') || returnButton).click();
      return { helped };
    }
  });
  if (result?.error) throw new Error(result.error);
  return result || { helped: 0 };
}

async function closeCheerPanel() {
  try {
    await executeOnSunflowerTabs({
      world: 'MAIN',
      func: () => {
        const visible = (element) => {
          if (!element || !element.getClientRects().length) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
            && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
        };
        const closeButton = Array.from(document.querySelectorAll('img[alt="Close"]')).find((image) => {
          if (!visible(image)) return false;
          const panel = image.closest('div.flex.flex-col.gap-2.h-full.w-full');
          return /\bFeed\b|\bFollowing\s*\(\d+\)/i.test(panel?.innerText || '');
        });
        closeButton?.click();
        return Boolean(closeButton);
      }
    });
  } catch { /* Closing Cheer is optional when the game dialog already vanished. */ }
}

async function scanFollowingForCheer() {
  if (!cheerResults) return;
  cheerResults.innerHTML = '<div class="empty-state">Đang đọc Following…</div>';
  try {
    const [{ result }] = await executeOnSunflowerTabs({
      func: async () => {
        const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
        const available = (element) => {
          if (!element || !element.getClientRects().length) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          // Following stays mounted while its panel is off-screen. Do not
          // require it to be inside the viewport.
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0
            && rect.width > 0 && rect.height > 0;
        };
        const isInViewport = (element) => {
          const rect = element?.getBoundingClientRect();
          return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight);
        };
        // The chat drawer can be translated outside the viewport while its
        // active Following content remains mounted. Its search input is the
        // reliable active-tab marker; do not reject it for being off-screen.
        const searchInput = () => Array.from(document.querySelectorAll('input[placeholder="Search following..."]')).find(available) || null;
        const followingTab = () => Array.from(document.querySelectorAll('span')).find((element) => available(element) && /^Following\s*\(\d+\)$/i.test(element.textContent.trim())) || null;
        const waitFor = async (find, timeout = 5000) => {
          const deadline = Date.now() + timeout;
          let found;
          while (!(found = find()) && Date.now() < deadline) await sleep(25);
          return found || null;
        };
        const mouseClick = (target) => {
          // The Following tab is a React click target. A native click on its
          // visible span is one user-equivalent click and avoids selecting a
          // mounted but inactive copy of the tab.
          if (!target) return false;
          target.click();
          return true;
        };        let activeInput = searchInput();
        if (!activeInput) {
          const following = followingTab();
          if (!following) return { error: 'Không tìm thấy nút Following trong dữ liệu game.' };
          // Following can stay mounted while another Feed tab is showing. Only
          // select it when its search box is not currently on screen.
          // One click on the visible Following control, then wait until its
          // active search input appears before reading player cards.
          if (!mouseClick(following)) return { error: 'Không thể click nút Following đang hiển thị.' };
          activeInput = await waitFor(searchInput, 5000);
        }
        if (!activeInput) return { error: 'Đã chọn Following nhưng game chưa tải danh sách.' };
        const followingCount = followingTab() ? Number(followingTab().textContent.match(/\d+/)?.[0]) : null;
        const panel = activeInput.closest('div.flex.flex-col.gap-2.h-full.w-full') || activeInput.parentElement?.parentElement?.parentElement?.parentElement || document.body;
        const normalise = (value) => String(value || '').replace(/\s+/g, ' ').trim();
        // A Following player card always has an idle avatar and a text-xs name.
        // Streak is optional: offline players can show "Last online" instead.
        // React renders the search field before it has populated the player rows.
        // Re-read the same panel every 500 ms instead of treating that interim empty state as an empty Following list.
        const readPlayers = () => {
          const exactPlayerCards = Array.from(panel.querySelectorAll('div.cursor-pointer')).filter((card) => available(card)
          && Boolean(card.querySelector('img#idle'))
          && Array.from(card.querySelectorAll('.text-xs')).some((element) => {
            const text = normalise(element.textContent);
            return text && !/^\d[\d,.]*k?$/i.test(text) && !/^Streak\s*:/i.test(text);
          }));
        const exactPlayers = exactPlayerCards.map((card) => {
          const streak = card.innerText.match(/\bStreak\s*:\s*(\d+)\b/i)?.[1] || '';
          const name = Array.from(card.querySelectorAll('.text-xs')).map((element) => normalise(element.textContent)).find((text) => text && !/^\d[\d,.]*k?$/i.test(text) && !/^Streak\s*:/i.test(text)) || '';
          const avatar = card.querySelector('img#idle')?.currentSrc || card.querySelector('img#idle')?.src || '';
          const icons = Array.from(card.querySelectorAll('div.flex.items-center.gap-1.flex-wrap img'))
            .map((image) => image.currentSrc || image.src || '')
            .filter(Boolean);
          return { name, streak, avatar, icons };
        }).filter((player) => player.name);
        if (exactPlayers.length) return { players: exactPlayers, followingCount: Number.isFinite(followingCount) ? followingCount : null, message: '' };
        const streakLeaves = Array.from(panel.querySelectorAll('span, p, div')).filter((element) => {
          if (!available(element) || Array.from(element.children).some((child) => /\b\d+\s*(?:day\s*)?streak\b|\bstreak\s*:?\s*\d+/i.test(child.textContent || ''))) return false;
          return /\b\d+\s*(?:day\s*)?streak\b|\bstreak\s*:?\s*\d+/i.test(element.textContent || '');
        });
        const players = [];
        const seen = new Set();
        streakLeaves.forEach((streakLeaf) => {
          let row = streakLeaf;
          while (row.parentElement && Array.from(row.parentElement.querySelectorAll('span, p, div')).filter((element) => /\b\d+\s*(?:day\s*)?streak\b|\bstreak\s*:?\s*\d+/i.test(element.textContent || '')).length === 1) row = row.parentElement;
          const streakMatch = normalise(row.innerText).match(/(?:\b(\d+)\s*(?:day\s*)?streak\b|\bstreak\s*:?\s*(\d+))/i);
          const streak = streakMatch?.[1] || streakMatch?.[2];
          const lines = String(row.innerText || '').split(/\n/).map(normalise).filter((line) => line && !/following|followers|cheer|streak/i.test(line) && !/^\d+$/.test(line));
          const textCandidates = Array.from(row.querySelectorAll('p, span')).map((element) => normalise(element.textContent)).filter((text) => text && !/following|followers|cheer|streak/i.test(text) && !/^\d+$/.test(text));
          const avatar = Array.from(row.querySelectorAll('img')).map((image) => image.currentSrc || image.src || '').find((source) => source && !/search|close|cheer|streak|flame|ui\//i.test(source)) || '';
          const name = textCandidates.find((text) => /[a-z\p{L}]/iu.test(text)) || lines.find((line) => /[a-z\p{L}]/iu.test(line)) || row.querySelector('img[alt]')?.alt?.trim() || '';
          if (!name || !streak || seen.has(name.toLowerCase())) return;
          seen.add(name.toLowerCase());
          players.push({ name, streak, avatar });
        });
        return { players, followingCount: Number.isFinite(followingCount) ? followingCount : null, message: players.length ? '' : 'Following đang trống hoặc game chưa hiển thị dữ liệu người chơi.' };
        };
        const listDeadline = Date.now() + 8000;
        let listResult;
        do {
          listResult = readPlayers();
          if (listResult && listResult.players && listResult.players.length) return listResult || { players: [], message: "Không tìm thấy danh sách Following." };
          await sleep(500);
        } while (Date.now() < listDeadline);
        return listResult;
      }
    });
    if (!result) throw new Error("Không thể đọc dữ liệu Following.");
    if (result.error) throw new Error(result.error);
    (result.players || []).forEach((player) => {
      if ((player.icons || []).some(hasCheeredIndicator)) cheerAvailability.set(cheerPlayerKey(player.name), false);
      if ((player.icons || []).some(hasHelpedIndicator)) helpAvailability.set(cheerPlayerKey(player.name), false);
    });
    renderCheerPlayers(result);
  } catch (error) {
    renderCheerPlayers({ players: [], message: error.message || 'Không thể đọc Following.' });
    logActionError(error.message || 'Không thể đọc Following.');
  }
}

const cheerTab = mapActivityTabs.find((tab) => tab.dataset.mapActivityTab === 'cheer');
cheerTab?.addEventListener('click', () => { void scanFollowingForCheer(); });

cheerResults?.addEventListener('click', (event) => {
  const actionButton = event.target.closest('.cheer-action-button');
  if (actionButton) {
    const action = actionButton.dataset.cheerAction;
    if (!['cheer', 'help'].includes(action) || actionButton.disabled) return;
    const playerName = actionButton.dataset.cheerPlayer;
    const playerCard = actionButton.closest('.cheer-card');
    setCardLoading(playerCard, action === 'help' ? 'Helping...' : 'Cheering...');
    void (async () => {
      await ensureFollowingPlayerProfile(playerName);
      if (action === 'help') {
        const result = await helpFromProfile();
        setHelpAvailability(playerName, false);
        activeCheerPlayerName = '';
        cheerResults?.querySelector('.cheer-card.is-selected')?.classList.remove('is-selected');
        log(`Đã Help ${playerName}: ${result.helped || 0} mục.`);
        await new Promise((resolve) => setTimeout(resolve, 250));
        await scanFollowingForCheer();
        return;
      }
      const cheerResult = await sendCheerFromProfile();
      if (cheerResult.alreadyCheered) {
        setCheerAvailability(playerName, false);
        log(`${playerName} đã được Cheer từ trước.`);
        return;
      }
      if (!cheerResult.sent) throw new Error('Không thể gửi Cheer.');
      setCheerAvailability(playerName, false);
      log(`Đã Cheer ${playerName}.`);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await scanFollowingForCheer();
    })().catch((error) => logActionError(error.message || 'Cheer thất bại.')).finally(() => {
      clearCardLoading(playerCard);
    });
    return;
  }
  if (event.target.closest('button')) return;
  const card = event.target.closest('.cheer-card[data-cheer-player]');
  if (!card) return;
  const playerName = card.dataset.cheerPlayer;
  const normalise = (value) => String(value || '').trim().toLocaleLowerCase();
  card.classList.add('is-opening');
  setCardLoading(card, 'Opening...');
  void (async () => {
    if (normalise(activeCheerPlayerName) === normalise(playerName)) {
      const closeResult = await closeFollowingPlayerInfo();
      if (closeResult.closed) {
        activeCheerPlayerName = '';
        card.classList.remove('is-selected');
        return;
      }
      activeCheerPlayerName = '';
    } else await ensureFollowingPlayerProfile(playerName);
  })().catch((error) => logActionError(error.message || 'Không thể mở thông tin người chơi.')).finally(() => {
    card.classList.remove('is-opening');
    clearCardLoading(card);
  });
});
