/**
 * Service Registry - Pre-configured services for the application
 */

import { DIContainer } from './container';
import { IQuoteService, IBridgeService, IPayoutService } from '@/lib/services/interfaces';
import { QuoteService } from '@/lib/services/quote.service';
import { BridgeService } from '@/lib/services/bridge.service';
import { PayoutService } from '@/lib/services/payout.service';
import { WalletManager } from '@/lib/wallets/manager';

export const SERVICE_KEYS = {
  QUOTE_SERVICE: 'QuoteService',
  BRIDGE_SERVICE: 'BridgeService',
  PAYOUT_SERVICE: 'PayoutService',
  WALLET_MANAGER: 'WalletManager',
} as const;

/**
 * Configure the DI container with all application services
 */
export function configureServices(container: DIContainer): void {
  // Register services as singletons
  container.registerSingleton<IQuoteService>(
    SERVICE_KEYS.QUOTE_SERVICE,
    new QuoteService()
  );

  container.registerSingleton<IBridgeService>(
    SERVICE_KEYS.BRIDGE_SERVICE,
    new BridgeService()
  );

  container.registerSingleton<IPayoutService>(
    SERVICE_KEYS.PAYOUT_SERVICE,
    new PayoutService()
  );

  container.registerSingleton<WalletManager>(
    SERVICE_KEYS.WALLET_MANAGER,
    new WalletManager()
  );
}

/**
 * Get a service from the container
 */
export async function getService<T>(
  container: DIContainer,
  key: string
): Promise<T> {
  return container.resolve<T>(key);
}

/**
 * Get a service synchronously
 */
export function getServiceSync<T>(
  container: DIContainer,
  key: string
): T {
  return container.resolveSync<T>(key);
}
