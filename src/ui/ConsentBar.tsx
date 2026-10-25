import React from "react";
import { loadAnalytics, setConsent, track } from "../api/analytics.ts";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConsentBar({ open, onClose }: Props): React.ReactElement | null {
  if (!open) return null;

  function accept(): void {
    setConsent("granted");
    loadAnalytics();
    track("consent_choice", { choice: "granted" });
    onClose();
  }

  function decline(): void {
    setConsent("denied");
    onClose();
  }

  return (
    <div
      role="region"
      aria-label="Cookie choice"
      className="window"
      style={{ position: "fixed", left: 16, bottom: 16, zIndex: 50, width: "min(420px, calc(100vw - 32px))" }}
    >
      <div className="title-bar">
        <div className="title-bar-text">🍪 Cookies.txt</div>
      </div>
      <div className="window-body">
        <p className="m-0 text-[13px] leading-[1.5] font-prose">
          We use Google Analytics cookies (the digital kind, sadly not chocolate chip) to see which searches people run. No names, no selling.{" "}
          <a href="https://90sgamer.com/privacy/" target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
        </p>
        <div className="flex justify-end gap-2 mt-3">
          <button type="button" onClick={decline}>
            No thanks
          </button>
          <button type="button" className="default" onClick={accept}>
            Accept cookies
          </button>
        </div>
      </div>
    </div>
  );
}
