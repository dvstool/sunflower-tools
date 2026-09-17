/* Connection discovery and page-script execution boundary. */

const translate = (key, fallback) => window.panelI18n?.t?.(key, fallback) || fallback;

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}


// Find the Sunflower Land tab
async function findSunflowerTab() {
  const { sunflowerTabId } = await chrome.storage.session.get('sunflowerTabId');
  if (sunflowerTabId) {
    try {
      const rememberedTab = await chrome.tabs.get(sunflowerTabId);
      if (rememberedTab.url?.startsWith('https://sunflower-land.com/')) return rememberedTab;
    } catch { /* The remembered tab no longer exists. */ }
  }
  const allTabs = await chrome.tabs.query({ url: 'https://sunflower-land.com/*' });
  return allTabs.find((tab) => tab.active) || allTabs[0] || null;
}


async function executeOnSunflowerTabs(injection) {
  const tab = await findSunflowerTab();
  if (!tab?.id) throw new Error(translate('noOpenTab', 'No Sunflower Land tab is open.'));
  const result = await chrome.scripting.executeScript({ ...injection, target: { tabId: tab.id } });
  chrome.storage.session.set({ sunflowerTabId: tab.id });
  return result;
}

function renderConnection(tab) {
  const connected = Boolean(tab?.url && new URL(tab.url).hostname === 'sunflower-land.com');
  connectButton.disabled = connected;
  disconnectedContent.hidden = connected;
  connectedContent.hidden = !connected;
  status.className = `connection ${connected ? 'is-connected' : 'is-disconnected'}`;
  status.innerHTML = `<span></span> ${connected ? translate('connected', 'Connected to Sunflower Land') : translate('disconnected', 'Not connected to Sunflower Land')}`;
  if (!connected) landInfo.textContent = translate('openGame', 'Open Sunflower Land to read land information.');
  return connected;
}

