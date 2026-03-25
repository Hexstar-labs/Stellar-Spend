"use client";

import { useState, useCallback } from "react";
import FormCard, { type OfframpPayload, type QuoteResult } from "@/components/FormCard";
import RightPanel from "@/components/RightPanel";
import RecentOfframpsTable from "@/components/RecentOfframpsTable";
import ProgressSteps from "@/components/ProgressSteps";
import { TransactionProgressModal } from "@/components/TransactionProgressModal";
import { Header } from "@/components/Header";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { OfframpStep } from "@/types/stellaramp";

export default function Home() {
  const { wallet, isConnecting, error, connect, disconnect, signTransaction } = useStellarWallet();
  
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [modalStep, setModalStep] = useState<OfframpStep>("idle");

  const isConnected = !!wallet;

  const handleSubmit = useCallback(async (payload: OfframpPayload) => {
    setModalStep("initiating");
    
    try {
      // 1. Awaiting Signature
      setModalStep("awaiting-signature");
      // In a real app, we would sign the XDR here:
      // const signed = await signTransaction(payload.quote.someXdr);
      await new Promise(r => setTimeout(r, 2000));

      // 2. Submitting
      setModalStep("submitting");
      await new Promise(r => setTimeout(r, 2000));

      // 3. Processing
      setModalStep("processing");
      await new Promise(r => setTimeout(r, 2000));

      // 4. Settling
      setModalStep("settling");
      await new Promise(r => setTimeout(r, 2000));

      // 5. Success
      setModalStep("success");
    } catch (err) {
      console.error("Transaction failed:", err);
      setModalStep("error");
    }
  }, [signTransaction]);

  return (
    <main className="min-h-screen p-4 bg-[#0a0a0a]">
      <TransactionProgressModal 
        step={modalStep} 
        errorMessage={error || undefined}
        onClose={() => setModalStep("idle")} 
      />
      
      <Header
        subtitle="Stellar Offramp Dashboard"
        isConnected={isConnected}
        isConnecting={isConnecting}
        walletAddress={wallet?.publicKey}
        onConnect={() => connect()}
        onDisconnect={disconnect}
      />

      <section className="border border-[#333333] px-[2.6rem] py-8 max-[1100px]:p-4 overflow-hidden mt-6">
        <div className="grid grid-cols-[1fr_370px] gap-6 max-[1100px]:grid-cols-1 overflow-hidden w-full">
          <div data-testid="FormCard">
            <FormCard
              isConnected={isConnected}
              isConnecting={isConnecting}
              onConnect={() => connect()}
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
              isConnecting={isConnecting}
              amount={amount}
              quote={quote}
              isLoadingQuote={false}
              currency={currency}
              onConnect={() => connect()}
            />
          </div>
          
          <div>
            <RecentOfframpsTable />
          </div>
          
          <div className="col-span-1 min-[1101px]:col-span-2 mt-4 max-[1100px]:block">
            <ProgressSteps isConnected={isConnected} isConnecting={isConnecting} />
          </div>
        </div>
      </section>
    </main>
  );
}
