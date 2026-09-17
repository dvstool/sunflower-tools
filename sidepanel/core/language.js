/* Persistent language selector and translator for extension-owned panel UI. */
(() => {
  const storageKey = 'panelLanguage';
  const english = {
    settings: 'Settings', readyNotifications: 'Ready notifications',
    readyNotificationsDescription: 'Notify when a countdown completes. Turn this on to receive a test notification.',
    hoverHighlights: 'Hover markers', hoverHighlightsDescription: 'Show map markers when hovering the matching card.',
    upgradePlan: 'Upgrade plan', upgradeDescription: 'Enter a Silver or Gold key to replace the current key.',
    upgradeKey: 'Upgrade key', confirmUpgrade: 'Confirm upgrade', tabPosition: 'Tab position',
    tabPositionDescription: 'Use the arrows to arrange the navigation bar.', reset: 'Reset',
    recentActivity: 'Recent activity', connectHeading: 'Connect to Sunflower Land',
    connectDescription: 'Open the game, then connect to use the tools.', connect: 'Connect',
    scanningLand: 'Reading land information...', mapNotScanned: 'Map has not been scanned.',
    cheerPlaceholder: 'Open the Cheer tab to view Following.', chooseSeeds: 'Choose seeds', close: 'Close',
    readingSeeds: 'Reading seeds from Betty...', settingsTab: 'Settings', language: 'Language',
    languageDescription: 'Choose the panel display language.', vietnamese: 'Vietnamese', english: 'English',
    connected: 'Connected to Sunflower Land', disconnected: 'Not connected to Sunflower Land',
    noOpenTab: 'No open Sunflower Land tab was found.', openGame: 'Open Sunflower Land to read land information.',
    landUnavailable: 'Reload the game and the extension.'
  };
  const vietnamese = {
    connected: '\u0110\u00e3 k\u1ebft n\u1ed1i Sunflower Land',
    disconnected: 'Ch\u01b0a k\u1ebft n\u1ed1i Sunflower Land',
    noOpenTab: 'Kh\u00f4ng t\u00ecm th\u1ea5y tab Sunflower Land \u0111ang m\u1edf.',
    openGame: 'M\u1edf Sunflower Land \u0111\u1ec3 \u0111\u1ecdc th\u00f4ng tin land.',
    landUnavailable: 'T\u1ea3i l\u1ea1i game v\u00e0 extension.'
  };

  // Only fixed wording created by this extension is listed here. Item names read from
  // Sunflower Land's DOM are deliberately absent, so they always retain their game name.
  const pairs = [
    ['C\u00e0i \u0111\u1eb7t', 'Settings'], ['Ng\u00f4n ng\u1eef', 'Language'], ['Ch\u1ecdn ng\u00f4n ng\u1eef hi\u1ec3n th\u1ecb cho panel.', 'Choose the panel display language.'], ['Ti\u1ebfng Vi\u1ec7t', 'Vietnamese'], ['Ti\u1ebfng Anh', 'English'], ['Th\u00f4ng b\u00e1o s\u1eb5n s\u00e0ng', 'Ready notifications'],
    ['B\u00e1o khi ti\u1ebfn tr\u00ecnh \u0111\u1ebfm ng\u01b0\u1ee3c ho\u00e0n t\u1ea5t. B\u1eadt l\u00ean \u0111\u1ec3 nh\u1eadn th\u00f4ng b\u00e1o th\u1eed.', 'Notify when a countdown completes. Turn this on to receive a test notification.'],
    ['Ch\u1ea5m tr\u00f2n khi hover', 'Hover markers'], ['Hi\u1ec3n th\u1ecb c\u00e1c ch\u1ea5m tr\u00f2n tr\u00ean map khi r\u00ea chu\u1ed9t qua card c\u00f3 v\u1ecb tr\u00ed t\u01b0\u01a1ng \u1ee9ng.', 'Show map markers when hovering the matching card.'],
    ['N\u00e2ng c\u1ea5p g\u00f3i', 'Upgrade plan'], ['Nh\u1eadp key Silver ho\u1eb7c Gold \u0111\u1ec3 thay th\u1ebf key hi\u1ec7n t\u1ea1i.', 'Enter a Silver or Gold key to replace the current key.'],
    ['Key n\u00e2ng c\u1ea5p', 'Upgrade key'], ['X\u00e1c nh\u1eadn n\u00e2ng c\u1ea5p', 'Confirm upgrade'],
    ['V\u1ecb tr\u00ed tab', 'Tab position'], ['D\u00f9ng m\u0169i t\u00ean \u0111\u1ec3 s\u1eafp x\u1ebfp thanh \u0111i\u1ec1u h\u01b0\u1edbng.', 'Use the arrows to arrange the navigation bar.'], ['M\u1eb7c \u0111\u1ecbnh', 'Reset'],
    ['Ho\u1ea1t \u0111\u1ed9ng m\u1edbi nh\u1ea5t', 'Recent activity'], ['K\u1ebft n\u1ed1i Sunflower Land', 'Connect to Sunflower Land'],
    ['M\u1edf game r\u1ed3i k\u1ebft n\u1ed1i \u0111\u1ec3 d\u00f9ng c\u00e1c c\u00f4ng c\u1ee5.', 'Open the game, then connect to use the tools.'], ['K\u1ebft n\u1ed1i', 'Connect'],
    ['\u0110ang \u0111\u1ecdc th\u00f4ng tin land\u2026', 'Reading land information...'], ['\u0110ang \u0111\u1ecdc th\u00f4ng tin land...', 'Reading land information...'],
    ['Ch\u01b0a qu\u00e9t map.', 'Map has not been scanned.'], ['M\u1edf tab Cheer \u0111\u1ec3 xem Following.', 'Open the Cheer tab to view Following.'],
    ['Ch\u1ecdn h\u1ea1t', 'Choose seeds'], ['\u0110\u00f3ng', 'Close'], ['\u0110ang \u0111\u1ecdc h\u1ea1t trong Betty\u2026', 'Reading seeds from Betty...'],
    ['\u0110i\u1ec1u h\u01b0\u1edbng ch\u00ednh', 'Main navigation'], ['N\u1ea1p l\u1ea1i extension', 'Reload extension'], ['Qu\u00e9t Map', 'Scan map'],
    ['\u0110ang ki\u1ec3m tra h\u1ea1n d\u00f9ng\u2026', 'Checking expiry...'], ['\u0110ang b\u1eadt.', 'Enabled.'], ['\u0110ang t\u1eaft.', 'Disabled.'],
    ['\u0110ang g\u1eedi th\u00f4ng b\u00e1o th\u1eed\u2026', 'Sending test notification...'], ['Chrome \u0111\u00e3 t\u1ea1o th\u00f4ng b\u00e1o th\u1eed.', 'Chrome created a test notification.'],
    ['\u0110\u1ea5t tr\u1ed1ng', 'Empty soil'], ['\u0110\u1ea5t Crop tr\u1ed1ng', 'Empty Crop soil'], ['\u0110\u1ea5t Fruit tr\u1ed1ng', 'Empty Fruit soil'], ['G\u1ed1c Fruit ch\u1ebft', 'Dead Fruit stump'],
    ['\u0110ang h\u1ed3i', 'Recovering'], ['\u0110ang l\u1edbn', 'Growing'], ['S\u1eb5n s\u00e0ng', 'Ready'], ['\u0110ang compost', 'Composting'], ['Tr\u1ed1ng', 'Empty'],
    ['\u0110ang c\u1eadp nh\u1eadt th\u1eddi gian\u2026', 'Updating time...'], ['S\u1eb5n s\u00e0ng thu ho\u1ea1ch', 'Ready to harvest'], ['Ch\u01b0a c\u1ea7m h\u1ea1t Fruit', 'No Fruit seed selected'],
    ['\u0110\u00e3 b\u00f3n ph\u00e2n', 'Fertilised'], ['Ph\u00e2n b\u00f3n t\u0103ng t\u1ed1c', 'Speed fertiliser'], ['\u0110\u1ed5i h\u1ea1t', 'Change seed'], ['Ch\u1ecdn h\u1ea1t', 'Choose seed'],
    ['Thu ho\u1ea1ch', 'Collect'], ['\u0110ang thu ho\u1ea1ch\u2026', 'Collecting...'], ['Tr\u1ed3ng', 'Plant'], ['\u0110ang tr\u1ed3ng\u2026', 'Planting...'], ['Ch\u1eb7t', 'Chop'], ['\u0110ang ch\u1eb7t\u2026', 'Chopping...'],
    ['Khai th\u00e1c', 'Mine'], ['\u0110ang khai th\u00e1c\u2026', 'Mining...'], ['\u0110\u1ed1n', 'Chop'], ['\u0110ang \u0111\u1ed1n\u2026', 'Chopping...'], ['\u0110\u00e1nh th\u1ee9c', 'Wake'], ['\u0110ang \u0111\u00e1nh th\u1ee9c\u2026', 'Waking...'],
    ['Qu\u00e9t', 'Scan'], ['\u0110ang qu\u00e9t\u2026', 'Scanning...'], ['Ph\u00e2n b\u00f3n', 'Fertiliser'], ['H\u1ee7y ch\u1ecdn ph\u00e2n b\u00f3n', 'Cancel fertiliser selection'],
    ['Sang tr\u00e1i', 'Move left'], ['Sang ph\u1ea3i', 'Move right'], ['N\u00f4ng tr\u1ea1i', 'Farm'], ['B\u1ea3n \u0111\u1ed3', 'Map'], ['Nh\u1eadt k\u00fd', 'Logs'],
    ['C\u00f3 th\u1ec3 b\u00f3n ph\u00e2n', 'Can fertilise'], ['Kh\u00f4ng \u0111\u1ee7 nguy\u00ean li\u1ec7u', 'Not enough ingredients'], ['Thi\u1ebfu nguy\u00ean li\u1ec7u', 'Missing ingredients'],
    ['\u0110ang t\u1ea3i', 'Loading'], ['L\u1ed7i th\u00f4ng b\u00e1o:', 'Notification error:'], ['L\u1ed7i panel:', 'Panel error:'], ['Promise b\u1ecb t\u1eeb ch\u1ed1i:', 'Rejected promise:'],
    ['S\u1eb5n s\u00e0ng.', 'Ready.'], ['\u0110\u00e3 c\u1eadp nh\u1eadt s\u1ed1 l\u01b0\u1ee3ng Tools.', 'Tools count updated.'], ['Kh\u00f4ng t\u00ecm th\u1ea5y ng\u01b0\u1eddi ch\u01a1i trong Following.', 'No players were found in Following.'], ['\u0110ang \u0111\u1ecdc Following\u2026', 'Reading Following...'], ['Cheer hi\u1ec7n kh\u00f4ng kh\u1ea3 d\u1ee5ng', 'Cheer is not available'], ['\u0110\u00e3 Help ng\u01b0\u1eddi n\u00e0y', 'This player has already been helped'],
    ['Following \u0111ang tr\u1ed1ng ho\u1eb7c game ch\u01b0a hi\u1ec3n th\u1ecb d\u1eef li\u1ec7u ng\u01b0\u1eddi ch\u01a1i.', 'Following is empty or player data is not available yet.'], ['Kh\u00f4ng th\u1ec3 \u0111\u1ecdc Following.', 'Could not read Following.'], ['Kh\u00f4ng th\u1ec3 m\u1edf th\u00f4ng tin ng\u01b0\u1eddi ch\u01a1i.', 'Could not open player information.'], ['Kh\u00f4ng th\u1ec3 g\u1eedi Cheer.', 'Could not send Cheer.'], ['Cheer th\u1ea5t b\u1ea1i.', 'Cheer failed.'], ['Game ch\u01b0a x\u00e1c nh\u1eadn Cheer th\u00e0nh c\u00f4ng.', 'The game has not confirmed Cheer yet.'], ['Kh\u00f4ng t\u00ecm th\u1ea5y n\u00fat Continue sau khi Cheer.', 'Continue was not found after Cheer.'], ['Kh\u00f4ng t\u00ecm th\u1ea5y n\u00fat Help trong h\u1ed3 s\u01a1.', 'Help was not found in the profile.'], ['Kh\u00f4ng th\u1ec3 \u0111\u1ebfn \u0111\u1ea3o c\u1ee7a ng\u01b0\u1eddi ch\u01a1i.', "Could not visit the player's island."], ['Game ch\u01b0a x\u00e1c nh\u1eadn Help th\u00e0nh c\u00f4ng.', 'The game has not confirmed Help yet.'], ['Kh\u00f4ng t\u00ecm th\u1ea5y m\u1ee5c n\u00e0o c\u00f3 th\u1ec3 Help tr\u00ean \u0111\u1ea3o n\u00e0y.', 'No helpable items were found on this island.']
  ];
  const viToEn = new Map(pairs);
  const enToVi = new Map(pairs.map(([vi, en]) => [en, vi]));
  // These labels are authored in English in card templates. They are extension
  // UI, not game item names, so only their Vietnamese rendering is defined here.
  Object.entries({
    'Select seeds': 'Chọn hạt', 'Free Restock': 'Bổ sung miễn phí', Restock: 'Bổ sung', 'Tap to check': 'Nhấn để kiểm tra', 'Tap to collect': 'Nhấn để thu thập', 'Tap to compost': 'Nhấn để compost',
    'Required materials': 'Nguyên liệu cần thiết', 'No material data': 'Chưa có dữ liệu nguyên liệu', 'Scan composter': 'Quét Composter',
    'Not enough items': 'Không đủ nguyên liệu', 'Can fertilise': 'Có thể bón phân', 'Need Pickaxe': 'Cần Pickaxe', 'Need Axe': 'Cần Axe',
    READY: 'Sẵn sàng', GROWING: 'Đang lớn', RECOVERING: 'Đang hồi', COMPOSTING: 'Đang compost', EMPTY: 'Trống', UNKNOWN: 'Chưa xác định', 'NO INPUT': 'Thiếu nguyên liệu', BLOCKED: 'Bị khóa',
    Activity: 'Hoạt động', Foraging: 'Tìm kiếm', Resources: 'Tài nguyên', Tools: 'Công cụ', Home: 'Trang chủ', Logs: 'Nhật ký', Settings: 'Cài đặt',
    'Scan tools': 'Quét công cụ', 'Reload Tools': 'Quét lại công cụ', 'No Axe': 'Không có Axe', 'No Pickaxe': 'Không có Pickaxe', 'No Salt Rake': 'Không có Salt Rake',
    'Reload extension': 'Nạp lại extension', 'Reload Map': 'Tải lại Map', 'Reload Crop': 'Tải lại Crop', 'Reload Fruit': 'Tải lại Fruit', 'Reload Tree': 'Tải lại Tree', 'Reload Mining': 'Tải lại Mining', 'Reload Salt': 'Tải lại Salt', 'Reload Composter': 'Tải lại Composter',
    'Load Tools': 'Quét Tools', Buy: 'Mua', 'Basic User': 'Người dùng Basic', 'Silver User': 'Người dùng Silver', 'Gold User': 'Người dùng Gold', 'Free plan': 'Gói miễn phí', 'Expires: Unlimited': 'Hạn dùng: Không giới hạn', 'Expires: Unknown': 'Hạn dùng: Không xác định', 'License expired': 'Key đã hết hạn', 'Checking expiry...': 'Đang kiểm tra hạn dùng...',
    'Ready notifications have been enabled.': 'Thông báo sẵn sàng đã được bật.',
    'Mining...': 'Đang khai thác...', 'Mining successful.': 'Khai thác thành công.', 'Chopping tree...': 'Đang chặt cây...', 'Tree chopped successfully.': 'Chặt cây thành công.', 'Planting...': 'Đang trồng...', 'Planting successful.': 'Trồng thành công.', 'Harvesting...': 'Đang thu hoạch...', 'Harvest successful.': 'Thu hoạch thành công.', 'Harvesting fruit...': 'Đang thu hoạch Fruit...', 'Fruit harvested successfully.': 'Thu hoạch Fruit thành công.', 'Fertilizing...': 'Đang bón phân...', 'Fertilization successful.': 'Bón phân thành công.', 'Scanning map...': 'Đang quét Map...', 'Map scan successful.': 'Quét Map thành công.', 'Scanning Betty...': 'Đang quét Betty...', 'Betty scan successful.': 'Quét Betty thành công.', 'Scanning tools...': 'Đang quét Tools...', 'Tools scan successful.': 'Quét Tools thành công.', 'Scanning inventory...': 'Đang quét túi đồ...', 'Inventory scan successful.': 'Quét túi đồ thành công.', 'Restocking for free...': 'Đang bổ sung miễn phí...', 'Free restock successful.': 'Bổ sung miễn phí thành công.', 'Harvesting mushrooms...': 'Đang thu hoạch nấm...', 'Mushrooms harvested successfully.': 'Thu hoạch nấm thành công.', 'Mining salt...': 'Đang khai thác Salt...', 'Salt mined successfully.': 'Khai thác Salt thành công.', 'Scanning composters...': 'Đang quét Composter...', 'Composters scanned.': 'Quét Composter thành công.'
  }).forEach(([en, vi]) => enToVi.set(en, vi));
  const originalText = new WeakMap();
  const originalAttrs = new WeakMap();
  let applying = false;

  const translateValue = (value, language) => {
    if (!value) return value;
    const exact = language === 'en' ? viToEn.get(value) : enToVi.get(value);
    if (exact) return exact;
    if (language === 'en') {
      return value
        .replace(/^Thu ho\u1ea1ch x(\d+)$/, 'Harvest x$1').replace(/^Thu th\u1eadp x(\d+)$/, 'Collect x$1').replace(/^Tr\u1ed3ng x(\d+)$/, 'Plant x$1')
        .replace(/^Ch\u1eb7t x(\d+)$/, 'Chop x$1').replace(/^Khai th\u00e1c x(\d+)$/, 'Mine x$1')
        .replace(/^B\u00f3n ph\u00e2n x(\d+)$/, 'Fertilise x$1').replace(/^C\u00f2n l\u1ea1i: (.+)$/, 'Remaining: $1')
        .replace(/^H\u1ea1n d\u00f9ng: (.+)$/, 'Expires: $1').replace(/^M\u00e3 m\u00e1y: (.+)$/, 'Device: $1')
        .replace(/^Qu\u00e9t t\u00fai \u0111\u1ed3 \u0111\u1ec3 \u0111\u1ecdc Fertilisers$/, 'Scan inventory to read fertilisers')
        .replace(/^Qu\u00e9t Tools \u0111\u1ea7y \u0111\u1ee7$/, 'Scan all tools').replace(/^\u0110\u1ecdc s\u1ed1 l\u01b0\u1ee3ng Tools$/, 'Read tool counts')
        .replace(/^Ch\u1ecdn \u0111\u1ec3 b\u00f3n ph\u00e2n (\d+) cho (Crop|Fruit)$/, 'Select to fertilise $2 with fertiliser $1')
        .replace(/^Ph\u00e2n b\u00f3n (\d+): ch\u01b0a c\u00f3 c\u00e2y c\u1ea7n b\u00f3n$/, 'Fertiliser $1: no eligible plants')
        .replace(/^Following \((\d+)\) \u00b7 \u0110\u00e3 \u0111\u1ecdc (\d+) ng\u01b0\u1eddi ch\u01a1i$/, 'Following ($1) \u00b7 $2 players read').replace(/^\u0110\u00e3 \u0111\u1ecdc (\d+) ng\u01b0\u1eddi ch\u01a1i$/, '$1 players read')
        .replace(/^\u0110\u00e3 Help (.+): (\d+) m\u1ee5c\.$/, 'Helped $1: $2 items.').replace(/^\u0110\u00e3 Cheer (.+)\.$/, '$1 cheered successfully.').replace(/^(.+) \u0111\u00e3 \u0111\u01b0\u1ee3c Cheer t\u1eeb tr\u01b0\u1edbc\.$/, '$1 was already cheered.')
        .replace(/(\d+) ng\u00e0y c\u00f2n l\u1ea1i/g, '$1 days left').replace(/(\d+) gi\u1edd c\u00f2n l\u1ea1i/g, '$1 hours left').replace(/(\d+) ph\u00fat c\u00f2n l\u1ea1i/g, '$1 minutes left');
    }
    return value
      .replace(/^Harvest x(\d+)$/, 'Thu ho\u1ea1ch x$1').replace(/^Collect x(\d+)$/, 'Thu th\u1eadp x$1').replace(/^Plant x(\d+)$/, 'Tr\u1ed3ng x$1')
      .replace(/^Chop x(\d+)$/, 'Ch\u1eb7t x$1').replace(/^Mine x(\d+)$/, 'Khai th\u00e1c x$1')
      .replace(/^Fertilise x(\d+)$/, 'B\u00f3n ph\u00e2n x$1').replace(/^Remaining: (.+)$/, 'C\u00f2n l\u1ea1i: $1')
      .replace(/^Expires: (.+)$/, 'H\u1ea1n d\u00f9ng: $1').replace(/^Device: (.+)$/, 'M\u00e3 m\u00e1y: $1')
      .replace(/^Scan inventory to read fertilisers$/, 'Qu\u00e9t t\u00fai \u0111\u1ed3 \u0111\u1ec3 \u0111\u1ecdc Fertilisers')
      .replace(/^Scan all tools$/, 'Qu\u00e9t Tools \u0111\u1ea7y \u0111\u1ee7').replace(/^Read tool counts$/, '\u0110\u1ecdc s\u1ed1 l\u01b0\u1ee3ng Tools')
      .replace(/^Select to fertilise (Crop|Fruit) with fertiliser (\d+)$/, 'Ch\u1ecdn \u0111\u1ec3 b\u00f3n ph\u00e2n $2 cho $1')
      .replace(/^Fertiliser (\d+): no eligible plants$/, 'Ph\u00e2n b\u00f3n $1: ch\u01b0a c\u00f3 c\u00e2y c\u1ea7n b\u00f3n')
      .replace(/(\d+) days left/g, '$1 ng\u00e0y c\u00f2n l\u1ea1i').replace(/(\d+) hours left/g, '$1 gi\u1edd c\u00f2n l\u1ea1i').replace(/(\d+) minutes left/g, '$1 ph\u00fat c\u00f2n l\u1ea1i');
  };
  const ignored = (node) => node.parentElement?.closest('script,style,template,#license-user-tier');
  const applyText = (node, language, source) => {
    if (!node?.nodeValue?.trim() || ignored(node)) return;
    const value = source ?? originalText.get(node) ?? node.nodeValue;
    originalText.set(node, value);
    const translated = translateValue(value, language);
    if (node.nodeValue !== translated) { applying = true; node.nodeValue = translated; applying = false; }
  };
  const applyAttribute = (element, attribute, language, source) => {
    if (!element?.hasAttribute(attribute)) return;
    const values = originalAttrs.get(element) || new Map();
    const value = source ?? values.get(attribute) ?? element.getAttribute(attribute);
    values.set(attribute, value); originalAttrs.set(element, values);
    const translated = translateValue(value, language);
    if (element.getAttribute(attribute) !== translated) { applying = true; element.setAttribute(attribute, translated); applying = false; }
  };
  const applyTree = (root, language) => {
    if (root.nodeType === Node.TEXT_NODE) { applyText(root, language); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    const elements = root.nodeType === Node.ELEMENT_NODE ? [root, ...root.querySelectorAll('*')] : [...(root.querySelectorAll?.('*') || [])];
    elements.forEach((element) => {
      ['title', 'aria-label', 'placeholder'].forEach((attribute) => applyAttribute(element, attribute, language));
      element.childNodes.forEach((node) => { if (node.nodeType === Node.TEXT_NODE) applyText(node, language); });
    });
  };
  const languageControl = () => {
    const settings = document.querySelector('.settings-panel');
    const heading = settings?.querySelector('.settings-header');
    if (!settings || !heading || document.querySelector('#panel-language')) return;
    const label = document.createElement('label');
    label.className = 'settings-language';
    label.innerHTML = '<span><b id="panel-language-label">Ng\u00f4n ng\u1eef</b><small id="panel-language-description">Ch\u1ecdn ng\u00f4n ng\u1eef hi\u1ec3n th\u1ecb cho panel.</small></span><select id="panel-language" aria-label="Ng\u00f4n ng\u1eef"><option value="vi">Ti\u1ebfng Vi\u1ec7t</option><option value="en">Ti\u1ebfng Anh</option></select>';
    heading.after(label);
  };
  const apply = async (language) => {
    const selected = language === 'en' ? 'en' : 'vi';
    document.documentElement.lang = selected;
    document.body.dataset.language = selected;
    const select = document.querySelector('#panel-language');
    if (select) select.value = selected;
    applyTree(document.body, selected);
    window.dispatchEvent(new CustomEvent('sunflower-language-changed', { detail: { language: selected } }));
  };
  const t = (key, fallback = '') => (document.body?.dataset.language === 'en' ? english[key] : vietnamese[key]) || fallback;
  window.panelI18n = Object.freeze({ t, translate: translateValue, get language() { return document.body?.dataset.language || 'vi'; } });
  // English is the first-run default. A saved Vietnamese choice is applied below.
  document.documentElement.lang = 'en';
  document.body.dataset.language = 'en';
  languageControl();
  const observer = new MutationObserver((mutations) => {
    if (applying) return;
    const language = document.body?.dataset.language || 'vi';
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') mutation.addedNodes.forEach((node) => applyTree(node, language));
      else if (mutation.type === 'characterData') applyText(mutation.target, language, mutation.target.nodeValue);
      else if (mutation.type === 'attributes') applyAttribute(mutation.target, mutation.attributeName, language, mutation.target.getAttribute(mutation.attributeName));
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] });
  const select = document.querySelector('#panel-language');
  select?.addEventListener('change', async () => { await chrome.storage.local.set({ [storageKey]: select.value }); await apply(select.value); });
  void chrome.storage.local.get(storageKey).then((stored) => apply(stored[storageKey] || 'en'));
})();