async function refreshConnection() {
  try {
    const tab = await findSunflowerTab();
    if (!renderConnection(tab) || !tab?.id) return;
    
    const stored = await chrome.storage.local.get(['sftFarmId', 'sftWalletAddress']);
    const isValidAccount = id => typeof id === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(id.trim());
    if (stored.sftFarmId && !isValidAccount(stored.sftFarmId)) {
      await chrome.storage.local.remove(['sftFarmId', 'sftWalletAddress']);
    }
    
    chrome.runtime.sendMessage({ type: 'SUNFLOWER_TAB_CONNECTED', tabId: tab.id, url: tab.url });

    // Quét toàn diện từ MAIN World (Web3 providers, Storage, React Fiber)
    const scanFunction = async () => {
      let gameToken = '';
      let walletAddress = '';
      let farmId = '';
      const isAddr = a => typeof a === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(a?.trim());
      const isCleanFarmId = v => {
        if (v !== undefined && v !== null && !isNaN(v)) {
          const n = Number(v);
          if (n > 0 && n < 100000000) return String(n);
        }
        return '';
      };

      // 1. Quét Web3 Providers (MetaMask, OKX, Phantom, Coinbase, v.v.)
      try {
        const providers = [
          window.ethereum,
          window.okxwallet,
          window.phantom?.ethereum,
          window.coinbaseWalletExtension,
          window.bitkeep?.ethereum
        ].filter(Boolean);

        if (Array.isArray(window.ethereum?.providers)) {
          providers.push(...window.ethereum.providers);
        }

        for (const p of providers) {
          if (p?.request) {
            try {
              const accs = await p.request({ method: 'eth_accounts' });
              if (Array.isArray(accs) && isAddr(accs[0])) { walletAddress = accs[0].toLowerCase(); break; }
            } catch {}
          }
          if (isAddr(p?.selectedAddress)) { walletAddress = p.selectedAddress.toLowerCase(); break; }
          if (Array.isArray(p?.accounts) && isAddr(p.accounts[0])) { walletAddress = p.accounts[0].toLowerCase(); break; }
          if (Array.isArray(p?._state?.accounts) && isAddr(p._state.accounts[0])) { walletAddress = p._state.accounts[0].toLowerCase(); break; }
        }

        if (!walletAddress && isAddr(window.web3?.eth?.defaultAccount)) {
          walletAddress = window.web3.eth.defaultAccount.toLowerCase();
        }

        if (!walletAddress) {
          const wagmi = window.wagmi?.store?.getState?.() || window.__WAGMI_STORE__?.getState?.();
          if (wagmi?.connections) {
            for (const conn of (wagmi.connections.values ? Array.from(wagmi.connections.values()) : [])) {
              if (Array.isArray(conn?.accounts) && isAddr(conn.accounts[0])) { walletAddress = conn.accounts[0].toLowerCase(); break; }
            }
          }
        }
      } catch {}

      // 2. Quét React Fiber từ DOM
      try {
        const elements = [
          document.querySelector('#root'),
          document.querySelector('#root > div'),
          document.querySelector('canvas'),
          ...Array.from(document.querySelectorAll('div[data-map-placement]')).slice(0, 5),
          document.body
        ].filter(Boolean);

        for (const el of elements) {
          const keys = Object.keys(el);
          const fiberKey = keys.find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactContainer$'));
          if (!fiberKey) continue;
          let rootNode = el[fiberKey];
          if (rootNode?.current) rootNode = rootNode.current;
          
          const queue = [rootNode];
          const seen = new Set();
          let count = 0;
          while (queue.length > 0 && count < 5000) {
            count++;
            const fiber = queue.shift();
            if (!fiber || seen.has(fiber)) continue;
            seen.add(fiber);

            const p = fiber.memoizedProps;
            if (p && typeof p === 'object') {
              if (!walletAddress) {
                const owner = p.gameService?.state?.context?.state?.owner
                  || p.state?.context?.state?.owner
                  || p.gameService?.state?.context?.wallet
                  || p.state?.context?.wallet
                  || p.wallet?.address
                  || p.wallet
                  || p.account
                  || p.address;
                if (isAddr(owner)) walletAddress = owner.toLowerCase();
              }
            }

            let s = fiber.memoizedState;
            while (s) {
              const val = s.memoizedState;
              if (val && typeof val === 'object') {
                if (!walletAddress) {
                  if (isAddr(val.wallet)) walletAddress = val.wallet.toLowerCase();
                  else if (isAddr(val.account)) walletAddress = val.account.toLowerCase();
                  else if (isAddr(val.address)) walletAddress = val.address.toLowerCase();
                  else if (isAddr(val.context?.state?.owner)) walletAddress = val.context.state.owner.toLowerCase();
                }
              }
              s = s.next;
            }

            if (walletAddress) break;
            if (fiber.child) queue.push(fiber.child);
            if (fiber.sibling) queue.push(fiber.sibling);
            if (fiber.return && queue.length < 30) queue.push(fiber.return);
          }
          if (walletAddress) break;
        }
      } catch (e) {
        console.warn('[React Fiber Scan Error]', e);
      }

      // 3. Quét JWT từ Storage của game để lấy ví nếu có
      const decodeJwtPayload = (tok) => {
        try {
          if (!tok || typeof tok !== 'string') return null;
          const parts = tok.split('.');
          if (parts.length < 2) return null;
          let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (b64.length % 4 !== 0) b64 += '=';
          const str = decodeURIComponent(atob(b64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
          return JSON.parse(str);
        } catch { return null; }
      };

      const storages = [localStorage, sessionStorage];
      for (const store of storages) {
        try {
          for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            const v = store.getItem(k) || '';
            if (!v) continue;

            const jwtMatches = v.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g);
            if (jwtMatches) {
              for (const jm of jwtMatches) {
                const payload = decodeJwtPayload(jm);
                if (payload && !walletAddress) {
                  for (const field of ['address', 'account', 'wallet', 'owner']) {
                    if (isAddr(payload[field])) { walletAddress = payload[field].toLowerCase(); break; }
                  }
                }
                if (walletAddress) break;
              }
            }
          }
        } catch {}
        if (walletAddress) break;
      }

      // 4. Lấy game token nếu có
      try {
        const rawTok = localStorage.getItem('rawToken') || localStorage.getItem('token') || sessionStorage.getItem('rawToken');
        if (rawTok && rawTok.startsWith('eyJ')) gameToken = rawTok;
      } catch {}

      // Yêu cầu bắt buộc: Tài khoản bản quyền CHỈ xác thực bằng Địa chỉ ví Web3
      const finalAccount = walletAddress ? walletAddress.toLowerCase() : '';
      console.log('[SFL Web3 Wallet Detected]:', { finalAccount });

      const balance = (alt) => {
        const icon = Array.from(document.querySelectorAll('img')).find((image) => image.alt.trim().toLowerCase() === alt.toLowerCase());
        const container = icon?.closest('.flex.items-center');
        return { value: container?.querySelector('.balance-text')?.textContent.trim() || '', icon: icon?.currentSrc || icon?.src || '' };
      };
      return {
        genesis: document.querySelector('#genesisBlock')?.getAttribute('src') || '',
        tree: Array.from(document.querySelectorAll('img')).map((image) => image.currentSrc || image.src || '').find((source) => /\/game-assets\/resources\/tree\/[^/]+\/[^/]+_([^/]+)_tree\.webp/i.test(source)) || '',
        balances: { coins: balance('Coins'), gems: balance('Gems'), flw: balance('FLOWER') },
        account: finalAccount,
        walletAddress: finalAccount,
        gameToken
      };
    };

    let result = null;
    try {
      const [{ result: mwResult }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: scanFunction
      });
      result = mwResult;
    } catch (e) {
      console.warn('[MAIN world execution error, fallback to ISOLATED]', e);
      const [{ result: isoResult }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scanFunction
      });
      result = isoResult;
    }

    const detectedWallet = result?.account || result?.walletAddress || '';

    // Nếu phát hiện được ví từ game -> Cập nhật storage
    if (detectedWallet && isValidAccount(detectedWallet)) {
      const normWallet = detectedWallet.toLowerCase();
      await chrome.storage.local.set({
        sftFarmId: normWallet,
        sftWalletAddress: normWallet,
        sftGameToken: result?.gameToken || ''
      });
      log('Đã nhận diện Ví Web3: ' + normWallet);
    } else {
      await chrome.storage.local.remove(['sftFarmId', 'sftWalletAddress']);
      log('Chưa phát hiện Ví Web3. Hãy đăng nhập game bằng Ví MetaMask để kích hoạt bản quyền.');
    }

    const landMatch = result?.genesis?.match(/\/land\/levels\/([^/]+)(?:\/([^/]+))?\/level_(\d+)\.(?:webp|png)/i);
    const treeMatch = result?.tree?.match(/\/resources\/tree\/([^/]+)\/([^/_]+)_([^/_]+)_tree\.webp/i);
    const landName = landMatch ? `${titleCase(landMatch[1])}.Lv${landMatch[3]}` : treeMatch ? titleCase(treeMatch[3]) : '';
    const displayedSeason = landMatch?.[2] || treeMatch?.[2];
    const image = result?.genesis || result?.tree;
    const seasonIcon = seasonIcons[String(displayedSeason || '').toLowerCase()] || seasonIcons.spring;
    const balances = result?.balances || {};
    const scannedCoins = Number(String(balances.coins?.value || '').replace(/,/g, ''));
    if (Number.isFinite(scannedCoins)) setCurrentCoins(scannedCoins);
    
    const displayWallet = (detectedWallet && isValidAccount(detectedWallet))
      ? detectedWallet.toLowerCase()
      : '';

    // Cập nhật huy hiệu Tài khoản trên thanh Header (Bắt buộc dùng Ví Web3)
    const headerBadge = document.getElementById('header-farm-badge');
    if (headerBadge) {
      if (displayWallet) {
        headerBadge.textContent = `Ví: ${displayWallet.slice(0, 6)}...${displayWallet.slice(-4)}`;
        headerBadge.title = `Tài khoản Ví Web3: ${displayWallet} (Bấm để quét lại)`;
        headerBadge.style.color = '#facc15';
      } else {
        headerBadge.textContent = 'Chưa nhận ví ⚠️';
        headerBadge.title = 'Bạn cần đăng nhập game bằng Ví Web3 (MetaMask/OKX) để kích hoạt bản quyền. Bấm để quét lại.';
        headerBadge.style.color = '#ef4444';
      }
      headerBadge.onclick = async (e) => {
        e.stopPropagation();
        headerBadge.textContent = 'Acc: Đang quét... 🔄';
        await refreshConnection();
      };
    }

    if (displayWallet) {
      // Báo cáo sử dụng lên server tự động theo Ví Web3
      window.licenseManager?.reportBasicUsage?.();
    }
    const oldFarmSpan = document.getElementById('display-farm-id');
    if (oldFarmSpan) oldFarmSpan.remove();
    
    const balanceItem = (label, balance) => balance?.value ? `<span class="land-balance"><b>${escapeHtml(balance.value)}</b>${balance.icon ? `<img src="${escapeHtml(balance.icon)}" alt="${label}" />` : label}</span>` : '';
    landInfo.innerHTML = landName ? `<div class="land-details land-info-card"><strong><img class="land-thumbnail" src="${image}" alt="Land" />${landName}</strong>${displayedSeason ? `<span><img class="season-icon" src="${seasonIcon}" alt="Season" />${titleCase(displayedSeason)}</span>` : ''}</div><div class="land-balances land-balance-card">${balanceItem('Coins', balances.coins)}${balanceItem('Gems', balances.gems)}${balanceItem('FLW', balances.flw)}</div>` : translate('landUnavailable', 'Reload the game and the extension.');
    if (lastScanData) renderOverview();
    return true;
  } catch (error) {
    const message = error?.message || String(error);
    console.warn('Sunflower Tools connection failed:', error);
    log('Failed to connect to Sunflower Land: ' + message);
    renderConnection(null);
    return false;
  }
}

async function initialisePanelConnection() {
  const connected = await refreshConnection();
  if (connected) await scanMap();
  else log('Sunflower Land tab not found. Click Connect to open the game.');
}


window.addEventListener('sunflower-language-changed', () => { void refreshConnection(); });
