import React from 'react';

type ProgressStepsProps = {
  isConnected: boolean;
  isConnecting: boolean;
};

export default function ProgressSteps({
  isConnected,
  isConnecting,
}: ProgressStepsProps) {
  // Determine active step based on rules:
  // Step 1 is active when wallet is not connected
  // Step 2 is active when wallet is connecting
  // Step 3 is active when wallet is connected and not connecting
  const activeStep = isConnecting ? 2 : (!isConnected ? 1 : 3);

  const steps = [
    {
      number: '01',
      title: isConnected ? 'CONNECTED \u2713' : 'CONNECT WALLET',
      description: 'Connect your wallet to begin securely.',
    },
    {
      number: '02',
      title: isConnecting ? 'SIGNATURE PENDING' : 'FX LOCK',
      description: 'Lock in exchange rate and sign transaction.',
    },
    {
      number: '03',
      title: '\u20A6 PAYOUT',
      description: 'Receive payout directly into your account.',
    },
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isActive = activeStep === stepNum;

          return (
            <div
              key={step.number}
              className={`flex flex-col justify-between p-6 rounded-lg transition-all duration-300 min-h-[160px] border ${
                isActive
                  ? 'bg-[var(--accent)] text-[#111111] shadow-lg scale-[1.02] border-transparent'
                  : 'bg-[#111111] text-[#777777] border-[#333333]'
              }`}
              style={{
                backgroundColor: isActive ? 'var(--accent, #D4AF37)' : '',
              }}
            >
              <div className="flex flex-col">
                <span
                  className={`text-4xl font-black tracking-tighter mb-4 ${
                    isActive ? 'text-[#111111]/40' : 'text-[#444444]'
                  }`}
                >
                  {step.number}
                </span>
                <h3
                  className={`text-lg font-bold tracking-wide uppercase ${
                    isActive ? 'text-[#111111]' : 'text-white'
                  }`}
                >
                  {step.title}
                </h3>
              </div>
              
              <p
                className={`text-sm mt-3 font-medium ${
                  isActive ? 'text-[#111111]/80' : 'text-[#777777]'
                }`}
              >
                {step.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
