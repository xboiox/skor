"use client";

import { useState } from "react";
import { INPUT_CLASS } from "@/components/ui/styles";

interface LinkCardProps {
  title: string;
  description: string;
  url: string;
  shareText: string;
  /** Server-rendered SVG; when given, a "Show QR" button lets players scan it at the venue. */
  qrSvg?: string;
}

const COPIED_MS = 2000;

export function LinkCard({ title, description, url, shareText, qrSvg }: LinkCardProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [isQrOpen, setIsQrOpen] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
    setTimeout(() => setStatus("idle"), COPIED_MS);
  }

  async function share() {
    try {
      await navigator.share({ title: shareText, url });
    } catch {
      // Cancelled by the user or unsupported target — nothing to do.
    }
  }

  const buttonClass =
    "flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border font-bold";
  return (
    <section className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
      <h3 className="font-bold">{title}</h3>
      <p className="text-muted text-sm">{description}</p>
      <input
        readOnly
        value={url}
        aria-label={`${title} URL`}
        onFocus={(e) => e.currentTarget.select()}
        className={`${INPUT_CLASS} text-sm`}
      />
      <div className="flex gap-2">
        <button type="button" onClick={copy} className={buttonClass}>
          {status === "copied" ? "Copied ✓" : status === "failed" ? "Copy failed" : "Copy"}
        </button>
        {canShare && (
          <button type="button" onClick={share} className={buttonClass}>
            Share
          </button>
        )}
        {qrSvg && (
          <button
            type="button"
            onClick={() => setIsQrOpen(!isQrOpen)}
            aria-expanded={isQrOpen}
            className={buttonClass}
          >
            {isQrOpen ? "Hide QR" : "Show QR"}
          </button>
        )}
      </div>
      {qrSvg && isQrOpen && (
        // Generated server-side by the qrcode library from our own URL.
        <div
          className="mx-auto w-full max-w-64 rounded-xl bg-white p-2"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      )}
    </section>
  );
}
