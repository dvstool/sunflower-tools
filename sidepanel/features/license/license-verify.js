let cachedPublicKey;

function canonicalPayload({ licenseId, tier, expiresAt, installationId, farmId, issuedAt, validUntil, nonce }) {
  return { licenseId, tier, expiresAt, installationId, farmId: String(farmId || ''), issuedAt, validUntil, nonce };
}

function base64ToBuffer(value) {
  const binary = atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function publicKey(config) {
  if (cachedPublicKey) return cachedPublicKey;
  cachedPublicKey = await crypto.subtle.importKey(
    'jwk', config.publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['verify']
  );
  return cachedPublicKey;
}

export async function verifyLicensePayload(config, payload, signature) {
  try {
    const key = await publicKey(config);
    const data = new TextEncoder().encode(JSON.stringify(canonicalPayload(payload || {})));
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, base64ToBuffer(signature), data);
  } catch {
    return false;
  }
}
