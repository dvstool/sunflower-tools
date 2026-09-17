/*
 * Public license client configuration.
 *
 * Keep this file free of secrets. After deploying the Worker, set `enabled` to
 * true and paste the Worker URL. The admin token belongs only in
 * sidepanel/admin.local.js, which is ignored by Git.
 */
export const licenseConfig = Object.freeze({
  enabled: true,
  apiBaseUrl: 'https://sunflower-tools-license.sfl-ext-sang.workers.dev',
  publicKeyJwk: Object.freeze({
    kty: 'EC',
    crv: 'P-256',
    x: 'TsOM3dD_1Unp_QW1OkWmAYM2QsR-FVXpE-cREbD4rZ4',
    y: 'BdPH9zgEG68hahLg3hvGB-iLi0lMxiNB6lKbLz-SATw'
  })
});

// Kept temporarily for the local Admin panel, which remains a classic script.
window.SUNFLOWER_LICENSE_CONFIG = licenseConfig;
