"use client";

import { useCallback, useState, useEffect } from "react";
import FormCard, { type OfframpPayload, type QuoteResult } from "@/components/FormCard";
import RightPanel from "@/components/RightPanel";
import RecentOfframpsTable from "@/components/RecentOfframpsTable";
import ProgressSteps from "@/components/ProgressSteps";
import { TransactionProgressModal } from "@/components/TransactionProgressModal";
import { Header } from "@/components/Header";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useWalletFlow } from "@/hooks/useWalletFlow";
import { OfframpStep } from "@/types/stellaramp";

export default function Home() {
  const { wallet, isConnecting: isWalletConnecting, error, connect, disconnect } = useStellarWallet();
  const { state, variant, steps, setConnecting, setConnected, setPreConnect } = useWalletFlow();
  
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [modalStep, setModalStep] = useState<OfframpStep>("idle");

  const isConnected = !!wallet;

  // Sync wallet state with flow state via useEffect
  useEffect(() => {
    if (isWalletConnecting) {
      setConnecting();
    } else if (isConnected) {
      setConnected();
    } else {
      setPreConnect();
    }
  }, [isWalletConnecting, isConnected, setConnecting, setConnected, setPreConnect]);

  const handleConnect = useCallback(async () => {
    // Note: The useEffect will also trigger transitions, but explicit calls 
    // here provide immediate UI feedback even before the async wallet state updates.
    setConnecting();
    const result = await connect();
    if (result) {
      setConnected();
    } else {
      setPreConnect();
    }
  }, [connect, setConnecting, setConnected, setPreConnect]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setPreConnect();
    setAmount("");
    setCurrency("");
    setQuote(null);
  }, [disconnect, setPreConnect]);

  const handleSubmit = useCallback(async (payload: OfframpPayload) => {
    setModalStep("initiating");
    
    try {
      setModalStep("awaiting-signature");
      await new Promise(r => setTimeout(r, 2000));

      setModalStep("submitting");
      await new Promise(r => setTimeout(r, 2000));

      setModalStep("processing");
      await new Promise(r => setTimeout(r, 2000));

      setModalStep("settling");
      await new Promise(r => setTimeout(r, 2000));

      setModalStep("success");
    } catch (err) {
      console.error("Transaction failed:", err);
      setModalStep("error");
    }
  }, []);

  return (
    <main className="min-h-screen p-4 bg-[#0a0a0a]">
      <TransactionProgressModal 
        step={modalStep} 
        errorMessage={error || undefined}
        onClose={() => setModalStep("idle")} 
      />
      
      <Header
        subtitle={variant.subtitle}
        isConnected={isConnected}
        isConnecting={isWalletConnecting}
        walletAddress={wallet?.publicKey}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      <section className="border border-[#333333] px-[2.6rem] py-8 max-[1100px]:p-4 overflow-hidden mt-6">
        <div className="grid grid-cols-[1fr_370px] gap-6 max-[1100px]:grid-cols-1 overflow-hidden w-full">
          <div data-testid="FormCard">
            <FormCard
              isConnected={isConnected}
              isConnecting={isWalletConnecting}
              onConnect={handleConnect}
              onSubmit={handleSubmit}
              onQuoteChange={setQuote}
              onAmountChange={setAmount}
              onCurrencyChange={setCurrency}
            />
          </div>
          
          <div
            data-testid="RightPanel"
            className="col-start-2 row-start-1 row-span-2 max-[1100px]:col-start-1 max-[1100px]:row-span-1"
          >
            <RightPanel
              isConnected={isConnected}
              isConnecting={isWalletConnecting}
              amount={amount}
              quote={quote}
              isLoadingQuote={false}
              currency={currency}
              onConnect={handleConnect}
            />
          </div>
          
          <div>
            <RecentOfframpsTable />
          </div>
          
          <div className="col-span-1 min-[1101px]:col-span-2 mt-4 max-[1100px]:block">
            {/* The ProgressSteps component now consumes the memoized steps from useWalletFlow */}
            <ProgressSteps 
              isConnected={isConnected} 
              isConnecting={isWalletConnecting} 
              steps={steps} 
            />
          </div>
        </div>
      </section>
    </main>
  );
}
