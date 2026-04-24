"use client";

import { useRef } from "react";

export interface ReceiptData {
  txHash: string;
  orderId?: string;
  amount: string;
  currency: string;
  destinationAmount: string;
  bridgeFee: string;
  payoutFee: string;
  rate: number;
  provider: string;
  bankName: string;
  accountNumber: string;
  timestamp: number;
  status: "completed" | "pending" | "failed";
}

interface TransactionReceiptProps {
  data: ReceiptData;
  onClose?: () => void;
}

/** Minimal deterministic QR-like grid from a string — decorative only */
function QRPlaceholder({ value }: { value: string }) {
  const size = 9;
  const cells: boolean[] = [];
  for (let i = 0; i < size * size; i++) {
    const charCode = value.charCodeAt(i % value.length);
    cells.push((charCode + i) % 3 !== 0);
  }
  // Fixed corner finder patterns
  const corners = new Set([0, 1, 2, 3, 4, 5, 6, 9, 15, 18, 24, 27, 33, 36, 42, 45, 46, 47, 48, 49, 50, 51, 54, 60, 63, 69, 72, 73, 74, 75, 76, 77, 78]);
  return (
    <div
      aria-label={`QR code for transaction ${value.slice(0, 8)}…`}
      role="img"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gap: 1,
        width: 72,
        height: 72,
        padding: 4,
        background: "#fff",
        border: "1px solid var(--line)",
      }}
    >
      {cells.map((filled, i) => (
        <div
          key={i}
          style={{
            background: corners.has(i) || filled ? "#000" : "#fff",
            borderRadius: 0,
          }}
        />
      ))}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        padding: "8px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--muted)", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: "var(--text)",
          textAlign: "right",
          wordBreak: "break-all",
          fontFamily: mono ? "var(--font-ibm-plex-mono)" : "inherit",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const STATUS_COLOR: Record<ReceiptData["status"], string> = {
  completed: "#22c55e",
  pending: "var(--accent)",
  failed: "#ef4444",
};

export function TransactionReceipt({ data, onClose }: TransactionReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const date = new Date(data.timestamp).toLocaleString();
  const shortHash = `${data.txHash.slice(0, 8)}…${data.txHash.slice(-6)}`;
  const shareText = `Stellar-Spend transaction ${shortHash} — ${data.amount} USDC → ${data.destinationAmount} ${data.currency}`;

  function handlePrint() {
    if (!receiptRef.current) return;
    const win = window.open("", "_blank", "width=480,height=700");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${shortHash}</title>
      <style>
        body { font-family: monospace; font-size: 12px; padding: 24px; color: #000; }
        .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #ddd; }
        .label { color: #666; }
        h2 { font-size: 16px; margin-bottom: 16px; }
      </style></head><body>
      ${receiptRef.current.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Transaction Receipt", text: shareText });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      alert("Receipt details copied to clipboard.");
    }
  }

  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        padding: 24,
        maxWidth: 480,
        width: "100%",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.08em", marginBottom: 4 }}>
            TRANSACTION RECEIPT
          </div>
          <div style={{ fontSize: 20, color: "var(--text)", fontWeight: 600 }}>
            {data.amount} USDC
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
            → {parseFloat(data.destinationAmount).toLocaleString()} {data.currency}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              padding: "3px 8px",
              border: "1px solid",
              borderColor: STATUS_COLOR[data.status],
              color: STATUS_COLOR[data.status],
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {data.status}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close receipt"
              style={{ fontSize: 18, color: "var(--muted)", lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <div ref={receiptRef}>
        <Row label="Date" value={date} />
        <Row label="Tx Hash" value={shortHash} mono />
        {data.orderId && <Row label="Order ID" value={data.orderId} mono />}
        <Row label="Provider" value={data.provider} />
        <Row label="Exchange Rate" value={`1 USDC = ${data.rate.toLocaleString()} ${data.currency}`} />
        <Row label="Bridge Fee" value={`${data.bridgeFee} USDC`} />
        <Row label="Payout Fee" value={`${data.payoutFee} USDC`} />
        <Row label="Bank" value={data.bankName} />
        <Row label="Account" value={`****${data.accountNumber.slice(-4)}`} mono />
      </div>

      {/* QR + Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 20 }}>
        <QRPlaceholder value={data.txHash} />

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={handlePrint}
            style={{
              fontSize: 12,
              padding: "8px 14px",
              border: "1px solid var(--line)",
              color: "var(--text)",
              background: "none",
              cursor: "pointer",
            }}
          >
            Print
          </button>
          <button
            onClick={handleShare}
            style={{
              fontSize: 12,
              padding: "8px 14px",
              border: "1px solid var(--accent)",
              color: "var(--accent)",
              background: "none",
              cursor: "pointer",
            }}
          >
            Share
          </button>
        </div>
      </div>

      {/* Full hash */}
      <div
        style={{
          marginTop: 12,
          padding: "8px 10px",
          background: "var(--bg)",
          fontSize: 10,
          color: "var(--muted)",
          wordBreak: "break-all",
          fontFamily: "var(--font-ibm-plex-mono)",
        }}
      >
        {data.txHash}
      </div>
    </div>
  );
}
