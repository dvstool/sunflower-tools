/* License activation and periodic verification for release builds. */

import { licenseConfig } from './license-config.js';
import { verifyLicensePayload } from './license-verify.js';

(() => {
  const config = licenseConfig;
  const apiBaseUrl = String(config.apiBaseUrl || '').replace(/\/$/, '');
  const storageKey = 'licenseState';
  const installationKey = 'licenseInstallationId';
  const activationTimeoutMs = 12_000;
  const revalidationIntervalMs = 300_000;
  let revalidationTimer;
  let footerCountdownTimer;
  let upgradeFormBound = false;
  let verifiedState = null;
  const serverTierNames = new Set(['silver', 'gold']);
  const tierRanks = { basic: 0, silver: 1, gold: 2 };

  // Server assertions use the same public tier names as the panel.
  function publicTier(value) {
    const tier = String(value || '').toLowerCase();
    if (tier === 'gold') return 'gold';
    if (tier === 'silver') return 'silver';
    return 'basic';
  }

  function isEnabled() {
    return Boolean(config.enabled && apiBaseUrl);
  }

  function formatRemainingTime(milliseconds) {
    const day = 24 * 60 * 60 * 1000;
    return `${Math.max(1, Math.ceil(milliseconds / day))} days left`;
  }

  function formatExpiry(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    const part = (number) => String(number).padStart(2, '0');
    return `${part(date.getDate())}/${part(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  function deviceCode(state) {
    const id = String(state?.payload?.installationId || '');
    return id ? id.slice(0, 8).toUpperCase() : 'ĐANG TẢI';
  }

  function payloadIsCurrent(payload, installationId) {
    return Boolean(payload && payload.installationId === installationId && serverTierNames.has(String(payload.tier || '').toLowerCase())
      && Number(payload.validUntil) > Date.now() && (!payload.expiresAt || Date.parse(payload.expiresAt) > Date.now()));
  }

  async function loadAndVerify(state) {
    const stored = state ? { [storageKey]: state } : await chrome.storage.local.get(storageKey);
    const candidate = stored[storageKey];
    const installationId = await getInstallationId();
    if (!candidate?.payload || !candidate?.signature || !payloadIsCurrent(candidate.payload, installationId)
      || !await verifyLicensePayload(config, candidate.payload, candidate.signature)) {
      verifiedState = null;
      return null;
    }
    verifiedState = candidate;
    return verifiedState;
  }

  function configuredLocalTier() {
    const tier = String(config.localTier || '').toLowerCase();
    return serverTierNames.has(tier) ? publicTier(tier) : '';
  }

  function tierFor(state = verifiedState) {
    const localTier = configuredLocalTier();
    if (localTier) return localTier;
    return publicTier(state?.payload?.tier);
  }

  async function hasVerifiedTier(required) {
    const state = verifiedState || await loadAndVerify();
    return (tierRanks[tierFor(state)] || 0) >= (tierRanks[required] || 0);
  }

  async function requireTier(required) {
    if (await hasVerifiedTier(required)) return verifiedState;
    const error = new Error(`${required === 'gold' ? 'Gold' : 'Silver'} plan is required.`);
    error.tierDenied = true;
    throw error;
  }

  function activationState(key, result, previous = {}) {
    return { ...previous, key, payload: result.payload, signature: result.signature };
  }

  function basicState(previous = {}) {
    return { ...previous, key: '', payload: null, signature: '', active: true };
  }

  async function notifyLicenseBlocked(message) {
    try {
      await chrome.notifications.create('sunflower-license-blocked', {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/notification-icon.png'),
        title: 'Lỗi Bản Quyền',
        message: message || 'Bản quyền của bạn không còn hợp lệ trên thiết bị này.',
        priority: 2
      });
    } catch { /* Notifications are optional and must not block license cleanup. */ }
    if (typeof alert === 'function') {
      setTimeout(() => alert(`⚠️ BẢN QUYỀN BỊ VÔ HIỆU HOÁ\n\n${message || 'Key không hợp lệ hoặc đã bị chặn.'}`), 500);
    }
  }

  async function expireLicenseAtDeadline(state) {
    const nextState = basicState(state);
    renderLicenseFooter(nextState);
    try { await chrome.storage.local.set({ [storageKey]: nextState }); } catch { /* The Basic plan remains available for this session. */ }
  }

  function renderLicenseFooter(state) {
    window.clearInterval(footerCountdownTimer);
    const tier = tierFor(state);
    const activeTier = state ? tier : 'basic';
    document.body.dataset.licenseTier = activeTier;
    window.dispatchEvent(new CustomEvent('sunflower-license-tier-changed', { detail: { tier: activeTier } }));
    const tierBadge = document.querySelector('#license-user-tier');
    if (tierBadge) {
      tierBadge.hidden = true;
    }
    const headerBtn = document.querySelector('#tier-badge-btn');
    if (headerBtn) {
      headerBtn.hidden = false;
      headerBtn.className = `tier-badge-btn ${activeTier}`;
      headerBtn.textContent = activeTier === 'gold' ? 'Gold' : activeTier === 'silver' ? 'Silver' : 'Basic';
      headerBtn.onclick = () => {
        document.querySelector('[data-tool-tab="settings"]')?.click();
      };
    }
    const info = document.querySelector('#license-user-details');
    if (!info) return;
    const setDetails = (text) => {
      info.textContent = text;
    };
    const settingsPlan = document.querySelector('#settings-current-plan');
    if (!state || activeTier === 'basic') {
      setDetails('Free plan');
      if (settingsPlan) settingsPlan.innerHTML = '<strong>Gói hiện tại:</strong> Basic (Miễn phí)';
      return;
    }
    if (!state.payload?.expiresAt) {
      setDetails('Expires: Unlimited');
      if (settingsPlan) settingsPlan.innerHTML = `<strong>Gói hiện tại:</strong> ${activeTier.toUpperCase()}<br><strong>Hạn dùng:</strong> Vĩnh viễn`;
      return;
    }
    const expiresAt = new Date(state.payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      setDetails('Expires: Unknown');
      if (settingsPlan) settingsPlan.innerHTML = `<strong>Gói hiện tại:</strong> ${activeTier.toUpperCase()}<br><strong>Hạn dùng:</strong> Không xác định`;
      return;
    }
    const updateRemainingTime = () => {
      if (Number(state.payload?.validUntil) <= Date.now()) {
        verifiedState = null;
        renderLicenseFooter(null);
        return false;
      }
      const remaining = expiresAt.getTime() - Date.now();
      if (remaining <= 0) {
        setDetails('License expired');
        void expireLicenseAtDeadline(state);
        return false;
      }
      info.className = 'license-user-details';
      info.replaceChildren();
      const top = document.createElement('span');
      top.className = 'license-detail-row';
      const key = document.createElement('span');
      key.append('KEY: ');
      const keyValue = document.createElement('b');
      keyValue.textContent = `${String(state.key || '').slice(0, 8)}…`;
      key.append(keyValue);
      const device = document.createElement('span');
      device.append('Device: ');
      const deviceValue = document.createElement('b');
      deviceValue.textContent = deviceCode(state);
      device.append(deviceValue);
      chrome.storage.local.get(['sftWalletAddress', 'sftFarmId']).then(stored => {
        const wallet = stored.sftWalletAddress || stored.sftFarmId;
        if (wallet && /^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
          device.childNodes[0].textContent = 'Ví: ';
          deviceValue.textContent = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
          device.title = `Tài khoản Ví: ${wallet}`;
        }
      });
      top.append(key, device);
      const bottom = document.createElement('span');
      bottom.className = 'license-detail-row';
      const expiry = document.createElement('span');
      expiry.textContent = `Expires: ${formatExpiry(state.payload?.expiresAt)}`;
      const countdown = document.createElement('span');
      countdown.textContent = formatRemainingTime(remaining);
      bottom.append(expiry, countdown);
      info.append(top, bottom);
      
      if (settingsPlan) {
        settingsPlan.innerHTML = `<strong>Gói hiện tại:</strong> ${activeTier.toUpperCase()}<br><strong>Ngày hết hạn:</strong> ${formatExpiry(state.payload?.expiresAt)} (${formatRemainingTime(remaining)})`;
      }
      return true;
    };
    if (updateRemainingTime()) {
      footerCountdownTimer = window.setInterval(() => {
        if (!updateRemainingTime()) window.clearInterval(footerCountdownTimer);
      }, 1000);
    }
  }

  async function getInstallationId() {
    const stored = await chrome.storage.local.get(installationKey);
    if (stored[installationKey]) return stored[installationKey];
    const id = crypto.randomUUID();
    await chrome.storage.local.set({ [installationKey]: id });
    return id;
  }

  async function getFarmId() {
    const stored = await chrome.storage.local.get(['sftWalletAddress', 'sftFarmId']);
    const val = String(stored.sftWalletAddress || stored.sftFarmId || '').trim();
    if (!/^0x[a-fA-F0-9]{40}$/i.test(val)) return '';
    return val.toLowerCase();
  }

  async function getWalletAddress() {
    return await getFarmId();
  }

  async function getGameToken() {
    const stored = await chrome.storage.local.get('sftGameToken');
    return stored.sftGameToken || '';
  }

  async function reportBasicUsage() {
    if (!isEnabled()) return;
    const installationId = await getInstallationId();
    const walletAddress = await getFarmId();
    if (!walletAddress) return; // Chỉ gửi báo cáo khi có Ví Web3
    console.log('[SFL License] reportBasicUsage được gọi. Ví:', walletAddress, 'Installation ID:', installationId.slice(0, 8));
    const gameToken = await getGameToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), activationTimeoutMs);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/official/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationId, farmId: walletAddress, walletAddress, gameToken, extensionVersion: chrome.runtime.getManifest().version }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (result.pendingShare) {
        window.dispatchEvent(new CustomEvent('sft-pending-share', { detail: result.pendingShare }));
      }
      if (result.autoUpgrade && result.active && result.payload && result.signature) {
        const currentTier = tierFor(verifiedState || {});
        if (currentTier === 'basic') {
          const headerBtn = document.querySelector('#tier-badge-btn');
          if (headerBtn) {
            headerBtn.hidden = false;
            const upgradeTier = result.payload.tier.toLowerCase();
            headerBtn.className = `tier-badge-btn ${upgradeTier}`;
            headerBtn.textContent = upgradeTier === 'gold' ? 'Up Gold' : 'Up Silver';
            headerBtn.onclick = async () => {
              headerBtn.textContent = 'Nâng cấp...';
              const stored = await chrome.storage.local.get(storageKey);
              await activateAndStore('SFT-AUTO', stored[storageKey] || {});
            };
          }
        }
      }
    } catch { /* Basic usage reporting must not interrupt the free plan. */ }
    finally { clearTimeout(timeout); }
  }

  async function callActivation(key, previousDeviceCode = '') {
    const installationId = await getInstallationId();
    const walletAddress = await getFarmId();
    if (!walletAddress) {
      const error = new Error('Bạn cần đăng nhập game bằng Ví Web3 (MetaMask/OKX) để kích hoạt bản quyền.');
      error.licenseDenied = true;
      throw error;
    }
    const gameToken = await getGameToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), activationTimeoutMs);
    try {
      if (key === 'SFT-AUTO') {
        const response = await fetch(`${apiBaseUrl}/v1/official/usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ installationId, farmId: walletAddress, walletAddress, gameToken, extensionVersion: chrome.runtime.getManifest().version }),
          signal: controller.signal
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.autoUpgrade || !result.active || !result.payload || !result.signature) {
          const error = new Error('Tài khoản ví không (hoặc không còn) liên kết với License hợp lệ.');
          error.licenseDenied = true;
          throw error;
        }
        if (result.pendingShare) {
          window.dispatchEvent(new CustomEvent('sft-pending-share', { detail: result.pendingShare }));
        }
        return result;
      }

      const response = await fetch(`${apiBaseUrl}/v1/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, installationId, farmId: walletAddress, walletAddress, gameToken, previousDeviceCode, extensionVersion: chrome.runtime.getManifest().version }),
        signal: controller.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.active || !result.payload || !result.signature) {
        const error = new Error(result.message || 'Key không hợp lệ hoặc đã hết hạn.');
        error.licenseDenied = true;
        throw error;
      }
      if (result.pendingShare) {
        window.dispatchEvent(new CustomEvent('sft-pending-share', { detail: result.pendingShare }));
      }
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Máy chủ license không phản hồi sau 12 giây. Hãy thử lại.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  function activationErrorMessage(error) {
    console.error('License activation failed:', error);
    return error?.message === 'Failed to fetch' ? 'Không thể kết nối máy chủ license. Kiểm tra mạng rồi thử lại.' : (error?.message || 'Không thể xác thực key.');
  }

  async function activateAndStore(key, previous = {}, previousDeviceCode = '') {
    const result = await callActivation(key, previousDeviceCode);
    const nextState = activationState(key, result, previous);
    if (!await loadAndVerify(nextState)) {
      const error = new Error('License assertion could not be verified.');
      error.licenseDenied = true;
      throw error;
    }
    await chrome.storage.local.set({ [storageKey]: nextState });
    renderLicenseFooter(nextState);
    return nextState;
  }

  function bindUpgradeForm() {
    const form = document.querySelector('#license-upgrade-form');
    if (!form || upgradeFormBound) return;
    upgradeFormBound = true;
    const input = form.querySelector('#license-upgrade-key');
    const message = form.querySelector('#license-upgrade-message');
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const key = input.value.trim().toUpperCase();
      if (!key) { message.textContent = 'Hãy nhập key nâng cấp.'; return; }
      button.disabled = true;
      message.textContent = 'Đang xác thực key…';
      try {
        const stored = await chrome.storage.local.get(storageKey);
        const nextState = await activateAndStore(key, stored[storageKey] || {});
        input.value = '';
        const tierLabel = tierFor(nextState) === 'basic' ? 'Basic' : tierFor(nextState).toUpperCase();
        message.textContent = `Đã kích hoạt gói ${tierLabel}.`;
      } catch (error) {
        message.textContent = activationErrorMessage(error);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function requireActivation() {
    bindUpgradeForm();
    const stored = await chrome.storage.local.get(storageKey);
    const savedState = stored[storageKey] || {};
    const storedKey = typeof savedState.key === 'string' ? savedState.key : '';
    const cachedState = await loadAndVerify(savedState);
    if (!isEnabled() || !storedKey) {
      const nextState = basicState(savedState);
      await chrome.storage.local.set({ [storageKey]: nextState });
      renderLicenseFooter(nextState);
      if (!configuredLocalTier()) void reportBasicUsage();
      return true;
    }
    if (cachedState) renderLicenseFooter(cachedState);
    try {
      await activateAndStore(storedKey, savedState);
    } catch (error) {
      if (!error?.licenseDenied && cachedState) {
        renderLicenseFooter(cachedState);
        return true;
      }
      if (error?.licenseDenied) {
        const nextState = basicState(savedState);
        await chrome.storage.local.set({ [storageKey]: nextState });
        renderLicenseFooter(nextState);
        void notifyLicenseBlocked(activationErrorMessage(error));
        if (!configuredLocalTier()) void reportBasicUsage();
      } else renderLicenseFooter(null);
    }
    return true;
  }

  function startWatchdog() {
    if (revalidationTimer || !isEnabled()) return;
    const triggerPing = async () => {
      const stored = await chrome.storage.local.get(storageKey);
      const state = stored[storageKey];
      if (!state?.key) return;
      try {
        await activateAndStore(state.key, state);
      } catch (error) {
        if (!error?.licenseDenied && await loadAndVerify(state)) return;
        if (error?.licenseDenied) {
          const nextState = basicState(state);
          await chrome.storage.local.set({ [storageKey]: nextState });
          renderLicenseFooter(nextState);
          void notifyLicenseBlocked(activationErrorMessage(error));
        } else renderLicenseFooter(null);
      }
    };
    setTimeout(triggerPing, 1000);
    revalidationTimer = setInterval(triggerPing, revalidationIntervalMs);
  }

  const manager = Object.freeze({
    requireActivation,
    reportBasicUsage,
    isEnabled,
    startWatchdog,
    hasTier: (required) => (tierRanks[tierFor()] || 0) >= (tierRanks[required] || 0),
    hasVerifiedTier,
    requireTier,
    beginAction: () => () => {}
  });
  Object.defineProperty(window, 'licenseManager', { value: manager, configurable: false, writable: false });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['sftFarmId']) {
      void reportBasicUsage();
    }
    if (changes[storageKey]) {
      void loadAndVerify().then((state) => {
        renderLicenseFooter(state);
        window.refreshFeatureAccess?.();
      });
    }
  });
})();
