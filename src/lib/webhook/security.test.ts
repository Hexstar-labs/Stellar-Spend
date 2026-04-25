import { describe, it, expect, beforeEach } from 'vitest';
import { verifyWebhookSignature, generateOutgoingSignature, buildSignedWebhookHeaders } from './security';

const SECRET = 'test-secret-key';
const PAYLOAD = '{"event":"payment_order.settled","data":{"id":"order_123"}}';

async function makeSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Buffer.from(mac).toString('hex');
}

describe('verifyWebhookSignature', () => {
  it('accepts valid signature without timestamp', async () => {
    const sig = await makeSignature(PAYLOAD, SECRET);
    const result = await verifyWebhookSignature(PAYLOAD, sig, SECRET);
    expect(result.valid).toBe(true);
  });

  it('rejects missing signature', async () => {
    const result = await verifyWebhookSignature(PAYLOAD, '', SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/missing/i);
  });

  it('rejects wrong signature', async () => {
    const result = await verifyWebhookSignature(PAYLOAD, 'deadbeef'.repeat(8), SECRET);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid/i);
  });

  it('rejects expired timestamp', async () => {
    const sig = await makeSignature(PAYLOAD, SECRET);
    const oldTimestamp = String(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const result = await verifyWebhookSignature(PAYLOAD, sig, SECRET, oldTimestamp);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/timestamp/i);
  });

  it('accepts fresh timestamp', async () => {
    const sig = await makeSignature(PAYLOAD, SECRET);
    const result = await verifyWebhookSignature(PAYLOAD, sig, SECRET, String(Date.now()));
    expect(result.valid).toBe(true);
  });

  it('detects replay attacks', async () => {
    const sig = await makeSignature(PAYLOAD, SECRET);
    const nonce = 'unique-nonce-replay-test';
    const first = await verifyWebhookSignature(PAYLOAD, sig, SECRET, null, nonce);
    expect(first.valid).toBe(true);
    // Second request with same nonce
    const sig2 = await makeSignature(PAYLOAD, SECRET);
    const second = await verifyWebhookSignature(PAYLOAD, sig2, SECRET, null, nonce);
    expect(second.valid).toBe(false);
    expect(second.reason).toMatch(/replay/i);
  });
});

describe('generateOutgoingSignature', () => {
  it('generates consistent HMAC signature', async () => {
    const sig1 = await generateOutgoingSignature(PAYLOAD, SECRET);
    const sig2 = await generateOutgoingSignature(PAYLOAD, SECRET);
    expect(sig1).toBe(sig2);
    expect(sig1).toHaveLength(64); // SHA-256 hex = 64 chars
  });
});

describe('buildSignedWebhookHeaders', () => {
  it('returns required headers', async () => {
    const headers = await buildSignedWebhookHeaders(PAYLOAD, SECRET);
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Webhook-Timestamp']).toBeDefined();
    expect(headers['X-Webhook-Signature']).toHaveLength(64);
  });
});
