/* Map scan queue. The DOM scanner implementation remains available as scanMapNow. */

function scanMap(scope = 'all', options = {}) {
  if (window.licenseManager?.isInteractionLocked?.()) return Promise.resolve(false);
  const task = scanMapQueue.then(() => scanMapNow(scope, options));
  scanMapQueue = task.catch((error) => {
    logActionError(error?.message || 'Quét Map gặp lỗi không xác định.');
    return false;
  });
  return task;
}
