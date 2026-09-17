/* Hover a panel card to reveal its matching placements on the game map. */

let mapHighlightRequest = 0;
const mapHighlightSession = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let mapHoverHighlightsEnabled = true;

async function clearMapCardHighlight() {
  const request = ++mapHighlightRequest;
  try {
    await executeOnSunflowerTabs({
      func: (requestedVersion, requestedSession) => {
        const previousRequest = globalThis.__sunflowerToolsHighlightRequest || {};
        if (previousRequest.session === requestedSession && requestedVersion < previousRequest.version) return;
        globalThis.__sunflowerToolsHighlightRequest = { session: requestedSession, version: requestedVersion };
        document.querySelectorAll('.sunflower-tools-panel-target-overlay').forEach((overlay) => overlay.remove());
        document.querySelectorAll('.sunflower-tools-panel-target, .sunflower-tools-panel-target--desert').forEach((placement) => placement.classList.remove('sunflower-tools-panel-target', 'sunflower-tools-panel-target--desert'));
      },
      args: [request, mapHighlightSession]
    });
  } catch { /* Hover feedback is optional. */ }
}

async function setMapCardHighlight(mapKeys = []) {
  if (!mapHoverHighlightsEnabled) return;
  const request = ++mapHighlightRequest;
  try {
    await executeOnSunflowerTabs({
      func: (keys, requestedVersion, requestedSession) => {
        const className = 'sunflower-tools-panel-target';
        const desertClassName = 'sunflower-tools-panel-target--desert';
        const overlayClassName = 'sunflower-tools-panel-target-overlay';
        const styleId = 'sunflower-tools-panel-target-style';
        const previousRequest = globalThis.__sunflowerToolsHighlightRequest || {};
        if (previousRequest.session === requestedSession && requestedVersion < previousRequest.version) return;
        globalThis.__sunflowerToolsHighlightRequest = { session: requestedSession, version: requestedVersion };
        let style = document.getElementById(styleId);
        if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          document.documentElement.append(style);
        }
        style.textContent = `
            .${className} {
              outline: 3px solid #facc15 !important;
              outline-offset: 3px !important;
              border-radius: 5px !important;
              box-shadow: 0 0 0 2px rgba(255, 255, 255, .88), 0 0 18px 7px rgba(250, 204, 21, .8) !important;
              animation: sunflower-tools-panel-target-pulse .8s ease-in-out infinite alternate !important;
              z-index: 9999 !important;
            }
            .${className}.${desertClassName} {
              outline: 3px solid #22d3ee !important;
              outline-offset: 3px !important;
              box-shadow: 0 0 0 2px rgba(255, 255, 255, .9), 0 0 18px 7px rgba(34, 211, 238, .9) !important;
            }
            .${overlayClassName} {
              position: fixed;
              z-index: 2147483647;
              pointer-events: none;
              box-sizing: border-box;
              border: 3px solid #facc15;
              border-radius: 7px;
              box-shadow: 0 0 0 2px rgba(255, 255, 255, .9), 0 0 18px 7px rgba(250, 204, 21, .82);
              animation: sunflower-tools-panel-target-pulse .8s ease-in-out infinite alternate;
            }
            .${overlayClassName}.${desertClassName} {
              border: 3px solid #22d3ee;
              box-shadow: 0 0 0 2px rgba(255, 255, 255, .9), 0 0 18px 7px rgba(34, 211, 238, .9);
            }
            .${overlayClassName}.is-marker {
              border-radius: 50%;
              background: rgba(250, 204, 21, .28);
              box-shadow: 0 0 0 2px rgba(255, 255, 255, .9), 0 0 12px 5px rgba(250, 204, 21, .82);
            }
            .${overlayClassName}.is-marker.${desertClassName} {
              background: rgba(34, 211, 238, .3);
              box-shadow: 0 0 0 2px rgba(255, 255, 255, .9), 0 0 12px 5px rgba(34, 211, 238, .88);
            }
            @keyframes sunflower-tools-panel-target-pulse {
              from { filter: brightness(1); }
              to { filter: brightness(1.32); }
            }
          `;
        const placements = Array.from(document.querySelectorAll('div[data-map-placement="true"]'));
        const genesisSource = document.querySelector('#genesisBlock')?.getAttribute('src') || '';
        const isDesert = /(?:^|\/)desert(?:\/|_)/i.test(genesisSource);
        placements.forEach((placement) => placement.classList.remove(className, desertClassName));
        document.querySelectorAll(`.${overlayClassName}`).forEach((overlay) => overlay.remove());
        const normaliseMapKey = (value) => String(value || '').replace(/\s+/g, '');
        const requestedKeys = new Set((keys || []).map(normaliseMapKey));
        const targets = placements.flatMap((placement) => {
          const liveKey = `${placement.style.top}|${placement.style.left}`;
          const scanKey = placement.dataset.sunflowerToolsMapKey || liveKey;
          if (!requestedKeys.has(normaliseMapKey(liveKey)) && !requestedKeys.has(normaliseMapKey(scanKey))) return [];
          const rect = placement.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 ? [{ placement, rect }] : [];
        });
        targets.forEach(({ rect }) => {
          const size = 18;
          const overlay = document.createElement('div');
          overlay.className = `${overlayClassName} is-marker${isDesert ? ` ${desertClassName}` : ''}`;
          overlay.style.left = `${Math.max(0, rect.left + rect.width / 2 - size / 2)}px`;
          overlay.style.top = `${Math.max(0, rect.top + rect.height / 2 - size / 2)}px`;
          overlay.style.width = `${size}px`;
          overlay.style.height = `${size}px`;
          document.body.append(overlay);
        });
      },
      args: [mapKeys, request, mapHighlightSession]
    });
  } catch {
    // Hover feedback is optional; never interrupt a panel interaction for it.
  }
}

function mapKeysFromCard(card) {
  return card?.dataset.mapKeys?.split('||').filter(Boolean) || [];
}

mapActivityContent.addEventListener('pointerover', (event) => {
  const card = event.target.closest('.crop-card[data-map-keys]');
  if (!card || card.contains(event.relatedTarget)) return;
  const mapKeys = mapKeysFromCard(card);
  if (mapKeys.length) void setMapCardHighlight(mapKeys);
});

mapActivityContent.addEventListener('pointerout', (event) => {
  const card = event.target.closest('.crop-card[data-map-keys]');
  if (!card || card.contains(event.relatedTarget)) return;
  void setMapCardHighlight();
});

async function initialiseMapHoverHighlights() {
  const { mapHoverHighlightsEnabled: enabled = true } = await chrome.storage.local.get('mapHoverHighlightsEnabled');
  mapHoverHighlightsEnabled = enabled;
  if (mapHoverHighlightsToggle) mapHoverHighlightsToggle.checked = enabled;
  if (!enabled) await clearMapCardHighlight();
}

mapHoverHighlightsToggle?.addEventListener('change', async () => {
  mapHoverHighlightsEnabled = mapHoverHighlightsToggle.checked;
  await chrome.storage.local.set({ mapHoverHighlightsEnabled });
  if (!mapHoverHighlightsEnabled) await clearMapCardHighlight();
});

void initialiseMapHoverHighlights();
