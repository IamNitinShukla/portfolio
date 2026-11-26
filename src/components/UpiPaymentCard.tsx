"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";

interface UpiPaymentCardProps {
  upiId?: string;
  upiUri?: string;
}

export default function UpiPaymentCard({
  upiId = "guesswho@pingpay",
  upiUri = "upi://pay?pa=guesswho%40pingpay&pn=Nitin%20Shukla&cu=INR",
}: UpiPaymentCardProps) {
  const [copied, setCopied] = useState(false);
  const [darkQrSvg, setDarkQrSvg] = useState<string>("");
  const [lightQrSvg, setLightQrSvg] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    // Dark Mode QR: Pure white modules on transparent background (uses dark profile card surface)
    QRCode.toString(
      upiUri,
      {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#FFFFFF",
          light: "#00000000",
        },
      },
      (err, svg) => {
        if (!err && mounted && svg) {
          setDarkQrSvg(svg);
        }
      }
    );

    // Light Mode QR: Crisp black modules on transparent background (uses light profile card surface)
    QRCode.toString(
      upiUri,
      {
        type: "svg",
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#171923",
          light: "#00000000",
        },
      },
      (err, svg) => {
        if (!err && mounted && svg) {
          setLightQrSvg(svg);
        }
      }
    );

    return () => {
      mounted = false;
    };
  }, [upiUri]);

  const handleCopyUpi = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(upiId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="relative w-full h-full rounded-xl sm:rounded-2xl flex flex-col items-center justify-between p-3.5 sm:p-4.5 bg-surface border border-border select-none overflow-hidden"
      role="region"
      aria-label="UPI Payment QR Code"
    >
      {/* Top Header Row: Clean "SCAN ME" Label + Italic UPI 2.0 Technical Badge */}
      <div className="w-full flex items-center justify-between pb-0.5">
        <span className="font-mono text-xs sm:text-[13px] font-bold tracking-widest text-primary uppercase">
          SCAN ME
        </span>
        <span className="font-mono italic text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-md bg-surface-secondary border border-border text-primary-muted tracking-wide">
          UPI 2.0
        </span>
      </div>

      {/* Centered QR Code — 15-20% Larger Dimensions, Theme-Adaptive Surface */}
      <div className="my-auto flex items-center justify-center p-1">
        <div className="w-[225px] h-[225px] sm:w-[250px] sm:h-[250px] flex items-center justify-center">
          {/* Dark Mode QR: Crisp white modules on dark card background */}
          {darkQrSvg && (
            <div
              className="hidden dark:block w-full h-full [&_svg]:w-full [&_svg]:h-full"
              dangerouslySetInnerHTML={{ __html: darkQrSvg }}
              aria-label="UPI Scannable QR Code (Dark Mode)"
            />
          )}

          {/* Light Mode QR: Crisp black modules on light card background */}
          {lightQrSvg && (
            <div
              className="block dark:hidden w-full h-full [&_svg]:w-full [&_svg]:h-full"
              dangerouslySetInnerHTML={{ __html: lightQrSvg }}
              aria-label="UPI Scannable QR Code (Light Mode)"
            />
          )}

          {!darkQrSvg && !lightQrSvg && (
            <span className="font-mono text-xs text-primary-muted animate-pulse">Loading QR...</span>
          )}
        </div>
      </div>

      {/* Bottom UPI ID Presentation (15-20% Larger Typography, No pill background, functional copy button) */}
      <div className="w-full flex items-center justify-center pt-0.5 pb-0.5">
        <button
          type="button"
          onClick={handleCopyUpi}
          className="inline-flex items-center gap-2 text-sm sm:text-[15px] font-mono font-bold text-primary hover:text-accent transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-2 py-0.5 group/copy"
          aria-label="Copy UPI ID"
          title="Click to copy UPI ID"
        >
          <span className="tracking-wide">{copied ? "UPI ID Copied!" : upiId}</span>
          {copied ? (
            <Check className="w-4 h-4 text-accent shrink-0" />
          ) : (
            <Copy className="w-4 h-4 text-primary-muted group-hover/copy:text-accent transition-colors shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}
