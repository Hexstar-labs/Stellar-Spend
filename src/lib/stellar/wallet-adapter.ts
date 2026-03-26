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

const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";

// ── Error helpers ──────────────────────────────────────────────────────────────

function friendlyError(raw: unknown, fallback: string): Error {
  if (!raw) return new Error(fallback);
  if (typeof raw === "object" && "message" in raw) {
    const msg = String((raw as { message: unknown }).message ?? "");
    if (/user declined|rejected|denied/i.test(msg))
      return new Error(
        "Connection request was declined. Please approve it in your wallet and try again."
      );
    if (/not connected|not installed/i.test(msg))
      return new Error(
        "Wallet extension is not installed or unavailable. Please install it and try again."
      );
    if (/timeout/i.test(msg))
      return new Error("The wallet did not respond in time. Please try again.");
    if (msg) return new Error(msg);
  }
  return new Error(fallback);
}

// ── Lobstr provider interface ──────────────────────────────────────────────────

interface LobstrProvider {
  connect(): Promise<{ publicKey: string }>;
  signTransaction(
    xdr: string,
    opts: { networkPassphrase: string }
  ): Promise<{ signedXdr: string }>;
}

function resolveLobstrProvider(): LobstrProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  const candidate: unknown = w.lobstr ?? (w.stellar?.isLobstr ? w.stellar : null);
  if (!candidate || typeof candidate !== "object") return null;
  if (
    typeof (candidate as any).connect !== "function" ||
    typeof (candidate as any).signTransaction !== "function"
  ) {
    return null;
  }
  return candidate as LobstrProvider;
}

// ── Adapter ────────────────────────────────────────────────────────────────────

export class StellarWalletAdapter {
  private _walletType: WalletType | null = null;
  private _publicKey: string | null = null;


  // Serialises concurrent connection calls across both connectAuto,
  // connectFreighter, and connectLobstr.
  private _connectingPromise: Promise<StellarWallet> | null = null;

  // ── Availability ──────────────────────────────────────────────────────────────

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

