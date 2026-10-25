import { getConsent } from "../api/analytics.ts";
import { adConfig } from "./config.ts";

let loaded = false;

/** Injects adsbygoogle.js once. */
export function loadAdSense(client: string): void {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  document.head.append(script);
}

/** Loads AdSense only when ads are configured and the visitor accepted cookies. */
export function loadAdSenseIfAllowed(): void {
  if (adConfig && getConsent() === "granted") loadAdSense(adConfig.client);
}
