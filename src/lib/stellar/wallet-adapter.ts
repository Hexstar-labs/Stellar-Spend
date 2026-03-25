import * as freighterApi from '@stellar/freighter-api';

export type WalletType = 'freighter' | 'lobstr';

export interface StellarWallet {
  readonly type: WalletType;
  readonly publicKey: string;
  readonly isConnected: boolean;
}

// Mainnet passphrase — never changes.
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

/**
 * Normalises a FreighterApiError or plain Error into a user-friendly message,
 * without leaking internal stack traces or API internals.
 */
function friendlyError(raw: unknown, fallback: string): Error {
  if (!raw) return new Error(fallback);
  if (typeof raw === "object" && "message" in raw) {
    const msg = (raw as { message: string }).message ?? "";
    // Map known Freighter error messages to user-friendly copy.
    if (/user declined/i.test(msg) || /rejected/i.test(msg))
      return new Error("Connection request was declined. Please approve it in Freighter and try again.");
    if (/not connected/i.test(msg) || /not installed/i.test(msg))
      return new Error("Freighter extension is not installed. Visit https://freighter.app to install it.");
    if (/timeout/i.test(msg))
      return new Error("Freighter did not respond in time. Please try again.");
    if (msg) return new Error(msg);
  }
  return new Error(fallback);
}

export class StellarWalletAdapter {
  private _walletType: WalletType | null = null;
  private _publicKey: string | null = null;

  // Serialises concurrent connectFreighter() calls so only one permission
  // prompt is ever in-flight at a time.
  private _connectingPromise: Promise<StellarWallet> | null = null;

  // ── Availability checks ────────────────────────────────────────────────────

  /**
   * Returns true when the Freighter browser extension is present.
   */
  async isFreighterAvailable(): Promise<boolean> {
    try {
      if (typeof window !== "undefined" && (window as any).freighter) return true;
      const result = await freighterApi.isConnected();
      return !!result.isConnected;
    } catch {
      return false;
    }
  }

  isLobstrAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return !!(w.lobstr || w.stellar?.isLobstr);
  }

  // ── Connection methods ─────────────────────────────────────────────────────

  /**
   * Connects to Freighter, handling permission prompts and session re-use.
   */
  async connectFreighter(): Promise<StellarWallet> {
    if (this._connectingPromise) return this._connectingPromise;

    if (this._walletType === "freighter" && this._publicKey) {
      return { type: "freighter", publicKey: this._publicKey, isConnected: true };
    }

    this._connectingPromise = this._doConnectFreighter().finally(() => {
      this._connectingPromise = null;
    });

    return this._connectingPromise;
  }

  private async _doConnectFreighter(): Promise<StellarWallet> {
    const available = await this.isFreighterAvailable();
    if (!available) {
      throw new Error("Freighter extension is not installed. Visit https://freighter.app to install it.");
    }

    // Attempt a silent address fetch if already connected
    const connectedResult = await freighterApi.isConnected();
    if (connectedResult.isConnected) {
      const addressResult = await freighterApi.getAddress();
      if (!addressResult.error && addressResult.address) {
        return this._store("freighter", addressResult.address);
      }
    }

    // Request primary access
    const accessResult = await freighterApi.requestAccess();
    if (accessResult.error) {
      throw friendlyError(accessResult.error, "Freighter access was denied.");
    }

    if (!accessResult.address) {
      throw new Error("Connected to Freighter but no public key was returned.");
    }

    return this._store("freighter", accessResult.address);
  }

  async connectLobstr(): Promise<StellarWallet> {
    if (!this.isLobstrAvailable()) {
      throw new Error("Lobstr wallet is not installed. Visit https://lobstr.co to install it.");
    }

    const w = window as any;
    const src = w.lobstr ?? (w.stellar?.isLobstr ? w.stellar : null);

    try {
      const result = await src.connect();
      if (!result?.publicKey) throw new Error("Lobstr did not return a public key.");
      return this._store("lobstr", result.publicKey);
    } catch (err: unknown) {
      throw friendlyError(err, "Failed to connect Lobstr. Please try again.");
    }
  }

  async connectAuto(): Promise<StellarWallet> {
    if (await this.isFreighterAvailable()) return this.connectFreighter();
    if (this.isLobstrAvailable()) return this.connectLobstr();

    throw new Error("No Stellar wallet found. Please install Freighter or Lobstr.");
  }

  // ── Signing ────────────────────────────────────────────────────────────────

  async signTransaction(xdr: string): Promise<string> {
    if (!this._walletType || !this._publicKey) {
      throw new Error("No wallet connected. Please connect your wallet first.");
    }

    if (this._walletType === "freighter") {
      const result = await freighterApi.signTransaction(xdr, {
        networkPassphrase: MAINNET_PASSPHRASE,
      });
      if (result.error) {
        throw friendlyError(result.error, "Transaction signing failed. Please try again.");
      }
      if (!result.signedTxXdr) {
        throw new Error("Freighter returned an empty signed transaction.");
      }
      return result.signedTxXdr;
    }

    if (this._walletType === "lobstr") {
      const w = window as any;
      const src = w.lobstr ?? (w.stellar?.isLobstr ? w.stellar : null);
      if (!src) throw new Error("Lobstr is no longer available. Please reconnect.");
      
      try {
        const result = await src.signTransaction(xdr, { networkPassphrase: MAINNET_PASSPHRASE });
        if (!result?.signedXdr) throw new Error("Lobstr returned an empty signed transaction.");
        return result.signedXdr;
      } catch (err: unknown) {
        throw friendlyError(err, "Transaction signing failed. Please try again.");
      }
    }

    throw new Error(`Unsupported wallet type: ${this._walletType}`);
  }

  // ── State accessors ────────────────────────────────────────────────────────

  getWallet(): StellarWallet | null {
    if (!this._walletType || !this._publicKey) return null;
    return { type: this._walletType, publicKey: this._publicKey, isConnected: true };
  }

  disconnect(): void {
    this._walletType = null;
    this._publicKey = null;
    this._connectingPromise = null;
  }

  private _store(type: WalletType, publicKey: string): StellarWallet {
    this._walletType = type;
    this._publicKey = publicKey;
    return { type, publicKey, isConnected: true };
  }
}

// Private instance
let adapterInstance: StellarWalletAdapter | null = null;

/**
 * Returns the singleton StellarWalletAdapter instance.
 */
export function getStellarWalletAdapter(): StellarWalletAdapter {
  if (!adapterInstance) {
    adapterInstance = new StellarWalletAdapter();
  }
  return adapterInstance;
}
