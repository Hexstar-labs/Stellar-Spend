"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getStellarWalletAdapter, type StellarWallet, type WalletType } from "@/lib/stellar/wallet-adapter";
import { TransactionStorage } from "@/lib/transaction-storage";

export function useStellarWallet() {
  const [wallet, setWallet] = useState<StellarWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adapter = useMemo(() => getStellarWalletAdapter(), []);

  // Restore wallet session on mount — only from in-memory adapter state (no localStorage auto-reconnect)
  useEffect(() => {
    try {
      const existing = adapter.getWallet();
      if (existing) {
        setWallet(existing);
      }
    } catch (err: any) {
      console.error("Failed to restore wallet session:", err);
      setError(err instanceof Error ? err.message : "Failed to restore wallet session");
    }
  }, [adapter]);

  const connect = useCallback(async (walletType?: WalletType) => {
    setIsConnecting(true);
    setError(null);
    try {
      let connected: StellarWallet;
      if (walletType === "freighter") {
        connected = await adapter.connectFreighter();
      } else if (walletType === "lobstr") {
        connected = await adapter.connectLobstr();
      } else {
        connected = await adapter.connectAuto();
      }
      setWallet(connected);
      return connected;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to connect wallet";
      setError(msg);
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [adapter]);

  const disconnect = useCallback(() => {
    try {
      adapter.disconnect();
      TransactionStorage.clear();
      setWallet(null);
      setError(null);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Failed to disconnect wallet");
    }
  }, [adapter]);

  const signTransaction = useCallback(async (xdr: string): Promise<string | null> => {
    setError(null);
    try {
      const signed = await adapter.signTransaction(xdr);
      return signed;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to sign transaction";
      setError(msg);
      return null;
    }
  }, [adapter]);

  return {
    wallet,
    isConnected: wallet !== null,
    isConnecting,
    error,
    connect,
    disconnect,
    signTransaction,
  };
}
