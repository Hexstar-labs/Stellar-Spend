import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { validateAmount, validateAddress } from '@/lib/offramp/utils/validation';
import { extractErrorMessage } from '@/lib/offramp/utils/errors';

export const maxDuration = 30;

/**
 * POST /api/offramp/bridge/build-tx
 * 
 * Builds a Soroban XDR transaction for bridging USDC from Stellar to Base.
 * 
 * Request body:
 * {
 *   amount: string (USDC amount)
 *   fromAddress: string (Stellar address)
 *   toAddress: string (Base address)
 *   feePaymentMethod: 'native' | 'stablecoin' (default: 'stablecoin')
 * }
 * 
 * Response:
 * {
 *   xdr: string
 *   sourceToken: { symbol, decimals, contract, chain }
 *   destinationToken: { symbol, decimals, contract, chain }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, fromAddress, toAddress, feePaymentMethod = 'stablecoin' } = body;

    // Validate inputs
    if (!validateAmount(amount)) {
      return NextResponse.json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400 }
      );
    }

    if (!validateAddress(fromAddress, 'stellar')) {
      return NextResponse.json(
        { error: 'Invalid Stellar address' },
        { status: 400 }
      );
    }

    if (!validateAddress(toAddress, 'base')) {
      return NextResponse.json(
        { error: 'Invalid Base address' },
        { status: 400 }
      );
    }

    if (!['native', 'stablecoin'].includes(feePaymentMethod)) {
      return NextResponse.json(
        { error: 'Invalid feePaymentMethod: must be "native" or "stablecoin"' },
        { status: 400 }
      );
    }

    // Initialize Allbridge SDK
    const { AllbridgeCoreSdk, nodeRpcUrlsDefault, ChainSymbol } = await import('@allbridge/bridge-core-sdk');

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

    // Fetch chain details and tokens
    const chainDetails = await sdk.chainDetailsMap();

    let stellarChain: any = null;
    let baseChain: any = null;

    for (const [, chain] of Object.entries(chainDetails)) {
      const chainObj = chain as any;
      if (chainObj.name?.toLowerCase().includes('stellar') || chainObj.name?.toLowerCase().includes('soroban')) {
        stellarChain = chainObj;
      }
      if (chainObj.name?.toLowerCase().includes('ethereum') || chainObj.name?.toLowerCase().includes('base')) {
        baseChain = chainObj;
      }
    }

    if (!stellarChain || !baseChain) {
      return NextResponse.json(
        { error: 'Failed to fetch chain details from Allbridge' },
        { status: 500 }
      );
    }

    // Find USDC tokens
    const sourceToken = stellarChain.tokens.find((t: any) => t.symbol === 'USDC');
    const destinationToken = baseChain.tokens.find((t: any) => t.symbol === 'USDC');

    if (!sourceToken || !destinationToken) {
      return NextResponse.json(
        { error: 'USDC token not found on one or both chains' },
        { status: 500 }
      );
    }

    // Get fee options
    const feeOptions = await sdk.getAllbridgeGasFeeOptions(sourceToken, destinationToken);

    // Select fee based on payment method
    const selectedFee = feePaymentMethod === 'native' ? feeOptions.native : feeOptions.stablecoin;

    // Build XDR transaction
    const xdr = await sdk.buildSwapAndBridgeTx(
      sourceToken,
      destinationToken,
      fromAddress,
      toAddress,
      amount,
      selectedFee
    );

    return NextResponse.json({
      xdr,
      sourceToken: {
        symbol: sourceToken.symbol,
        decimals: sourceToken.decimals,
        contract: sourceToken.contract,
        chain: sourceToken.chain,
      },
      destinationToken: {
        symbol: destinationToken.symbol,
        decimals: destinationToken.decimals,
        contract: destinationToken.contract,
        chain: destinationToken.chain,
      },
    });
  } catch (error) {
    console.error('Build TX error:', error);

    const message = extractErrorMessage(error);

    // Parse common simulation errors
    if (message.includes('insufficient') || message.includes('reserve')) {
      return NextResponse.json(
        { error: 'Insufficient XLM reserve for transaction' },
        { status: 500 }
      );
    }

    if (message.includes('Invalid')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to build transaction' },
      { status: 500 }
    );
  }
}
