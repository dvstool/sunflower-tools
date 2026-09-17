(() => {
  'use strict';
  const SFT_API = 'https://sunflower-tools-license.sfl-ext-sang.workers.dev';

  const shareSection = document.getElementById('license-share-section');
  const shareList = document.getElementById('license-share-list');

  async function getFarmId() {
    const stored = await chrome.storage.local.get('sftFarmId');
    return stored.sftFarmId || '';
  }

  async function loadMyLicenses() {
    const farmId = await getFarmId();
    const sec = document.getElementById('license-share-section');
    const list = document.getElementById('license-share-list');
    console.log('[GiftSystem] loadMyLicenses() called — farmId:', farmId, '| sec:', !!sec, '| list:', !!list);
    if (!sec || !list) { console.warn('[GiftSystem] DOM elements missing!'); return; }

    if (!farmId) {
      sec.hidden = false;
      list.innerHTML = '<div class="empty-state" style="font-size:12px;padding:8px 0">Chưa nhận diện được địa chỉ ví.</div>';
      console.warn('[GiftSystem] No farmId found in storage.');
      return;
    }

    sec.hidden = false;
    list.innerHTML = '<div class="empty-state" style="font-size:12px;padding:8px 0">Đang tải...</div>';

    try {
      const url = `${SFT_API}/v1/my-licenses?farmId=${encodeURIComponent(farmId)}`;
      console.log('[GiftSystem] Fetching:', url);
      const res = await fetch(url);
      console.log('[GiftSystem] Response status:', res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('[GiftSystem] API data:', JSON.stringify(data));

      const incoming = data.incoming || [];
      const licenses = data.licenses || [];
      const outgoing = data.shares || [];
      console.log('[GiftSystem] incoming:', incoming.length, '| licenses:', licenses.length, '| outgoing:', outgoing.length);

      list.innerHTML = '';

      // 1. Hiển thị quà đang chờ nhận (ưu tiên đầu tiên)
      for (const gift of incoming) {
        const el = document.createElement('div');
        el.className = 'share-item share-item-gift';
        el.style.cssText = 'border-color:var(--gold);background:rgba(234,179,8,0.08)';
        el.innerHTML = `
          <div class="share-item-header" style="color:var(--gold)">
            <strong>🎁 Quà tặng: Gói ${gift.tier.toUpperCase()}</strong>
          </div>
          <div style="font-size:12px;margin:4px 0 8px;color:var(--text-muted)">
            Từ Ví: <strong style="color:var(--text)">${gift.from_farm_id}</strong>
          </div>
          <div class="share-item-form">
            <button type="button" class="btn-accept-gift" data-share-id="${gift.id}" data-license-id="${gift.license_id}"
              style="flex:1;padding:6px 12px;background:var(--gold);color:#000;border:none;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px">
              Nhận & Nâng cấp ngay
            </button>
          </div>
        `;
        list.appendChild(el);
      }

      // 2. Hiển thị các key đang sở hữu
      for (const lic of licenses) {
        const isSharing = outgoing.find(s => s.license_id === lic.id);
        const el = document.createElement('div');
        el.className = 'share-item';

        let content = `
          <div class="share-item-header">
            <strong>Gói ${lic.tier.toUpperCase()}</strong>
            <span style="color:var(--text-muted);font-size:11px">${lic.expires_at ? 'Hạn: ' + new Date(lic.expires_at).toLocaleDateString('vi-VN') : 'Vĩnh viễn'}</span>
          </div>
        `;

        if (isSharing) {
          content += `
            <div class="share-item-pending">
              <span>⏳ Đang tặng <strong>${isSharing.to_farm_id}</strong></span>
              <button type="button" data-cancel-share="${lic.id}">Huỷ</button>
            </div>
          `;
        } else {
          content += `
            <div class="share-item-form">
              <input type="text" placeholder="Địa chỉ ví người nhận (0x...)" id="share-target-${lic.id}">
              <button type="button" data-share="${lic.id}">Tặng</button>
            </div>
          `;
        }
        el.innerHTML = content;
        list.appendChild(el);
      }

      if (incoming.length === 0 && licenses.length === 0) {
        list.innerHTML = '<div class="empty-state" style="font-size:12px;padding:8px 0">Bạn chưa sở hữu gói nào để chia sẻ.</div>';
      }

    } catch {
      list.innerHTML = '<div class="empty-state" style="font-size:12px;padding:8px 0;color:#ef4444">Lỗi khi tải. Thử lại sau.</div>';
    }
  }

  // Xử lý click trong shareList (Tặng / Huỷ / Nhận)
  shareList?.addEventListener('click', async (e) => {
    const farmId = await getFarmId();

    // Nhận quà
    const btnAccept = e.target.closest('.btn-accept-gift');
    if (btnAccept) {
      const licenseId = btnAccept.dataset.licenseId;
      btnAccept.disabled = true;
      btnAccept.textContent = 'Đang nhận...';
      try {
        const res = await fetch(`${SFT_API}/v1/share/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ farmId, licenseId })
        });
        const data = await res.json();
        if (res.ok && data.key) {
          const stored = await chrome.storage.local.get('licenseState');
          const newState = { ...(stored.licenseState || {}), key: data.key, tier: data.tier };
          await chrome.storage.local.set({ licenseState: newState });
          alert(`🎉 Chúc mừng! Bạn đã nhận thành công gói ${data.tier.toUpperCase()}!`);
          window.location.reload();
        } else {
          alert(data.message || 'Lỗi khi nhận gói.');
          btnAccept.disabled = false;
          btnAccept.textContent = 'Nhận & Nâng cấp ngay';
        }
      } catch {
        alert('Lỗi kết nối.');
        btnAccept.disabled = false;
        btnAccept.textContent = 'Nhận & Nâng cấp ngay';
      }
      return;
    }

    // Huỷ tặng
    const btnCancel = e.target.closest('[data-cancel-share]');
    if (btnCancel) {
      const licenseId = btnCancel.dataset.cancelShare;
      btnCancel.disabled = true;
      try {
        await fetch(`${SFT_API}/v1/share/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ farmId, licenseId })
        });
        loadMyLicenses();
      } catch { btnCancel.disabled = false; }
      return;
    }

    // Gửi tặng
    const btnShare = e.target.closest('[data-share]');
    if (btnShare) {
      const licenseId = btnShare.dataset.share;
      const input = document.getElementById(`share-target-${licenseId}`);
      const targetFarmId = input?.value?.trim();
      if (!targetFarmId) { alert('Vui lòng nhập địa chỉ ví người nhận!'); return; }
      btnShare.disabled = true;
      try {
        const res = await fetch(`${SFT_API}/v1/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ farmId, targetFarmId, licenseId })
        });
        const data = await res.json();
        if (!res.ok) alert(data.message || 'Lỗi khi tặng gói.');
        loadMyLicenses();
      } catch { btnShare.disabled = false; }
    }
  });

  // Tải khi mở Settings
  document.getElementById('open-settings')?.addEventListener('click', () => {
    loadMyLicenses();
  });

  // Tải ngay khi script chạy, delay nhỏ để đảm bảo DOM sẵn sàng
  setTimeout(loadMyLicenses, 300);

})();
