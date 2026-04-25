export type ApiKeyStatus = 'active' | 'rotated' | 'revoked';

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  status: ApiKeyStatus;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  usageCount: number;
  lastUsedAt?: number;
  lastRotatedAt?: number;
  revokedAt?: number;
  revokedReason?: string;
  expiresAt?: number;
  rotatedFromKeyId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ApiKeyWithSecret extends ApiKeyRecord {
  plaintextKey: string;
}

export interface ApiKeyUsageEvent {
  id: string;
  apiKeyId: string;
  method: string;
  path: string;
  statusCode: number;
  limited: boolean;
  ipAddress?: string;
  usedAt: number;
  metadata?: Record<string, unknown>;
}
