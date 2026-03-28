import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { extractErrorMessage } from '@/lib/offramp/utils/errors';
import type { BridgeStatus } from '@/lib/offramp/types';

/**
 * GET /api/offramp/bridge/status/[txHash]
 * 
 * Polls the Allbridge bridge transfer status.
 * 
 * Response:
 * {
 *   data: {
 *     status: BridgeStatus
 *     txHash: string
 *     receiveAmount?: string
 *   }
 * }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ txHash: string }> }
) {
  const { txHash } = await params;

  try {
    // Initialize Allbridge SDK
    const { AllbridgeCoreSdk, nodeRpcUrlsDefault } = await import('@allbridge/bridge-core-sdk');

    const sdk = new AllbridgeCoreSdk({
      ...nodeRpcUrlsDefault,
      sorobanNetworkPassphrase: 'Public Global Stellar Network ; September 2015',
      ...(env.public.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL && {
        sorobanRpc: env.public.NEXT_PUBLIC_STELLAR_SOROBAN_RPC_URL,
      }),
      ...(env.server.BASE_RPC_URL && {
        ETH: env.server.BASE_RPC_URL,
      }),
    });

    // Get transfer status from Allbridge
    let transferStatus: any;
    try {
      transferStatus = await sdk.getAllbridgeTransferStatus('SRB', txHash);
    } catch (error) {
      // Handle 404 gracefully - return pending status
      const message = extractErrorMessage(error);
      if (message.includes('404') || message.includes('not found')) {
        return NextResponse.json({
          data: {
            status: 'pending' as BridgeStatus,
            txHash,
          },
        });
      }
      throw error;
    }

    // Map Allbridge status to BridgeStatus type
    let status: BridgeStatus = 'pending';
    if (transferStatus?.status) {
      const allbridgeStatus = transferStatus.status.toLowerCase();
      if (allbridgeStatus.includes('completed') || allbridgeStatus.includes('success')) {
        status = 'completed';
      } else if (allbridgeStatus.includes('failed')) {
        status = 'failed';
      } else if (allbridgeStatus.includes('expired')) {
        status = 'expired';
      } else if (allbridgeStatus.includes('processing')) {
        status = 'processing';
      }
    }

    return NextResponse.json({
      data: {
        status,
        txHash,
        receiveAmount: transferStatus?.receiveAmount,
      },
    });
  } catch (error) {
    console.error('Bridge status error:', error);
    const message = extractErrorMessage(error);
    return NextResponse.json(
      { error: message || 'Failed to fetch bridge status' },
      { status: 500 }
    );
  }
}
