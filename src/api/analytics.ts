// Google Analytics. Visitors in the EU, EEA, UK and Switzerland are asked first (opt-in); elsewhere it
// loads by default and anyone can opt out from "Cookie settings" (same rule as Wildpuzz).
const GA_ID = "G-M6DGHHPX4W";
const CONSENT_KEY = "sw.consent";

type GA4Event = "search" | "filter_use" | "result_expand" | "example_click" | "share_url_copy" | "outbound_click" | "consent_choice"
  | "list_add" | "list_remove" | "list_share" | "list_open_shared" | "list_add_shared";
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
  // Google's documented opt-out switch: stops gtag sending anything more on this page.
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = value === "denied";
}

/** EU, EEA, UK and Switzerland regions (ISO 3166-1 alpha-2), where analytics needs a yes first. */
const CONSENT_REGIONS = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "UK", "CH",
]);

export interface RegionEnv {
  timeZone?: string;
  language?: string;
}

/** A Europe/ time zone, or a browser language whose region is in the EU/EEA/UK/CH, means "ask first". */
export function consentRequired(env: RegionEnv): boolean {
  if (env.timeZone?.startsWith("Europe/")) return true;
  const region = env.language?.split(/[-_]/)[1]?.toUpperCase();
  return region !== undefined && CONSENT_REGIONS.has(region);
}

function browserRegionEnv(): RegionEnv {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  return { timeZone, language: typeof navigator === "undefined" ? undefined : navigator.language };
}

/** Whether this visitor still has to answer the cookie question before anything loads. */
export function mustAsk(): boolean {
  return getConsent() === null && consentRequired(browserRegionEnv());
}

/** A yes, or no answer yet from a visitor who doesn't need to be asked. */
export function trackingAllowed(): boolean {
  const c = getConsent();
  return c === "granted" || (c === null && !consentRequired(browserRegionEnv()));
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
