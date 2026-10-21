// Google Analytics loads only after the visitor accepts cookies (same approach as 90sgamer.com).
const GA_ID = "G-M6DGHHPX4W";
const CONSENT_KEY = "sw.consent";

type GA4Event = "search" | "filter_use" | "result_expand" | "example_click" | "share_url_copy" | "outbound_click" | "consent_choice";
type Gtag = (...args: unknown[]) => void;
type GaWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

export type Consent = "granted" | "denied" | null;

export function getConsent(): Consent {
  try {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: "granted" | "denied"): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // private mode etc.: the choice just won't be remembered
  }
}

let gtag: Gtag | null = null;

/** Loads gtag.js once; the config call sends the page_view. */
export function loadAnalytics(): void {
  if (gtag || typeof window === "undefined") return;
  const w = window as GaWindow;
  w.dataLayer = w.dataLayer ?? [];
  gtag = function () {
    // gtag.js expects the arguments object itself, not an array.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag = gtag;
  gtag("js", new Date());
  gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.append(script);
}

export function track(event: GA4Event, params: Record<string, unknown> = {}): void {
  gtag?.("event", event, params);
}
