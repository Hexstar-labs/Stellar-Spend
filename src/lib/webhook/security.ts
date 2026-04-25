/**
 * Webhook security: signature verification, timestamp validation,
 * replay attack prevention, and outgoing signature generation.
 */

/** Replay attack prevention: store seen nonces for 5 minutes */
const seenNonces = new Map<string, number>();
const NONCE_TTL_MS = 5 * 60 * 1000;
/** Max clock skew allowed between sender and receiver */
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

/** Prune expired nonces to prevent unbounded memory growth */
function pruneNonces(): void {
  const cutoff = Date.now() - NONCE_TTL_MS;
  for (const [nonce, ts] of seenNonces) {
    if (ts < cutoff) seenNonces.delete(nonce);
  }
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies an incoming Paycrest webhook request.
 *
 * Checks:
 *  1. HMAC-SHA256 signature (timing-safe)
 *  2. Timestamp freshness (within MAX_TIMESTAMP_SKEW_MS)
 *  3. Replay attack prevention via nonce/timestamp deduplication
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
  timestampHeader?: string | null,
  nonceHeader?: string | null
): Promise<VerificationResult> {
  // 1. Signature check
  if (!signature) {
    logVerificationFailure('missing_signature', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Missing signature' };
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computed = Buffer.from(mac).toString('hex');

  if (computed.length !== signature.length) {
    logVerificationFailure('signature_mismatch', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Invalid signature' };
  }
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (diff !== 0) {
    logVerificationFailure('signature_mismatch', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Invalid signature' };
  }

  // 2. Timestamp validation
  if (timestampHeader) {
    const ts = parseInt(timestampHeader, 10);
    if (isNaN(ts)) {
      logVerificationFailure('invalid_timestamp', { timestampHeader, nonceHeader });
      return { valid: false, reason: 'Invalid timestamp' };
    }
    const skew = Math.abs(Date.now() - ts);
    if (skew > MAX_TIMESTAMP_SKEW_MS) {
      logVerificationFailure('timestamp_expired', { timestampHeader, nonceHeader, skewMs: skew });
      return { valid: false, reason: 'Timestamp too old or too far in the future' };
    }
  }

  // 3. Replay attack prevention
  pruneNonces();
  const replayKey = nonceHeader ?? `${timestampHeader}:${signature.slice(0, 16)}`;
  if (seenNonces.has(replayKey)) {
    logVerificationFailure('replay_detected', { timestampHeader, nonceHeader });
    return { valid: false, reason: 'Replay attack detected' };
  }
  seenNonces.set(replayKey, Date.now());

  return { valid: true };
}

/**
 * Generates an HMAC-SHA256 signature for outgoing webhook payloads.
 * Returns hex-encoded signature.
 */
export async function generateOutgoingSignature(
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Buffer.from(mac).toString('hex');
}

/**
 * Builds headers for an outgoing signed webhook request.
 */
export async function buildSignedWebhookHeaders(
  payload: string,
  secret: string
): Promise<Record<string, string>> {
  const timestamp = String(Date.now());
  const signature = await generateOutgoingSignature(`${timestamp}.${payload}`, secret);
  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': signature,
  };
}

/** Structured log for verification failures */
function logVerificationFailure(reason: string, context: Record<string, unknown>): void {
  console.warn(JSON.stringify({ event: 'webhook.verification_failed', reason, ...context, timestamp: new Date().toISOString() }));
}