  /**
   * Returns true when a valid Lobstr provider is present on the window object.
   * Checks both window.lobstr and window.stellar?.isLobstr, and validates the
   * provider interface before returning true.
   */
  isLobstrAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return !!(w.lobstr || w.stellar?.isLobstr);
  }

  // ── Connection methods ─────────────────────────────────────────────────────

  connectFreighter(): Promise<StellarWallet> {
    if (this._walletType === "freighter" && this._publicKey) {
      return Promise.resolve({
        type: "freighter",
        publicKey: this._publicKey,
        isConnected: true,
      });
    }
    if (this._connectingPromise) return this._connectingPromise;
    this._connectingPromise = this._doConnectFreighter().finally(() => {
      this._connectingPromise = null;
    });
    return this._connectingPromise;
  }

  private async _doConnectFreighter(): Promise<StellarWallet> {
 main

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
    // Step 1 — extension presence check.
 main
    const available = await this.isFreighterAvailable();
    if (!available) {
      throw new Error("Freighter extension is not installed. Visit https://freighter.app to install it.");
    }

    const connectedResult = await freighterApi.isConnected();
    if (connectedResult.error) {
      throw friendlyError(
        connectedResult.error,
        "Could not reach Freighter. Please try again."
      );
    }

    if (connectedResult.isConnected) {
      const addressResult = await freighterApi.getAddress();
      if (!addressResult.error && addressResult.address) {
        return this._store("freighter", addressResult.address);
      }
    }


    // Step 2 — check whether this origin is already connected/allowed.
 main
    const connectedResult = await freighterApi.isConnected();
    if (connectedResult.isConnected) {
      const addressResult = await freighterApi.getAddress();
      if (!addressResult.error && addressResult.address) {
        return this._store("freighter", addressResult.address);
      }
    }


    // Step 4 — request permission / unlock prompt.

 main
    const accessResult = await freighterApi.requestAccess();
    if (accessResult.error) {
      throw friendlyError(accessResult.error, "Freighter access was denied.");
    }

    if (accessResult.address) {
      return this._store("freighter", accessResult.address);
    }

    // If initial access didn't yield an address, try fetching it explicitly
    const retryResult = await freighterApi.getAddress();
    if (retryResult.error) {
      throw friendlyError(
        retryResult.error,
        "Connected to Freighter but could not retrieve your public key. Please try again."
      );
    }
    if (!retryResult.address) {
      throw new Error(
        "Connected to Freighter but no public key was returned. " +
          "Ensure your wallet is unlocked and try again."
      );
    }

    return this._store("freighter", retryResult.address);
  }

  // ── Lobstr connection ─────────────────────────────────────────────────────────

  connectLobstr(): Promise<StellarWallet> {
    if (this._walletType === "lobstr" && this._publicKey) {
      return Promise.resolve({
        type: "lobstr",
        publicKey: this._publicKey,
        isConnected: true,
      });
    }
    if (this._connectingPromise) return this._connectingPromise;
    this._connectingPromise = this._doConnectLobstr().finally(() => {
      this._connectingPromise = null;
    });
    return this._connectingPromise;
  }

  private async _doConnectLobstr(): Promise<StellarWallet> {
    const provider = resolveLobstrProvider();
    if (!provider) {
      throw new Error(
        "Lobstr wallet is not installed or unavailable. " +
          "Visit https://lobstr.co to install it."
      );
    }

    let result: { publicKey: string };
    try {
      result = await provider.connect();
    } catch (err: unknown) {
      throw friendlyError(err, "Failed to connect to Lobstr. Please try again.");
    }

    if (!result || typeof result !== "object") {
      throw new Error("Lobstr returned an unexpected response. Please try again.");
    }

    const publicKey = (result as any).publicKey;
    if (typeof publicKey !== "string" || publicKey.trim() === "") {
      throw new Error(
        "Lobstr did not return a valid public key. " +
          "Ensure your wallet is unlocked and try again."
      );
    }

    return this._store("lobstr", publicKey.trim());
  }

  // ── connectAuto ───────────────────────────────────────────────────────────────

  /**
   * Attempts Freighter first. If unavailable, falls back to Lobstr.
   * Throws a clear error if neither wallet is present.
   */
  connectAuto(): Promise<StellarWallet> {
    if (this._walletType && this._publicKey) {
      return Promise.resolve({
        type: this._walletType,
        publicKey: this._publicKey,
        isConnected: true,
      });
    }

    if (this._connectingPromise) return this._connectingPromise;

    this._connectingPromise = this._doConnectAuto().finally(() => {
      this._connectingPromise = null;
    });
    return this._connectingPromise;
  }

  private async _doConnectAuto(): Promise<StellarWallet> {
    // Try Freighter first.
    if (await this.isFreighterAvailable()) {
      return this._doConnectFreighter();
    }

    // Fall back to Lobstr.
    if (this.isLobstrAvailable()) {
      return this._doConnectLobstr();
    }

    throw new Error(
      "No Stellar wallet found. Please install Freighter (https://freighter.app) " +
        "or Lobstr (https://lobstr.co)."
    );
  }
 main
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

 main
  async connectAuto(): Promise<StellarWallet> {
    if (await this.isFreighterAvailable()) return this.connectFreighter();
    if (this.isLobstrAvailable()) return this.connectLobstr();

    throw new Error(
      "No Stellar wallet found. Please install Freighter (https://freighter.app) " +
        "or Lobstr (https://lobstr.co)."
    );
  }

  // ── Signing ────────────────────────────────────────────────────────────────
 main

  async signTransaction(xdr: string): Promise<string> {
    if (!this._walletType || !this._publicKey) {
      throw new Error("No wallet connected. Please connect your wallet first.");
    }

    if (this._walletType === "freighter") {

      return this._signWithFreighter(xdr);
    }

    return this._signWithLobstr(xdr);
  }

  private async _signWithFreighter(xdr: string): Promise<string> {
    const result = await freighterApi.signTransaction(xdr, {
      networkPassphrase: MAINNET_PASSPHRASE,

      const result = await freighterApi.signTransaction(xdr, {
        networkPassphrase: MAINNET_PASSPHRASE,
      });
      if (result.error) {
        throw friendlyError(result.error, "Transaction signing failed. Please try again.");
      }
      if (!result.signedTxXdr) {
        throw new Error("Freighter returned an empty signed transaction. Please try again.");
      }
      return result.signedTxXdr;
    }

    // Lobstr signing
    const provider = resolveLobstrProvider();
    if (!provider) {
      throw new Error("Lobstr is no longer available. Please reconnect your wallet.");
    }

    let signResult: { signedXdr: string };
    try {
      signResult = await provider.signTransaction(xdr, {
        networkPassphrase: MAINNET_PASSPHRASE,
      });
    } catch (err: unknown) {
      throw friendlyError(err, "Transaction signing failed. Please try again.");
    }

    if (!signResult?.signedXdr) {
      throw new Error("Lobstr returned an empty signed transaction. Please try again.");
    }
    return signResult.signedXdr;
 main
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

  private async _signWithFreighter(xdr: string): Promise<string> {
    const { signedTxXdr, error } = await freighterApi.signTransaction(xdr, {
      networkPassphrase: MAINNET_PASSPHRASE,
    });

    if (error) {
      throw friendlyError(error, "Freighter signing failed. Please try again.");
    }

    if (!signedTxXdr) {
      throw new Error("Freighter returned an empty signed transaction.");
    }

    return signedTxXdr;
  }

  private async _signWithLobstr(xdr: string): Promise<string> {
    // Re-resolve at call time — the provider may have been removed mid-session.
    const provider = resolveLobstrProvider();
    if (!provider) {
      throw new Error("Lobstr is no longer available. Please reconnect your wallet.");
    }

    let signResult: { signedXdr: string };
    try {
      signResult = await provider.signTransaction(xdr, {
        networkPassphrase: MAINNET_PASSPHRASE,
      });
    } catch (err: unknown) {
      throw friendlyError(err, "Lobstr signing failed. Please try again.");
    }

    if (!signResult?.signedXdr) {
      throw new Error("Lobstr returned an empty signed transaction. Please try again.");
    }
    return signResult.signedXdr;
  }

  // ── State accessors ───────────────────────────────────────────────────────────
 main
  }




  getWallet(): StellarWallet | null {
    if (!this._walletType || !this._publicKey) return null;
    return { type: this._walletType, publicKey: this._publicKey, isConnected: true };
  }

  disconnect(): void {
    this._walletType = null;
    this._publicKey = null;
    this._connectingPromise = null;
  }

 main
  private _store(type: WalletType, publicKey: string): StellarWallet {
    this._walletType = type;
    this._publicKey = publicKey;
    return { type, publicKey, isConnected: true };
  }
}

let _adapter: StellarWalletAdapter | null = null;
 main

/**
 * Returns the singleton StellarWalletAdapter instance.
 */
export function getStellarWalletAdapter(): StellarWalletAdapter {
  if (!_adapter) _adapter = new StellarWalletAdapter();
  return _adapter;
}

export function _resetAdapterSingleton(): void {
  _adapter = null;
}
 main
}
