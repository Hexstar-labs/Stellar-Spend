'use client';

import { useCallback } from 'react';
import type { BridgeStatus } from '@/lib/offramp/types';
import { TransactionStorage } from '@/lib/transaction-storage';

const POLL_INTERVAL_MS = 5_000;
const MAX_ATTEMPTS = 60;
const MAX_CONSECUTIVE_ERRORS = 10;

interface PollBridgeStatusOptions {
  transactionId: string;
  onBridgeComplete?: () => void;
}

/**
 * Polls GET /api/offramp/bridge/status/{txHash} every 5 s, up to 60 attempts (5 min).
 * - "completed"  → calls onBridgeComplete(), resolves
 * - "failed"     → rejects with descriptive error
 * - 10 consecutive HTTP errors → soft exit (resolves without throwing)
 * - Timeout      → resolves silently (bridge polling is best-effort)
 * Updates TransactionStorage on every successful poll.
 */
export function usePollBridgeStatus() {
  const pollBridgeStatus = useCallback(
    async (txHash: string, { transactionId, onBridgeComplete }: PollBridgeStatusOptions): Promise<void> => {
      let attempts = 0;
      let consecutiveErrors = 0;

      while (attempts < MAX_ATTEMPTS) {
        attempts++;

        let data: { status?: BridgeStatus; error?: string };

        try {
          const res = await fetch(`/api/offramp/bridge/status/${txHash}`, { cache: 'no-store' });
          data = await res.json();

          if (!res.ok) {
            consecutiveErrors++;
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              // Soft exit — don't block payout polling
              return;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
            continue;
          }
        } catch {
          consecutiveErrors++;
          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            return;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }

        // Reset on successful HTTP response
        consecutiveErrors = 0;

        const status = data.status;

        if (status) {
          TransactionStorage.update(transactionId, { bridgeStatus: status });
        }

        if (status === 'completed') {
          onBridgeComplete?.();
          return;
        }

        if (status === 'failed' || status === 'expired') {
          throw new Error(
            status === 'failed'
              ? 'Bridge transfer failed. Please contact support.'
              : 'Bridge transfer expired. Please try again.'
          );
        }

        if (attempts < MAX_ATTEMPTS) {
          await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      }

      // Timeout — best-effort, resolve silently
    },
    []
  );

  return { pollBridgeStatus };
}
